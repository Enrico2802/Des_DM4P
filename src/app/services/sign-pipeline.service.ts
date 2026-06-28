import { Injectable, inject, signal } from '@angular/core';
import { loadDictionary, Dictionary } from '../../engine/dictionary';
import { normalizeWithAlternatives } from '../../engine/normalizer';
import { resolve } from '../../engine/resolver';
import { createCorrector, type Corrector } from '../../engine/correction';
import type { LookupFn, SignItem } from '../../engine/types';
import { SettingsService } from './settings.service';

/**
 * SIGN-PIPELINE — die echte Übersetzungslogik der Engine als Angular-Service.
 *
 * Verdrahtet die reinen Bausteine:
 *   B0 DictionaryLoader → lädt /dictionary.json und baut den O(1)-Index
 *   B2 TextNormalizer   → Text → Token[]
 *   B3 SignResolver     → Token → SignItem (nutzt intern B4 Fingerspelling)
 *
 * Ersetzt den früheren Mock `GlossService`, der nur Platzhalter-Wörter lieferte.
 */
@Injectable({ providedIn: 'root' })
export class SignPipelineService {
  private readonly settings = inject(SettingsService);
  private dict: Dictionary | null = null;
  /** B3.5: über den Wörterbuchschlüsseln gebauter Korrektor (Fuzzy/Tabelle). */
  private corrector: Corrector | null = null;
  private readonly ready: Promise<void>;

  /** Ob das Wörterbuch (B0) geladen ist — für die UI (z. B. Lade-Hinweis). */
  readonly dictionaryReady = signal(false);
  /** Fehlertext, falls das Wörterbuch nicht geladen werden konnte. */
  readonly error = signal<string | null>(null);

  constructor() {
    // B0: offline-fähig über den IndexedDB-Cache der Engine.
    this.ready = loadDictionary('/dictionary.json')
      .then((dict) => {
        this.dict = dict;
        this.corrector = createCorrector(dict.keys);
        this.dictionaryReady.set(true);
      })
      .catch((e: unknown) => {
        this.error.set(`Wörterbuch konnte nicht geladen werden: ${(e as Error).message}`);
      });
  }

  /** Promise, das auflöst, sobald das Wörterbuch geladen ist. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /** Aktueller Lookup; vor dem Laden eine leere Funktion (→ Fingeralphabet-Fallback greift). */
  private get lookup(): LookupFn {
    return this.dict ? this.dict.lookup : () => null;
  }

  /**
   * Text → SignItem[]. Durchläuft B2 (normalize) und B3/B4 (resolve).
   * `segmentId` bindet die Tokens an ihr Segment (für B5-Interim-Korrektur).
   *
   * `meta` reicht die Erkennungs-Alternativen und -Konfidenz aus B1 durch, damit
   * B3 bei einem Fehlgriff eine Hypothese wählen kann, die als Gebärde existiert.
   */
  toSigns(
    text: string,
    segmentId = 'manual',
    meta: { alternatives?: string[]; confidence?: number } = {},
  ): SignItem[] {
    const segment = {
      text,
      isFinal: true,
      timestamp: Date.now(),
      ...(meta.alternatives?.length ? { alternatives: meta.alternatives } : {}),
      ...(typeof meta.confidence === 'number' ? { confidence: meta.confidence } : {}),
    };
    const tokens = normalizeWithAlternatives(segment, segmentId, {
      filterFillers: this.settings.fillerFilter(),
    });
    const lookup = this.lookup;
    const correct = this.corrector ?? undefined;
    return tokens.map((token) => resolve(token, lookup, { correct }));
  }
}
