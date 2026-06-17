import { Injectable, effect, signal } from '@angular/core';

/**
 * B8 — SettingsStore (Angular).
 *
 * Zentraler, in localStorage persistierter Speicher für die anzeige- und
 * pipeline-relevanten Einstellungen. Angular-Pendant zum früheren React-Context
 * `useSettings()`. Wird von SessionService (msPerSign, historyLength) und
 * SignPipelineService (fillerFilter) gelesen; `highContrast` wird hier direkt
 * aufs <html>-Element angewandt.
 */
export interface Settings {
  /** Anzeigedauer pro Gebärde in ms (B5). */
  msPerSign: number;
  /** Füllwörter (äh, halt, …) aus der Pipeline filtern (B2). */
  fillerFilter: boolean;
  /** Hoher Kontrast für die Gebärden-Karten. */
  highContrast: boolean;
  /** Maximale Länge des Verlaufsstreifens (B5). */
  historyLength: number;
}

export const DEFAULT_SETTINGS: Settings = {
  msPerSign: 600,
  fillerFilter: false,
  highContrast: false,
  historyLength: 50,
};

const STORAGE_KEY = 'signbridge:settings';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  readonly msPerSign = signal(DEFAULT_SETTINGS.msPerSign);
  readonly fillerFilter = signal(DEFAULT_SETTINGS.fillerFilter);
  readonly highContrast = signal(DEFAULT_SETTINGS.highContrast);
  readonly historyLength = signal(DEFAULT_SETTINGS.historyLength);

  constructor() {
    this.load();

    // Hohen Kontrast auf das <html data-field>-Attribut abbilden (Tokens in styles.css).
    effect(() => {
      const on = this.highContrast();
      if (on) document.documentElement.setAttribute('data-field', 'contrast');
      else document.documentElement.removeAttribute('data-field');
    });

    // Jede Änderung persistieren (Best-Effort).
    effect(() => this.persist());
  }

  /** Mehrere Felder auf einmal setzen. */
  update(patch: Partial<Settings>): void {
    if (patch.msPerSign !== undefined) this.msPerSign.set(patch.msPerSign);
    if (patch.fillerFilter !== undefined) this.fillerFilter.set(patch.fillerFilter);
    if (patch.highContrast !== undefined) this.highContrast.set(patch.highContrast);
    if (patch.historyLength !== undefined) this.historyLength.set(patch.historyLength);
  }

  /** Auf Standardwerte zurücksetzen. */
  reset(): void {
    this.update(DEFAULT_SETTINGS);
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      this.update({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) });
    } catch {
      /* defekter/abwesender Storage → Defaults behalten */
    }
  }

  private persist(): void {
    const snapshot: Settings = {
      msPerSign: this.msPerSign(),
      fillerFilter: this.fillerFilter(),
      highContrast: this.highContrast(),
      historyLength: this.historyLength(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      /* Persistenz ist Best-Effort */
    }
  }
}
