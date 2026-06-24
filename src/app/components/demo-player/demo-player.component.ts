import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DemoService } from '../../services/demo.service';

/**
 * DEMO-PLAYER — Vollflächiges Overlay für den Offline-Demo-Modus.
 *
 * Zeigt {@link DemoService.sentence} als Transkript und spielt die DGS-Zeichen
 * ({@link DemoService.glosses}) als .mov-Dateien nacheinander auf schwarzem
 * Hintergrund ab. Die Taktung ist zeitgesteuert: jedes Zeichen bekommt ein festes
 * Fenster von {@link DemoService.msPerClip} ms, sodass die gesamte Folge unabhängig
 * von den einzelnen Clip-Längen ~{@link DemoService.totalDurationMs} ms dauert. Das
 * Video läuft im Loop innerhalb seines Fensters; eine fehlende Datei zeigt für ihr
 * Fenster einfach Schwarz. Keine API-/Pipeline-Aufrufe.
 */
@Component({
  selector: 'sb-demo-player',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (demo.active()) {
      <div class="demo-overlay" role="dialog" aria-modal="true" aria-label="Demo-Modus">
        <button class="demo-close" (click)="demo.stop()" aria-label="Demo schließen" title="Schließen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div class="demo-transcript">
          <span class="tlabel">Gesprochen</span>
          <p class="ttext">{{ demo.sentence }}</p>
        </div>

        <div class="demo-stage">
          @if (demo.currentClip(); as clip) {
            <video
              #video
              class="demo-video"
              [src]="clip.videoUrl"
              autoplay
              muted
              loop
              playsinline
            ></video>
          }
          @if (demo.finished()) {
            <button class="demo-replay" (click)="demo.replay()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v4h4" />
              </svg>
              Erneut abspielen
            </button>
          }
        </div>

        <div class="demo-caption">
          <span class="demo-gloss">{{ demo.currentClip()?.label }}</span>
          <span class="demo-progress">{{ demo.index() + 1 }} / {{ demo.glosses.length }}</span>
        </div>

        <div class="demo-track" aria-hidden="true">
          @for (g of demo.glosses; track $index) {
            <span
              class="demo-chip"
              [class.active]="$index === demo.index()"
              [class.done]="$index < demo.index()"
              >{{ g.label }}</span
            >
          }
        </div>
      </div>
    }
  `,
})
export class DemoPlayerComponent implements OnDestroy {
  readonly demo = inject(DemoService);

  @ViewChild('video') private video?: ElementRef<HTMLVideoElement>;

  /** Timer für das getaktete Weiterschalten zum nächsten Zeichen. */
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // Bei jedem Zeichen-Wechsel das Video neu von vorn starten. `[src]` + autoplay
    // deckt das erste Zeichen ab; für die folgenden erzwingt der Effekt load()+play().
    effect(() => {
      this.demo.index();
      const el = this.video?.nativeElement;
      if (!el) return;
      el.currentTime = 0;
      el.load();
      void el.play().catch(() => {
        /* Autoplay-Policy / fehlende Datei — ignoriert, der Timer treibt weiter. */
      });
    });

    // Getaktetes Weiterschalten: pro Zeichen ein festes Zeitfenster. Reagiert auf
    // index (neu planen), active/finished (starten bzw. stoppen).
    effect(() => {
      this.demo.index();
      const running = this.demo.active() && !this.demo.finished();
      this.clearAdvanceTimer();
      if (running) {
        this.advanceTimer = setTimeout(() => this.demo.next(), this.demo.msPerClip);
      }
    });
  }

  ngOnDestroy(): void {
    this.clearAdvanceTimer();
  }

  private clearAdvanceTimer(): void {
    if (this.advanceTimer) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = null;
    }
  }
}
