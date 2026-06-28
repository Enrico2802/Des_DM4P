import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
} from "@angular/core";
import { SessionService } from "../../services/session.service";
import { DemoService } from "../../services/demo.service";

/**
 * INPUT ZONE — Mikrofon (echte Spracherkennung über die SessionService/B1) +
 * Texteingabe + .txt-Upload. Mikrofon wird direkt an der Session gesteuert;
 * getippter/hochgeladener Text wird nach oben emittiert.
 */
@Component({
  selector: "sb-input-zone",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="input-zone">
      <h1 class="headline">
        <span>Sprich.</span><span class="accent">Wir gebärden.</span>
      </h1>
      <p class="subhead">
        Echtzeit-Übersetzung gesprochener Sprache in Deutsche Gebärdensprache (DGS).
      </p>

      <div class="mic-wrap" [class.recording]="session.recording()">
        <span class="pulse-ring"></span>
        <span class="pulse-ring"></span>
        <span class="pulse-ring"></span>
        <button
          class="mic-btn"
          [attr.aria-label]="
            session.recording() ? 'Aufnahme stoppen' : 'Aufnahme starten'
          "
          (click)="session.toggleMic()"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect
              x="9"
              y="2.5"
              width="6"
              height="11.5"
              rx="3"
              fill="currentColor"
              stroke="none"
            />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
            <path d="M12 17.5V21M8.5 21h7" />
          </svg>
        </button>
        <div class="listening" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>
      <div class="mic-hint">
        {{
          session.recording()
            ? "Höre zu …"
            : session.supported
              ? "Zum Sprechen tippen"
              : "Spracherkennung hier nicht verfügbar — bitte Text eingeben"
        }}
      </div>

      <div class="alt-input">
        <span class="divider-or">oder</span>

        <form class="text-input" (submit)="submitText(field); $event.preventDefault()">
          <input
            #field
            type="text"
            name="phrase"
            autocomplete="off"
            placeholder="Text eingeben, z. B. „hallo danke"
            aria-label="Text zum Übersetzen eingeben"
          />
          <button type="submit">Übersetzen</button>
        </form>

        <label class="upload-btn">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 16V4M8 8l4-4 4 4" />
            <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Textdatei hochladen
          <input
            type="file"
            accept=".txt,text/plain"
            hidden
            (change)="onFile($event)"
          />
        </label>

        <button type="button" class="demo-btn" (click)="startDemo()">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M8 5v14l11-7z" fill="currentColor" stroke="none" />
          </svg>
          Demo abspielen
        </button>
      </div>
    </section>
  `,
})
export class InputZoneComponent {
  readonly session = inject(SessionService);
  private readonly demo = inject(DemoService);

  /** Emittiert getippten oder hochgeladenen Text. */
  @Output() readonly text = new EventEmitter<string>();

  /** Offline-Demo starten — stoppt vorher eine laufende Aufnahme. */
  startDemo(): void {
    if (this.session.recording()) this.session.stop();
    this.demo.start();
  }

  submitText(field: HTMLInputElement): void {
    const value = field.value.trim();
    if (!value) return;
    this.text.emit(value);
    field.value = "";
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "").trim();
      if (text) this.text.emit(text);
    };
    reader.readAsText(file);
    input.value = ""; // erlaubt erneutes Hochladen derselben Datei
  }
}
