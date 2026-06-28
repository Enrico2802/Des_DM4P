/**
 * B3.5 — Correction (Vokabular-Korrektur + Fuzzy-Match)
 *
 * Letzte Rettung für die Erkennungsqualität: Bevor B3 ein Wort buchstabiert
 * oder als „unknown" einstuft, versucht dieser Baustein, es auf eine bekannte
 * Wörterbuchform abzubilden.
 *
 * Zwei Stufen, reine Funktionen ohne State:
 *  1. Korrekturtabelle — feste, beobachtete Falscherkennungen → Zielwort.
 *  2. Fuzzy-Match — Wort mit kleiner Editierdistanz (Default 1) zu GENAU einem
 *     Wörterbuchschlüssel; bei Mehrdeutigkeit (Gleichstand) bewusst KEINE
 *     Korrektur, um falsche „Verbesserungen" zu vermeiden.
 *
 * Der Corrector bekommt die Wörterbuchschlüssel (B0) injiziert und ist damit
 * unabhängig vom konkreten Wörterbuch testbar.
 */

/**
 * Feste Korrekturen für wiederkehrende Falscherkennungen. Schlüssel sind
 * normalisierte (kleingeschriebene) Formen, Werte die Zielform (sollte ein
 * Wörterbuchschlüssel sein). Bewusst klein gehalten — hier gehören nur real
 * beobachtete Slips hinein, damit nichts „überkorrigiert" wird. Über
 * {@link CorrectionOptions.map} erweiter-/überschreibbar.
 */
export const DEFAULT_CORRECTIONS: Readonly<Record<string, string>> = {
  // Häufige englische „Leak"-Erkennungen deutscher Wörter:
  hello: 'hallo',
  hi: 'hallo',
  thanks: 'danke',
  // Getrennt erkannte Eigennamen / Markenname:
  'sign-bridge': 'signbridge',
};

export interface CorrectionOptions {
  /** Zusätzliche/überschreibende Korrektureinträge (normalisierte Schlüssel). */
  map?: Record<string, string>;
  /** Max. Editierdistanz für den Fuzzy-Match (Default 1; 0 schaltet ihn ab). */
  fuzzyMaxDistance?: number;
  /** Mindest-Wortlänge für den Fuzzy-Match (Default 4; kürzere bleiben unangetastet). */
  fuzzyMinLength?: number;
}

/** normalisierte Form → korrigierte Form oder null (keine Korrektur). */
export type Corrector = (normalized: string) => string | null;

/**
 * Levenshtein-Editierdistanz (Einfügen/Löschen/Ersetzen), iterativ mit zwei
 * Zeilen. Bricht früh ab, sobald die ganze Zeile `limit` überschreitet.
 */
export function levenshtein(a: string, b: string, limit = Infinity): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const del = (prev[j] ?? 0) + 1;
      const ins = (curr[j - 1] ?? 0) + 1;
      const sub = (prev[j - 1] ?? 0) + cost;
      const v = Math.min(del, ins, sub);
      curr[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > limit) return limit + 1; // kann nur noch größer werden
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

/**
 * Sucht den EINDEUTIG nächsten Schlüssel zu `word` innerhalb `maxDistance`.
 * Gibt null zurück bei: kein Treffer, exaktem Treffer (dann ist keine Korrektur
 * nötig) oder Gleichstand mehrerer Schlüssel (mehrdeutig → nicht korrigieren).
 */
export function nearestKey(
  word: string,
  keys: Iterable<string>,
  maxDistance = 1,
): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  let tie = false;

  for (const key of keys) {
    if (Math.abs(key.length - word.length) > maxDistance) continue; // Längenfilter
    const d = levenshtein(word, key, maxDistance);
    if (d === 0) return null; // Wort ist selbst ein Schlüssel → keine Korrektur
    if (d > maxDistance) continue;
    if (d < bestDist) {
      bestDist = d;
      best = key;
      tie = false;
    } else if (d === bestDist && key !== best) {
      tie = true;
    }
  }

  return tie ? null : best;
}

/**
 * Baut einen {@link Corrector} über den Wörterbuchschlüsseln. Reihenfolge:
 * feste Tabelle zuerst (deterministisch), dann Fuzzy-Match.
 */
export function createCorrector(
  keys: Iterable<string>,
  options: CorrectionOptions = {},
): Corrector {
  const map: Record<string, string> = { ...DEFAULT_CORRECTIONS, ...(options.map ?? {}) };
  const maxDistance = options.fuzzyMaxDistance ?? 1;
  const minLength = options.fuzzyMinLength ?? 4;
  const keyList = [...keys];
  const keySet = new Set(keyList);

  return (normalized) => {
    const w = normalized.normalize('NFC').toLowerCase();
    if (Object.prototype.hasOwnProperty.call(map, w)) return map[w] ?? null;
    if (maxDistance <= 0 || w.length < minLength || keySet.has(w)) return null;
    return nearestKey(w, keyList, maxDistance);
  };
}
