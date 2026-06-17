import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { SoundService } from './sound.service';
import { SpeechCapture } from '../../engine/speech';

/** Ein erkanntes Sprachsegment (interim oder final) mit stabiler Segment-Id. */
export interface RecognizedSegment {
  text: string;
  isFinal: boolean;
  segmentId: string;
}

/**
 * RECOGNITION — echte Spracherkennung über die Engine-Klasse B1 `SpeechCapture`
 * (Web Speech API, Sprache de-DE). Ersetzt den früheren Mock, der nur englische
 * Beispielsätze abspielte.
 *
 * Liefert pro Result-Index eine stabile `segmentId`, damit die Pipeline (B5)
 * Interim-Ergebnisse desselben Satzes gezielt ersetzen kann.
 */
@Injectable({ providedIn: 'root' })
export class RecognitionService {
  private readonly sound = inject(SoundService);
  private readonly zone = inject(NgZone);
  private readonly capture = new SpeechCapture({ lang: 'de-DE' });

  /** Ob die Web Speech API im aktuellen Browser verfügbar ist (sonst Text-Fallback). */
  readonly supported = SpeechCapture.isSupported();
  /** Ob gerade zugehört wird. */
  readonly recording = signal(false);

  private readonly segment$ = new Subject<RecognizedSegment>();
  private readonly error$ = new Subject<string>();

  constructor() {
    // WICHTIG: Die Web Speech API feuert ihre Events (onresult/onend/onerror)
    // außerhalb der Angular-Zone — zone.js patcht SpeechRecognition nicht. Ohne
    // `zone.run` würden Signal-Updates (und der nachgelagerte B5-Timer) keine
    // Change Detection auslösen, sodass die Live-Anzeige erst beim nächsten
    // Zone-Event (z. B. Mikrofon-Klick) erschiene. `zone.run` zieht die gesamte
    // Pipeline (inkl. B5-setTimeout) in die Angular-Zone → Echtzeit-Anzeige.
    this.capture.onSegment((segment, segmentId) => {
      this.zone.run(() => {
        this.segment$.next({ text: segment.text, isFinal: segment.isFinal, segmentId });
      });
    });
    this.capture.onStateChange((state, error) => {
      this.zone.run(() => {
        this.recording.set(state === 'listening');
        if (state === 'error') {
          this.sound.playMicStop();
          this.error$.next(error ?? 'Unbekannter Spracherkennungsfehler.');
        }
      });
    });
  }

  /** Strom erkannter Segmente (interim + final). */
  get segments(): Observable<RecognizedSegment> {
    return this.segment$.asObservable();
  }

  /** Strom von Fehlermeldungen der Spracherkennung. */
  get errors(): Observable<string> {
    return this.error$.asObservable();
  }

  /** Startet die Erkennung. Wirft nicht — Fehler kommen über {@link errors}. */
  async start(): Promise<void> {
    if (!this.supported) {
      this.error$.next(
        'Web Speech API wird in diesem Browser nicht unterstützt (am besten Chrome/Edge). ' +
          'Du kannst stattdessen das Texteingabefeld nutzen.',
      );
      return;
    }
    this.sound.playMicStart();
    try {
      await this.capture.start();
    } catch (e) {
      this.error$.next((e as Error).message);
    }
  }

  /** Stoppt die Erkennung dauerhaft. */
  stop(): void {
    this.capture.stop();
    this.sound.playMicStop();
  }

  toggle(): void {
    if (this.recording()) this.stop();
    else void this.start();
  }
}
