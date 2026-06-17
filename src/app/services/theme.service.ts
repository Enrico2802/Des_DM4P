import { inject, Injectable, signal } from "@angular/core";
import { ThemeMode } from "../models/gloss.model";
import { SoundService } from "./sound.service";

/**
 * THEME — resolves system → light/dark and persists the user's choice.
 * Mirrors the initTheme()/applyTheme() block from the original app.js.
 */
@Injectable({ providedIn: "root" })
export class ThemeService {
  private static readonly KEY = "signbridge:theme";
  private readonly sound = inject(SoundService);
  private readonly root = document.documentElement;

  /** The resolved theme actually applied to <html>. */
  readonly resolved = signal<"light" | "dark">("light");

  constructor() {
    const saved =
      (localStorage.getItem(ThemeService.KEY) as ThemeMode) || "system";
    this.apply(saved);

    // React to OS changes only while still in "system" mode.
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        const mode =
          (localStorage.getItem(ThemeService.KEY) as ThemeMode) || "system";
        if (mode === "system") this.apply("system");
      });
  }

  private systemTheme(): "light" | "dark" {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  /** Apply a theme mode without persisting (used for system updates). */
  apply(mode: ThemeMode): void {
    const resolved = mode === "system" ? this.systemTheme() : mode;
    this.root.setAttribute("data-theme", resolved);
    this.resolved.set(resolved);
  }

  /** Persist + apply an explicit theme. */
  set(mode: ThemeMode): void {
    localStorage.setItem(ThemeService.KEY, mode);
    this.apply(mode);
  }

  /** Flip between light and dark (top-bar toggle). */
  toggle(): void {
    this.sound.playClick();

    this.set(this.resolved() === "dark" ? "light" : "dark");
  }
}
