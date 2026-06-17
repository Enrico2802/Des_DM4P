import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { DisplayQueue } from '../../engine/queue';
import type { SignItem } from '../../engine/types';
import { RecognitionService } from './recognition.service';
import { SignPipelineService } from './sign-pipeline.service';

/**
 * SESSION-CONTROLLER (B7) — der EINZIGE Ort, der alle Bausteine verdrahtet.
 * Angular-Pendant zum früheren React-Hook `useSignBridge`.
 *
 * Zwei Pfade in eine gemeinsame Darstellung:
 *  - **Live-Mikrofon:** B1 SpeechCapture → B2/B3/B4 (Pipeline) → B5 DisplayQueue.
 *    B5 gibt die Gebärden zeitgesteuert „ein Zeichen nach dem anderen" aus
 *    (`current` + `liveHistory`) und korrigiert Interim-Ergebnisse via segmentId.
 *  - **Text/Upload (Batch):** ganze Eingabe → Pipeline → `items` (komplette
 *    Gebärdenfolge auf einmal, vom Renderer durchgespielt).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly rec = inject(RecognitionService);
  private readonly pipeline = inject(SignPipelineService);

  // B5 — Timing/Backpressure/Interim-Korrektur für den Live-Mikrofon-Pfad.
  private readonly queue = new DisplayQueue({ msPerSign: 600, maxHistory: 50 });

  /** Batch-Ergebnis (getippter/hochgeladener Text). */
  readonly items = signal<SignItem[]>([]);
  /** Live: aktuell angezeigte Gebärde (B5-Tick). */
  readonly current = signal<SignItem | null>(null);
  /** Live: Verlauf der bereits angezeigten Gebärden (B5). */
  readonly liveHistory = signal<SignItem[]>([]);

  /** Transkript-Kopfzeile. */
  readonly transcript = signal('Warte auf Eingabe…');
  readonly isPlaceholder = signal(true);
  readonly error = signal<string | null>(null);

  /** Ob gerade live zugehört wird (→ Live-Ansicht statt Batch). */
  readonly recording = this.rec.recording;
  /** Ob die Spracherkennung im Browser verfügbar ist. */
  readonly supported = this.rec.supported;
  /** Ob das Wörterbuch (B0) geladen ist. */
  readonly dictionaryReady = this.pipeline.dictionaryReady;

  /** Die für die Ausgabe-Zone relevante Gebärdenfolge (Live = B5-Verlauf, sonst Batch). */
  readonly displayItems = computed(() => (this.recording() ? this.liveHistory() : this.items()));

  constructor() {
    // B5 → Live-Signale.
    this.queue.onTick((cur, hist) => {
      this.current.set(cur);
      this.liveHistory.set([...hist]);
    });

    // B1 → B2/B3/B4 → B5 (Live-Mikrofon). Interim-Updates ersetzen via segmentId.
    this.rec.segments.subscribe(({ text, isFinal, segmentId }) => {
      this.transcript.set(text);
      this.isPlaceholder.set(false);
      const signs = this.pipeline.toSigns(text, segmentId);
      this.queue.replaceSegment(segmentId, signs, isFinal);
    });

    this.rec.errors.subscribe((msg) => this.error.set(msg));

    // Wörterbuch-Ladefehler aus der Pipeline übernehmen.
    effect(() => {
      const e = this.pipeline.error();
      if (e) this.error.set(e);
    });
  }

  /** Live-Mikrofon umschalten. */
  toggleMic(): void {
    if (this.recording()) this.stop();
    else this.start();
  }

  start(): void {
    this.error.set(null);
    this.queue.clear();
    this.current.set(null);
    this.liveHistory.set([]);
    this.items.set([]);
    this.transcript.set('Höre zu…');
    this.isPlaceholder.set(true);
    void this.rec.start();
  }

  stop(): void {
    this.rec.stop();
    // Zuletzt live erkannte Gebärden als Batch erhalten, damit nach dem Stoppen
    // das Ergebnis sichtbar bleibt (Grid/Sequence/Focus).
    const live = this.liveHistory();
    if (live.length) this.items.set(live);
  }

  /** Text manuell in die Pipeline geben (Texteingabe + Datei-Upload). */
  submitText(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (this.recording()) this.stop();
    this.queue.clear();
    this.current.set(null);
    this.liveHistory.set([]);
    this.transcript.set(trimmed);
    this.isPlaceholder.set(false);
    this.items.set(this.pipeline.toSigns(trimmed));
  }
}
