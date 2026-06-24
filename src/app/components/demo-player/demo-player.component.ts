import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DemoService } from '../../services/demo.service';

/**
 * DEMO-PLAYER — Vollflächiges Overlay für den Offline-Demo-Modus.
 *
 * Zeigt {@link DemoService.sentence} als Transkript und spielt EIN einzelnes
 * Demo-Video ({@link DemoService.videoUrl}) am Stück auf schwarzem Hintergrund ab.
 * Die DGS-Glossen ({@link DemoService.glosses}) darunter werden anhand der
 * Wiedergabeposition des Videos durchlaufen: das `timeupdate`-Event meldet den
 * Fortschritt (currentTime / duration) an {@link DemoService.syncToProgress}, das
 * daraus die passende Glosse ableitet. So bleibt die Hervorhebung synchron zur
 * Videolänge (~17 s), ohne feste Clip-Längen. Keine API-/Pipeline-Aufrufe.
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
          <video
            #video
            class="demo-video"
            [src]="demo.videoUrl"
            autoplay
            muted
            playsinline
            (timeupdate)="onTimeUpdate()"
            (ended)="demo.finish()"
          ></video>
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
          <span class="demo-gloss">{{ demo.currentLabel() }}</span>
          <span class="demo-progress">{{ demo.index() + 1 }} / {{ demo.glosses.length }}</span>
        </div>

        <div class="demo-track" aria-hidden="true">
          @for (g of demo.glosses; track $index) {
            <span
              class="demo-chip"
              [class.active]="$index === demo.index()"
              [class.done]="$index < demo.index()"
              >{{ g }}</span
            >
          }
        </div>
      </div>
    }
  `,
})
export class DemoPlayerComponent {
  readonly demo = inject(DemoService);

  @ViewChild('video') private video?: ElementRef<HTMLVideoElement>;

  constructor() {
    // Wiedergabe von vorn starten, sobald die Sequenz läuft (Start oder Replay).
    // Beim ersten Anzeigen deckt `autoplay` das ab; nach einem Replay (Element
    // existiert bereits) erzwingt der Effekt das Zurückspulen und erneute Abspielen.
    effect(() => {
      const running = this.demo.active() && !this.demo.finished();
      if (!running) return;
      const el = this.video?.nativeElement;
      if (!el) return;
      el.currentTime = 0;
      void el.play().catch(() => {
        /* Autoplay-Policy / fehlende Datei — ignoriert, die Glossen folgen dem Video. */
      });
    });
  }

  /**
   * Bei jedem `timeupdate` die hervorgehobene Glosse an die Wiedergabeposition
   * koppeln. Solange die Videolänge noch unbekannt ist (NaN/0), passiert nichts.
   */
  onTimeUpdate(): void {
    const el = this.video?.nativeElement;
    if (!el || !isFinite(el.duration) || el.duration <= 0) return;
    this.demo.syncToProgress(el.currentTime / el.duration);
  }
}
