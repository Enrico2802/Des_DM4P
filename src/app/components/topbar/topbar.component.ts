import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { ThemeService } from "../../services/theme.service";
import { SettingsComponent } from "../settings/settings.component";

@Component({
  selector: "sb-topbar",
  standalone: true,
  imports: [SettingsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none">
            <path
              d="M4 19c4-9 16-9 20 0"
              stroke="#fff"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <path
              d="M9 19v-3M19 19v-3"
              stroke="#fff"
              stroke-width="2.2"
              stroke-linecap="round"
            />
            <path
              d="M3 19h22"
              stroke="#fff"
              stroke-width="2.2"
              stroke-linecap="round"
            />
          </svg>
        </span>
        <span class="brand-name">Signbridge</span>
        <span class="badge">DGS</span>
      </div>
      <div class="topbar-actions">
        <sb-settings />
        <button
          class="icon-btn theme-toggle"
          aria-label="Helles / dunkles Thema umschalten"
          title="Thema umschalten"
          (click)="theme.toggle()"
        >
          <svg
            class="sun"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <circle cx="12" cy="12" r="4.5" />
            <path
              d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"
            />
          </svg>
          <svg
            class="moon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5z" />
          </svg>
        </button>
      </div>
    </header>
  `,
})
export class TopbarComponent {
  readonly theme = inject(ThemeService);
}
