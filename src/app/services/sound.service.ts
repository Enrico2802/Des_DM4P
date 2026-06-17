import { Injectable, signal } from "@angular/core";

@Injectable({
  providedIn: "root",
})
export class SoundService {
  readonly enabled = signal(true);
  readonly volume = signal(0.6);

  private readonly audioCache = new Map<string, HTMLAudioElement>();

  private readonly sounds = {
    click: "assets/sounds/click.aac",
    pop: "assets/sounds/pop.aac",
    success: "assets/sounds/success.aac",
    error: "assets/sounds/error.aac",
    micStart: "assets/sounds/mic-start.aac",
    micStop: "assets/sounds/mic-stop.aac",
    recognized: "assets/sounds/recognized.aac",
  };

  constructor() {
    this.preloadAll();
  }

  preloadAll(): void {
    Object.values(this.sounds).forEach((path) => {
      this.preload(path);
    });
  }

  private preload(path: string): void {
    if (this.audioCache.has(path)) return;

    const audio = new Audio(path);
    audio.preload = "auto";
    audio.load();

    this.audioCache.set(path, audio);
  }

  play(path: string): void {
    if (!this.enabled()) return;

    const cached = this.audioCache.get(path);

    if (!cached) {
      const audio = new Audio(path);
      audio.volume = this.volume();

      audio.play().catch(() => {});
      return;
    }

    const audio = cached.cloneNode(true) as HTMLAudioElement;

    audio.volume = this.volume();
    audio.currentTime = 0;

    audio.play().catch(() => {});
  }

  stop(path: string): void {
    const audio = this.audioCache.get(path);

    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  }

  setEnabled(enabled: boolean): void {
    this.enabled.set(enabled);
  }

  toggleEnabled(): void {
    this.enabled.set(!this.enabled());
  }

  setVolume(volume: number): void {
    this.volume.set(Math.min(1, Math.max(0, volume)));
  }

  playClick(): void {
    this.play(this.sounds.click);
  }

  playPop(): void {
    this.play(this.sounds.pop);
  }

  playSuccess(): void {
    this.play(this.sounds.success);
  }

  playError(): void {
    this.play(this.sounds.error);
  }

  playMicStart(): void {
    this.play(this.sounds.micStart);
  }

  playMicStop(): void {
    this.play(this.sounds.micStop);
  }

  playRecognized(): void {
    this.play(this.sounds.recognized);
  }
}
