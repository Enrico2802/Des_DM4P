import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  SimpleChanges,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import anime from "animejs";
import { AnimMode, LayoutMode } from "../../models/gloss.model";
import { SoundService } from "../../services/sound.service";
import type { FingerLetter, SignItem } from "../../../engine/types";

/**
 * OUTPUT ZONE — Transkript-Kopf, Layout-Umschalter, Replay und der animierte
 * Gebärden-Renderer. Stellt jetzt echte `SignItem`s der Engine dar
 * (Gebärdenbild bei `sign`, Buchstabenstreifen bei `fingerspell`, Platzhalter
 * bei `unknown`) statt der früheren Gloss-Text-Karten. Entrance- und
 * „Lese"-Animationen laufen weiter über anime.js.
 *
 * Zwei Modi:
 *  - **Batch** (`live = false`): Grid/Sequence/Focus über `items`.
 *  - **Live** (`live = true`): von B5 gestreamte `current` + `liveHistory`.
 */
@Component({
  selector: "sb-output-zone",
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./output-zone.component.html",
})
export class OutputZoneComponent implements OnChanges {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly sound = inject(SoundService);

  private readonly reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  // ---- inputs ----

  /** Batch-Gebärdenfolge (getippter/hochgeladener Text). */
  @Input() items: SignItem[] = [];
  /** Live-Modus aktiv (Mikrofon, B5-Stream). */
  @Input() live = false;
  /** Live: aktuell gestreamte Gebärde. */
  @Input() current: SignItem | null = null;
  /** Live: bereits gestreamter Verlauf. */
  @Input() liveHistory: SignItem[] = [];

  @Input() animMode: AnimMode = "gentle";
  @Input() transcript = "Warte auf Eingabe…";
  @Input() transcriptIsPlaceholder = true;

  // ---- view state ----
  readonly layout = signal<LayoutMode>("grid");
  readonly playingIndex = signal(-1);
  readonly focusIndex = signal(0);
  readonly speed = signal(1);
  readonly focusPlaying = signal(false);

  private playTimer: ReturnType<typeof setInterval> | null = null;
  private stepTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastFocusIndex = -1;

  // ---- SignItem-Helfer (robust gegen strictTemplates statt Template-Narrowing) ----

  /** Bildpfad einer Wörterbuch-Gebärde, sonst null. */
  imageOf(item: SignItem): string | null {
    return item.kind === "sign" ? item.imageUrl : null;
  }

  /** Fingeralphabet-Buchstaben, sonst leer. */
  lettersOf(item: SignItem): FingerLetter[] {
    return item.kind === "fingerspell" ? item.letters : [];
  }

  /** Original-Wort (Beschriftung der Karte). */
  labelOf(item: SignItem): string {
    return item.token.raw;
  }

  /** Badge-Text je nach Art der Auflösung. */
  tagOf(item: SignItem): string {
    if (item.kind === "fingerspell") return "FINGER";
    if (item.kind === "unknown") return "?";
    return "DGS";
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.live) {
      // Live-Modus: B5 taktet selbst, kein Batch-Render.
      this.clearTimers();
      this.playingIndex.set(-1);
      return;
    }
    if (changes["items"] || (changes["animMode"] && this.items.length)) {
      this.lastFocusIndex = -1;
      queueMicrotask(() => this.render(true));
    }
  }

  // ============================================================
  //  Layout switch + replay
  // ============================================================
  setLayout(mode: LayoutMode): void {
    if (this.layout() === mode) return;

    this.sound.playClick();
    this.layout.set(mode);
    this.lastFocusIndex = -1;

    queueMicrotask(() => this.render(true));
  }

  replay(): void {
    if (!this.items.length) return;

    this.sound.playClick();
    this.lastFocusIndex = -1;
    this.render(true);
  }

  // ============================================================
  //  Render
  // ============================================================

  setSpeed(value: string | number): void {
    const parsed = Number(value);
    this.speed.set(Math.min(2, Math.max(0.5, parsed)));

    if (this.items.length) {
      queueMicrotask(() => this.render(false));
    }
  }

  playSpeedClick(): void {
    this.sound.playClick();
  }

  private clearTimers(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }

    if (this.stepTimeout) {
      clearTimeout(this.stepTimeout);
      this.stepTimeout = null;
    }
  }

  private render(animate: boolean): void {
    this.clearTimers();
    this.playingIndex.set(-1);

    if (!this.items.length) return;

    if (this.layout() === "focus") {
      this.renderFocus(animate);
      return;
    }

    const cards =
      this.host.nativeElement.querySelectorAll<HTMLElement>(".signs .sign");

    if (!cards.length) return;

    if (animate && !this.reduceMotion && anime) {
      this.zone.runOutsideAngular(() => {
        if (this.animMode === "read") {
          anime.set(cards, { opacity: 0 });
          anime({
            targets: cards,
            opacity: [0, 1],
            duration: 300,
            easing: "linear",
            delay: anime.stagger(45),
            complete: () => this.playThrough(cards.length),
          });
        } else if (this.animMode === "playful") {
          anime.set(cards, { opacity: 0, translateY: 26, scale: 0.82 });
          anime({
            targets: cards,
            opacity: [0, 1],
            translateY: [26, 0],
            scale: [0.82, 1],
            duration: 560,
            easing: "easeOutBack",
            delay: anime.stagger(70),
            complete: () => this.playThrough(cards.length),
          });
        } else {
          anime.set(cards, { opacity: 0, translateY: 16 });
          anime({
            targets: cards,
            opacity: [0, 1],
            translateY: [16, 0],
            duration: 480,
            easing: "easeOutCubic",
            delay: anime.stagger(85),
            complete: () => this.playThrough(cards.length),
          });
        }
      });
    } else {
      this.playThrough(cards.length);
    }
  }

  /** Sequential "reading" highlight after the cards have appeared. */

  private playThrough(count: number): void {
    this.clearTimers();

    if (this.reduceMotion || !count) return;

    let k = 0;

    const step = () => {
      if (k < count) {
        this.zone.run(() => {
          this.playingIndex.set(k);
          this.sound.playPop();
        });

        k++;
      } else {
        this.zone.run(() => this.playingIndex.set(-1));
        this.clearTimers();
      }
    };

    this.stepTimeout = setTimeout(() => {
      step();

      const baseSpeed = this.animMode === "read" ? 820 : 620;
      this.playTimer = setInterval(step, baseSpeed / this.speed());
    }, 280);
  }

  // ============================================================
  //  FOCUS layout
  // ============================================================
  private renderFocus(animate: boolean): void {
    this.showFocus(0, animate, false);

    if (animate) {
      this.toggleFocusPlay(true);
    }
  }

  showFocus(i: number, withAnim: boolean, playSound = true): void {
    const n = this.items.length;
    if (!n) return;

    const nextIndex = ((i % n) + n) % n;

    if (
      playSound &&
      this.lastFocusIndex !== -1 &&
      this.lastFocusIndex !== nextIndex
    ) {
      this.sound.playPop();
    }

    this.lastFocusIndex = nextIndex;
    this.focusIndex.set(nextIndex);

    if (withAnim && !this.reduceMotion && anime) {
      queueMicrotask(() => {
        const card =
          this.host.nativeElement.querySelector<HTMLElement>(
            ".focus-stage .sign",
          );

        if (card) {
          this.zone.runOutsideAngular(() =>
            anime({
              targets: card,
              opacity: [0, 1],
              scale: [0.9, 1],
              duration: 360,
              easing: "easeOutCubic",
            }),
          );
        }
      });
    }
  }

  focusPrev(): void {
    this.stopFocusPlay();
    this.showFocus(this.focusIndex() - 1, true, true);
  }

  focusNext(): void {
    this.stopFocusPlay();
    this.showFocus(this.focusIndex() + 1, true, true);
  }

  focusGoto(i: number): void {
    this.stopFocusPlay();
    this.showFocus(i, true, true);
  }

  toggleFocusPlay(forceStart = false): void {
    if (!forceStart) {
      this.sound.playClick();
    }

    if (this.playTimer && !forceStart) {
      this.stopFocusPlay();
      return;
    }

    this.clearTimers();
    this.focusPlaying.set(true);
    this.showFocus(0, true, false);

    this.playTimer = setInterval(() => {
      if (this.focusIndex() >= this.items.length - 1) {
        this.zone.run(() => this.stopFocusPlay());
        return;
      }

      this.zone.run(() => this.showFocus(this.focusIndex() + 1, true, true));
    }, 760 / this.speed());
  }

  private stopFocusPlay(): void {
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }

    this.focusPlaying.set(false);
  }
}
