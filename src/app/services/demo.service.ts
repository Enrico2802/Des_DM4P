import { Injectable, computed, signal } from '@angular/core';

/**
 * DEMO-MODUS (offline) — spielt EIN festes Beispielvideo (.mov) ab und schaltet
 * die DGS-Glossen darunter zeitgesteuert weiter, OHNE Spracherkennung,
 * Wörterbuch oder sonstige API-Aufrufe.
 *
 * Das Video liegt unter /public/demo/demo.mov (Hintergrund schwarz) und enthält
 * die komplette gebärdete Phrase am Stück (~17 s). Der {@link DemoPlayerComponent}
 * blendet ein Overlay ein, zeigt {@link sentence} als Transkript, spielt das Video
 * und hebt anhand der Wiedergabeposition die passende Glosse in {@link glosses}
 * hervor — die Labels werden also gleichmäßig über die Videolänge verteilt.
 */
@Injectable({ providedIn: 'root' })
export class DemoService {
  /** Der gesprochene Beispielsatz, der im Demo-Modus als Transkript erscheint. */
  readonly sentence =
    'Wie ich es mir gedacht habe allein schon die Frage, die ich gerade ' +
    'bekommen habe: Dann habt ihr es nicht verstanden, und gleichzeitig frage ' +
    'ich mich, ob ihr überhaupt zuhört.';

  /** Pfad zum einzelnen Demo-Video unter /public/demo. */
  readonly videoUrl = '/demo/demo.mov';

  /**
   * Die DGS-Glossen in der Reihenfolge des Videos. Entspricht der Glossen-Notation
   * „Wie ich gedacht habe die Frage zeigt alle haben nicht verstanden |
   *   ich frage mich ob ihr zuhört". Das „|" markiert dabei nur die Phrasen-
   * grenze und ist kein eigenes Zeichen. Die Labels werden zeitlich gleichmäßig
   * über die Videolänge (~17 s) verteilt.
   */
  readonly glosses: readonly string[] = [
    'Wie', 'ich', 'gedacht', 'habe', 'die', 'Frage', 'zeigt', 'alle', 'haben',
    'nicht', 'verstanden', 'ich', 'frage', 'mich', 'ob', 'ihr', 'zuhört',
  ];

  /** Ob der Demo-Modus gerade läuft (steuert das Overlay). */
  readonly active = signal(false);
  /** Index der aktuell hervorgehobenen Glosse in {@link glosses}. */
  readonly index = signal(0);
  /** Ob das Video durchgelaufen ist (letztes Bild bleibt stehen). */
  readonly finished = signal(false);

  /** Aktuell hervorgehobene Glosse (null außerhalb des Demo-Modus). */
  readonly currentLabel = computed<string | null>(() => this.glosses[this.index()] ?? null);

  /** Demo-Modus von vorne starten. */
  start(): void {
    this.index.set(0);
    this.finished.set(false);
    this.active.set(true);
  }

  /** Demo-Modus beenden und Overlay schließen. */
  stop(): void {
    this.active.set(false);
    this.finished.set(false);
    this.index.set(0);
  }

  /**
   * Glosse zur aktuellen Wiedergabeposition setzen. `progress` ist der Anteil
   * 0…1 (currentTime / duration); daraus wird der Label-Index abgeleitet, sodass
   * die Glossen gleichmäßig über die Videolänge durchlaufen.
   */
  syncToProgress(progress: number): void {
    const n = this.glosses.length;
    const i = Math.min(n - 1, Math.max(0, Math.floor(progress * n)));
    if (i !== this.index()) this.index.set(i);
  }

  /** Vom `ended`-Event des Videos: Sequenz ist durchgelaufen. */
  finish(): void {
    this.index.set(this.glosses.length - 1);
    this.finished.set(true);
  }

  /** Das Video erneut von vorne abspielen. */
  replay(): void {
    this.finished.set(false);
    this.index.set(0);
  }
}
