/**
 * Demo-Modus (Prompt 7).
 *
 * Speist eine vordefinierte deutsche Beispielrede (Vorlesungs-Q&A wie im
 * Persona-Szenario) zeitgesteuert als TranscriptSegments in die Pipeline —
 * ohne Mikrofon. Aktivierbar über ?demo=1.
 *
 * Zeigt End-to-End: Interim-Korrekturen (gleiche segmentId, isFinal-Wechsel),
 * Fingerspelling unbekannter Wörter und Backpressure bei schnellem Tempo.
 */
import type { TranscriptSegment } from '../types';

export interface DemoStep {
  /** Verzögerung in ms relativ zum Start. */
  at: number;
  /** Segment-Id — gleiche Id = Interim-Korrektur desselben Satzes. */
  segmentId: string;
  text: string;
  isFinal: boolean;
}

/**
 * Skript: erst ein interim (unvollständiger/fehlerhafter) Treffer, kurz darauf
 * die finale Korrektur mit derselben segmentId.
 */
export const DEMO_SCRIPT: readonly DemoStep[] = [
  { at: 400, segmentId: 'd1', text: 'guten', isFinal: false },
  { at: 900, segmentId: 'd1', text: 'guten tag zusammen', isFinal: true },

  { at: 2600, segmentId: 'd2', text: 'ich habe eine', isFinal: false },
  { at: 3200, segmentId: 'd2', text: 'ich habe eine frage zur prüfung', isFinal: true },

  { at: 5200, segmentId: 'd3', text: 'die vorlesung', isFinal: false },
  { at: 5900, segmentId: 'd3', text: 'die vorlesung über barrierefreiheit', isFinal: true },

  // "Lavinia" steht nicht im Wörterbuch -> wird fingerbuchstabiert.
  { at: 7800, segmentId: 'd4', text: 'die professorin heißt', isFinal: false },
  { at: 8500, segmentId: 'd4', text: 'die professorin heißt Lavinia', isFinal: true },

  { at: 10500, segmentId: 'd5', text: 'danke für die antwort', isFinal: true },
];

/** Aufräum-Funktion: bricht einen laufenden Demo-Lauf ab. */
export type StopDemo = () => void;

/**
 * Spielt {@link DEMO_SCRIPT} gegen `feed` ab.
 *
 * @param feed   Segment-Einspeiser (z. B. `api.feedSegment`).
 * @param script optionales eigenes Skript.
 * @returns Funktion zum Abbrechen.
 */
export function runDemo(
  feed: (segment: TranscriptSegment, segmentId: string) => void,
  script: readonly DemoStep[] = DEMO_SCRIPT,
): StopDemo {
  const handles: ReturnType<typeof setTimeout>[] = [];
  for (const step of script) {
    handles.push(
      setTimeout(() => {
        feed({ text: step.text, isFinal: step.isFinal, timestamp: Date.now() }, step.segmentId);
      }, step.at),
    );
  }
  return () => handles.forEach((h) => clearTimeout(h));
}
