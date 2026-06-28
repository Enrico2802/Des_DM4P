/**
 * B1 — SpeechCapture (STT)
 *
 * Kapselt die Web Speech API (SpeechRecognition / webkitSpeechRecognition).
 * Konfiguration: lang "de-DE", continuous, interimResults.
 *
 * Wichtige Punkte:
 *  - Pro Result-Index eine STABILE segmentId, damit Interim-Updates desselben
 *    Satzes dieselbe Id behalten (Voraussetzung für B5-Interim-Korrektur).
 *  - Auto-Restart in `onend`, solange der Nutzer nicht selbst gestoppt hat
 *    (Chrome beendet Sessions nach ~60 s Stille).
 *  - Verständliche deutsche Fehlermeldungen für "not-allowed", "no-speech" usw.
 *
 * Da die echte API in jsdom/Node fehlt, ist der Recognition-Erzeuger injizierbar
 * (`createRecognition`), sodass Restart- und SegmentId-Logik gegen einen Mock
 * getestet werden können.
 */
import type { TranscriptSegment } from '../types';

export type CaptureState = 'idle' | 'listening' | 'error';

/** Schmale Sicht auf SpeechRecognition — nur was wir brauchen. */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  /** Anzahl angeforderter Hypothesen pro Ergebnis (Web Speech: maxAlternatives). */
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort?(): void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart?: (() => void) | null;
}

/** Eine einzelne Hypothese (Alternative) eines Ergebnisses. */
export interface SpeechAlternativeLike {
  transcript: string;
  /** Konfidenz 0..1 (nur bei finalen Ergebnissen aussagekräftig). */
  confidence?: number;
}

/**
 * Ein Ergebnis ist eine indizierbare Liste von Alternativen (best-first) plus
 * `isFinal`. `length` gibt die Anzahl gelieferter Hypothesen an.
 */
export interface SpeechRecognitionResultLike extends ArrayLike<SpeechAlternativeLike> {
  isFinal: boolean;
}

export interface SpeechResultEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

type SegmentListener = (segment: TranscriptSegment, segmentId: string) => void;
type StateListener = (state: CaptureState, error?: string) => void;

export interface SpeechCaptureOptions {
  lang?: string;
  /**
   * Wie viele Hypothesen die API pro Ergebnis liefern soll (Default 3). Die
   * zusätzlichen Hypothesen landen als `alternatives` am Segment und helfen B3,
   * eine Form zu finden, die als Gebärde existiert. 1 = altes Verhalten.
   */
  maxAlternatives?: number;
  /**
   * Mindest-Konfidenz (0..1) für FINALE Ergebnisse. Liefert die API für ein
   * finales Ergebnis eine geringere (positive) Konfidenz, wird es als zu
   * unsicher verworfen und NICHT weitergereicht (das zuvor gezeigte Interim
   * bleibt stehen). Default 0 = nichts verwerfen. Interim-Ergebnisse (Konfidenz
   * 0) sind nie betroffen.
   */
  minConfidence?: number;
  /** Recognition-Fabrik (Default: window.SpeechRecognition). */
  createRecognition?: () => SpeechRecognitionLike;
  /** Zeitquelle (Default: Date.now), injizierbar für Tests. */
  now?: () => number;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Mikrofonzugriff verweigert. Bitte erlaube den Zugriff in den Browser-Einstellungen.',
  'service-not-allowed': 'Spracherkennung ist nicht erlaubt. Bitte prüfe die Browser-Einstellungen.',
  'audio-capture': 'Kein Mikrofon gefunden. Bitte schließe ein Mikrofon an.',
  network: 'Netzwerkfehler bei der Spracherkennung.',
};

export class SpeechCapture {
  private recognition: SpeechRecognitionLike | null = null;
  private state: CaptureState = 'idle';
  private userStopped = false;
  private errored = false;
  /** Hochgezählt bei jedem (Re-)Start → eindeutige segmentIds pro Session. */
  private session = 0;

  private readonly lang: string;
  private readonly maxAlternatives: number;
  private readonly minConfidence: number;
  private readonly createRecognition: () => SpeechRecognitionLike;
  private readonly now: () => number;

  private readonly segmentListeners = new Set<SegmentListener>();
  private readonly stateListeners = new Set<StateListener>();

  constructor(options: SpeechCaptureOptions = {}) {
    this.lang = options.lang ?? 'de-DE';
    this.maxAlternatives = Math.max(1, Math.floor(options.maxAlternatives ?? 3));
    this.minConfidence = options.minConfidence ?? 0;
    this.now = options.now ?? (() => Date.now());
    this.createRecognition =
      options.createRecognition ??
      (() => {
        const Ctor = getNativeRecognition();
        if (!Ctor) {
          throw new Error('Web Speech API wird in diesem Browser nicht unterstützt.');
        }
        return new Ctor() as SpeechRecognitionLike;
      });
  }

  /** Ob die Web Speech API im aktuellen Browser verfügbar ist. */
  static isSupported(): boolean {
    return getNativeRecognition() !== null;
  }

  onSegment(cb: SegmentListener): () => void {
    this.segmentListeners.add(cb);
    return () => this.segmentListeners.delete(cb);
  }

  onStateChange(cb: StateListener): () => void {
    this.stateListeners.add(cb);
    return () => this.stateListeners.delete(cb);
  }

  /** Startet die Erkennung. Fehler (z. B. fehlende API) werfen synchron. */
  async start(): Promise<void> {
    this.userStopped = false;
    this.errored = false;
    this.recognition = this.createRecognition();
    this.configure(this.recognition);
    this.session += 1;
    this.setState('listening');
    this.recognition.start();
  }

  /** Stoppt die Erkennung dauerhaft (kein Auto-Restart). */
  stop(): void {
    this.userStopped = true;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        /* ignore */
      }
    }
    this.setState('idle');
  }

  // -- intern ------------------------------------------------------------------

  private configure(rec: SpeechRecognitionLike): void {
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = this.maxAlternatives;

    rec.onresult = (event) => this.handleResult(event);
    rec.onerror = (event) => this.handleError(event.error);
    rec.onend = () => this.handleEnd();
  }

  private handleResult(event: SpeechResultEventLike): void {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (!result || !result[0]) continue;

      const confidence = result[0].confidence;
      // Zu unsichere FINALE Ergebnisse verwerfen (Interim hat Konfidenz 0 und
      // ist nie betroffen). So bleibt eine sichere Interim-Anzeige stehen,
      // statt von einer schlechten finalen Erkennung überschrieben zu werden.
      if (
        result.isFinal &&
        this.minConfidence > 0 &&
        typeof confidence === 'number' &&
        confidence > 0 &&
        confidence < this.minConfidence
      ) {
        continue;
      }

      // Weitere Hypothesen einsammeln (ohne die Primärhypothese), dedupliziert.
      const alternatives: string[] = [];
      for (let a = 1; a < result.length; a += 1) {
        const alt = result[a]?.transcript;
        if (alt && alt !== result[0].transcript && !alternatives.includes(alt)) {
          alternatives.push(alt);
        }
      }

      const segment: TranscriptSegment = {
        text: result[0].transcript,
        isFinal: result.isFinal,
        timestamp: this.now(),
        ...(alternatives.length ? { alternatives } : {}),
        ...(typeof confidence === 'number' ? { confidence } : {}),
      };
      // Stabile Id: Session + Result-Index. Interim-Updates desselben Index
      // behalten dieselbe Id; final ersetzt interim in B5.
      const segmentId = `s${this.session}-${i}`;
      for (const cb of this.segmentListeners) cb(segment, segmentId);
    }
  }

  private handleError(error: string): void {
    if (error === 'no-speech' || error === 'aborted') {
      // Gutartig: onend übernimmt ggf. den Auto-Restart.
      return;
    }
    const message = ERROR_MESSAGES[error] ?? `Spracherkennungsfehler: ${error}`;
    this.errored = true;
    this.setState('error', message);
  }

  private handleEnd(): void {
    if (this.userStopped || this.errored) {
      if (!this.errored) this.setState('idle');
      return;
    }
    // Chrome beendet nach Stille → neu starten, neue Session-Id vergeben.
    if (this.state === 'listening' && this.recognition) {
      this.session += 1;
      try {
        this.recognition.start();
      } catch {
        /* bereits gestartet o. ä. → ignorieren */
      }
    }
  }

  private setState(state: CaptureState, error?: string): void {
    this.state = state;
    for (const cb of this.stateListeners) cb(state, error);
  }
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getNativeRecognition(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
