import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { SettingsService } from "../../services/settings.service";

/**
 * SETTINGS — kleines Panel (Zahnrad) für die B8-Einstellungen: Live-Tempo
 * (msPerSign → B5), Füllwort-Filter (→ B2), hoher Kontrast und Verlaufslänge.
 * Liest/schreibt direkt die Signals des SettingsService (persistiert dort).
 */
@Component({
  selector: "sb-settings",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings">
      <button
        class="icon-btn"
        [class.active]="open()"
        aria-label="Einstellungen"
        title="Einstellungen"
        [attr.aria-expanded]="open()"
        (click)="open.set(!open())"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
          />
        </svg>
      </button>

      @if (open()) {
        <div class="settings-panel" role="dialog" aria-label="Einstellungen">
          <h2>Einstellungen</h2>

          <label class="set-row">
            <span>Tempo <b>{{ settings.msPerSign() }} ms</b></span>
            <input
              type="range"
              min="300"
              max="1200"
              step="50"
              [value]="settings.msPerSign()"
              (input)="settings.msPerSign.set(+$any($event.target).value)"
            />
          </label>

          <label class="set-row">
            <span>Verlaufslänge <b>{{ settings.historyLength() }}</b></span>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              [value]="settings.historyLength()"
              (input)="settings.historyLength.set(+$any($event.target).value)"
            />
          </label>

          <label class="set-row set-check">
            <input
              type="checkbox"
              [checked]="settings.fillerFilter()"
              (change)="settings.fillerFilter.set($any($event.target).checked)"
            />
            <span>Füllwörter filtern <small>(äh, halt, quasi …)</small></span>
          </label>

          <label class="set-row set-check">
            <input
              type="checkbox"
              [checked]="settings.highContrast()"
              (change)="settings.highContrast.set($any($event.target).checked)"
            />
            <span>Hoher Kontrast</span>
          </label>

          <button class="set-reset" (click)="settings.reset()">Zurücksetzen</button>
        </div>
      }
    </div>
  `,
})
export class SettingsComponent {
  readonly settings = inject(SettingsService);
  readonly open = signal(false);
}
