/**
 * B0 — DictionaryLoader
 *
 * Lädt die SignDict-JSON, validiert das Schema und baut EINMALIG einen Index
 * (Map<string, DictEntry>), in dem sowohl `word` als auch alle `variants` als
 * Schlüssel auf den Eintrag zeigen → Lookup ist O(1).
 *
 * Zusätzlich: Caching des geladenen JSON in IndexedDB mit Versionsfeld, sodass
 * die App offline startet. Das Caching ist defensiv — fehlt IndexedDB (z. B. in
 * Tests/SSR) oder schlägt fehl, wird es still übersprungen.
 */
import type { DictEntry, LookupFn } from '../types';

/** Schlüssel-Normalisierung (kleingeschrieben, NFC) — identisch zu B2. */
function key(word: string): string {
  return word.normalize('NFC').toLowerCase().trim();
}

/**
 * Validiert rohe JSON-Daten gegen das DictEntry-Schema.
 * @throws Error bei ungültiger Struktur.
 */
export function validateEntries(data: unknown): DictEntry[] {
  if (!Array.isArray(data)) {
    throw new Error('Dictionary: erwartet ein Array von Einträgen.');
  }
  return data.map((raw, i) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new Error(`Dictionary: Eintrag ${i} ist kein Objekt.`);
    }
    // Bracket-Zugriff statt Punkt-Notation: Angulars tsconfig nutzt
    // `noPropertyAccessFromIndexSignature`, was Punkt-Zugriffe auf
    // Record<string, unknown> verbietet.
    const entry = raw as Record<string, unknown>;
    const word = entry['word'];
    const imageUrl = entry['imageUrl'];
    const variants = entry['variants'];
    if (typeof word !== 'string' || word.length === 0) {
      throw new Error(`Dictionary: Eintrag ${i} hat kein gültiges "word".`);
    }
    if (typeof imageUrl !== 'string' || imageUrl.length === 0) {
      throw new Error(`Dictionary: Eintrag "${word}" hat kein gültiges "imageUrl".`);
    }
    if (
      variants !== undefined &&
      !(Array.isArray(variants) && variants.every((v) => typeof v === 'string'))
    ) {
      throw new Error(`Dictionary: Eintrag "${word}" hat ungültige "variants".`);
    }
    return {
      word,
      imageUrl,
      ...(variants ? { variants: variants as string[] } : {}),
    };
  });
}

/**
 * Indizierte Wörterbuch-Instanz. `lookup` ist case-insensitive und O(1).
 * Grundformen (`word`) gewinnen immer gegenüber `variants` anderer Einträge.
 */
export class Dictionary {
  private readonly index = new Map<string, DictEntry>();

  constructor(entries: readonly DictEntry[]) {
    // Pass 1: Grundformen.
    for (const entry of entries) {
      this.index.set(key(entry.word), entry);
    }
    // Pass 2: Varianten, ohne eine Grundform (oder frühere Variante) zu überschreiben.
    for (const entry of entries) {
      for (const variant of entry.variants ?? []) {
        const k = key(variant);
        if (!this.index.has(k)) this.index.set(k, entry);
      }
    }
  }

  /** Schlägt ein Wort nach (case-insensitive). */
  lookup: LookupFn = (word) => this.index.get(key(word)) ?? null;

  /** Anzahl der Lookup-Schlüssel (Grundformen + Varianten). */
  get size(): number {
    return this.index.size;
  }
}

// ---------------------------------------------------------------------------
// IndexedDB-Cache (browserseitig, defensiv)
// ---------------------------------------------------------------------------

const DB_NAME = 'signbridge';
const STORE = 'dictionary';
const CACHE_KEY = 'entries';

interface CachedDictionary {
  version: string;
  entries: DictEntry[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readCache(version: string): Promise<DictEntry[] | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await openDb();
    const cached = await new Promise<CachedDictionary | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result as CachedDictionary | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return cached && cached.version === version ? cached.entries : null;
  } catch {
    return null; // Cache ist Best-Effort.
  }
}

async function writeCache(version: string, entries: DictEntry[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ version, entries } satisfies CachedDictionary, CACHE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* Cache ist Best-Effort. */
  }
}

export interface LoadDictionaryOptions {
  /**
   * Cache-Version für HARTE Invalidierung (z. B. bei Schema-Änderungen): Ein
   * Versionswechsel verwirft den alten Cache. INHALTSänderungen an der JSON
   * brauchen keinen Versionswechsel — sie werden per stale-while-revalidate
   * automatisch übernommen (siehe unten). Default "1".
   */
  version?: string;
  /** Injizierbarer fetch (für Tests). Default: globaler fetch. */
  fetchFn?: typeof fetch;
  /** IndexedDB-Cache nutzen (Default true im Browser). */
  useCache?: boolean;
}

async function fetchEntries(url: string, fetchFn: typeof fetch): Promise<DictEntry[]> {
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`Dictionary: Laden von ${url} fehlgeschlagen (HTTP ${response.status}).`);
  }
  return validateEntries(await response.json());
}

/**
 * Lädt das Wörterbuch von `url`, validiert es und gibt eine indizierte
 * {@link Dictionary} zurück.
 *
 * Cache-Strategie (stale-while-revalidate): Liegt ein Cache vor, wird sofort
 * daraus gestartet (offline-fähig) UND im Hintergrund neu geladen, sodass
 * geänderte JSON-Inhalte beim nächsten Start übernommen werden. Ohne diese
 * Revalidierung bliebe der Cache bei fester Default-Version dauerhaft alt.
 */
export async function loadDictionary(
  url: string,
  options: LoadDictionaryOptions = {},
): Promise<Dictionary> {
  const version = options.version ?? '1';
  const fetchFn = options.fetchFn ?? fetch;
  const useCache = options.useCache ?? true;

  if (useCache) {
    const cached = await readCache(version);
    if (cached) {
      // Stale-while-revalidate: Cache aktualisieren, Fehler (offline) ignorieren.
      void fetchEntries(url, fetchFn)
        .then((fresh) => writeCache(version, fresh))
        .catch(() => {
          /* offline o. ä. → vorhandenen Cache behalten */
        });
      return new Dictionary(cached);
    }
  }

  const entries = await fetchEntries(url, fetchFn);
  if (useCache) void writeCache(version, entries);

  return new Dictionary(entries);
}
