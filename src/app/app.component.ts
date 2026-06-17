import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { TopbarComponent } from "./components/topbar/topbar.component";
import { InputZoneComponent } from "./components/input-zone/input-zone.component";
import { OutputZoneComponent } from "./components/output-zone/output-zone.component";
import { SessionService } from "./services/session.service";

/**
 * App-Shell: Input → Pipeline → Output. Verdrahtet wird ausschließlich über die
 * `SessionService` (B7), die Mikrofon (B1), Pipeline (B0/B2/B3/B4) und Timing
 * (B5) orchestriert.
 */
@Component({
  selector: "sb-root",
  standalone: true,
  imports: [TopbarComponent, InputZoneComponent, OutputZoneComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app" data-screen-label="Signbridge main">
      <sb-topbar />
      <main class="main">
        <sb-input-zone (text)="onText($event)" />
        <sb-output-zone
          [items]="session.items()"
          [live]="session.recording()"
          [current]="session.current()"
          [liveHistory]="session.liveHistory()"
          animMode="gentle"
          [transcript]="session.transcript()"
          [transcriptIsPlaceholder]="session.isPlaceholder()"
        />
      </main>
    </div>
  `,
})
export class AppComponent {
  readonly session = inject(SessionService);

  /** Getippter oder hochgeladener Text → echte Übersetzungspipeline. */
  onText(text: string): void {
    this.session.submitText(text);
  }
}
