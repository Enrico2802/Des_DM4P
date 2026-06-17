import { Injectable, inject, signal } from '@angular/core';
import { loadDictionary, Dictionary } from '../../engine/dictionary';
import { normalize } from '../../engine/normalizer';
import { resolve } from '../../engine/resolver';
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
   */
  toSigns(text: string, segmentId = 'manual'): SignItem[] {
    const segment = { text, isFinal: true, timestamp: Date.now() };
    const tokens = normalize(segment, segmentId, {
      filterFillers: this.settings.fillerFilter(),
    });
    const lookup = this.lookup;
    return tokens.map((token) => resolve(token, lookup));
  }
}
