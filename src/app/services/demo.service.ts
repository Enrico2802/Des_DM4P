import { Injectable, computed, signal } from '@angular/core';

/** Ein einzelnes DGS-Zeichen des Demo-Modus als Videoclip. */
export interface DemoClip {
  /** Beschriftung (Originalwort) für Caption + Fortschrittsleiste. */
  label: string;
  /** Pfad zur .mov-Datei unter /public/demo. */
  videoUrl: string;
}

/**
 * DEMO-MODUS (offline) — spielt einen festen Beispielsatz als Folge von
 * DGS-Zeichen ab, OHNE Spracherkennung, Wörterbuch oder sonstige API-Aufrufe.
 *
 * Die Zeichen liegen als .mov-Dateien in /public/demo (Hintergrund ausgekeyed,
 * in unserem Fall schlicht schwarz). Der {@link DemoPlayerComponent} blendet ein
 * Overlay ein, zeigt {@link sentence} als Transkript und spielt {@link glosses}
 * der Reihe nach ab — jeweils beim `ended`-Event des Videos das nächste Zeichen.
 */
@Injectable({ providedIn: 'root' })
export class DemoService {
  /** Der gesprochene Beispielsatz, der im Demo-Modus als Transkript erscheint. */
  readonly sentence =
    'Wie ich es mir gedacht habe allein schon die Frage, die ich gerade ' +
    'bekommen habe: Dann habt ihr es nicht verstanden, und gleichzeitig frage ' +
    'ich mich, ob ihr überhaupt zuhört.';

  /**
   * Die DGS-Zeichenfolge als .mov-Clips. Entspricht der Glossen-Notation
   * „Wie ich gedacht habe die Frage zeigt alle haben nicht verstanden |
   *   ich frage mich ob ihr zuhört". Das „|" markiert dabei nur die Phrasen-
   * grenze und ist kein eigenes Zeichen.
   */
  readonly glosses: readonly DemoClip[] = [
    { label: 'Wie', videoUrl: '/demo/wie.mov' },
    { label: 'ich', videoUrl: '/demo/ich.mov' },
    { label: 'gedacht', videoUrl: '/demo/gedacht.mov' },
    { label: 'habe', videoUrl: '/demo/habe.mov' },
    { label: 'die', videoUrl: '/demo/die.mov' },
    { label: 'Frage', videoUrl: '/demo/frage.mov' },
    { label: 'zeigt', videoUrl: '/demo/zeigt.mov' },
    { label: 'alle', videoUrl: '/demo/alle.mov' },
    { label: 'haben', videoUrl: '/demo/haben.mov' },
    { label: 'nicht', videoUrl: '/demo/nicht.mov' },
    { label: 'verstanden', videoUrl: '/demo/verstanden.mov' },
    { label: 'ich', videoUrl: '/demo/ich.mov' },
    { label: 'frage', videoUrl: '/demo/frage.mov' },
    { label: 'mich', videoUrl: '/demo/mich.mov' },
    { label: 'ob', videoUrl: '/demo/ob.mov' },
    { label: 'ihr', videoUrl: '/demo/ihr.mov' },
    { label: 'zuhört', videoUrl: '/demo/zuhoert.mov' },
  ];

  /**
   * Ziel-Gesamtdauer der Zeichenfolge in ms (im gewünschten Bereich ~8–12 s).
   * Die Anzeigedauer pro Zeichen ({@link msPerClip}) wird daraus abgeleitet, damit
   * die Wiedergabe unabhängig von den einzelnen Clip-Längen gleichmäßig läuft.
   */
  readonly totalDurationMs = 4_000;

  /** Anzeigedauer eines einzelnen Zeichens (Gesamtdauer / Anzahl Zeichen). */
  get msPerClip(): number {
    return Math.round(this.totalDurationMs / this.glosses.length);
  }

  /** Ob der Demo-Modus gerade läuft (steuert das Overlay). */
  readonly active = signal(false);
  /** Index des aktuell abgespielten Zeichens in {@link glosses}. */
  readonly index = signal(0);
  /** Ob die Sequenz durchgelaufen ist (letztes Bild bleibt stehen). */
  readonly finished = signal(false);

  /** Aktuell abzuspielender Clip (null außerhalb des Demo-Modus). */
  readonly currentClip = computed<DemoClip | null>(() => this.glosses[this.index()] ?? null);

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
   * Nächstes Zeichen abspielen (vom Video `ended`-Event getriggert). Am Ende der
   * Sequenz wird angehalten und {@link finished} gesetzt — das letzte Bild bleibt
   * stehen, bis erneut abgespielt oder geschlossen wird.
   */
  next(): void {
    const i = this.index();
    if (i < this.glosses.length - 1) this.index.set(i + 1);
    else this.finished.set(true);
  }

  /** Die Zeichenfolge erneut von vorne abspielen. */
  replay(): void {
    this.finished.set(false);
    this.index.set(0);
  }
}
