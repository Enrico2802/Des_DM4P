/**
 * B5 — DisplayQueue (Sequencer)
 *
 * Herzstück des Timings. Puffert SignItems und gibt sie nacheinander mit
 * einstellbarer Geschwindigkeit an die UI (B6) weiter. Kein DOM-Zugriff — die
 * Queue veröffentlicht nur `current` + `history` via onTick-Callback.
 *
 * Abgedeckt:
 *  - Anzeige-Timing: Default 600 ms/Gebärde, Fingeralphabet 350 ms pro Buchstabe.
 *  - Backpressure: bei > 20 Items zuerst die ältesten NICHT-finalen Items verwerfen,
 *    finale Items bleiben erhalten.
 *  - Interim-Korrektur: noch nicht angezeigte Items eines Segments ersetzen.
 *  - Finalitäts-Gate: NUR finale Items werden dauerhaft angezeigt. Interim-Items
 *    (noch nicht von der Erkennung bestätigt) warten in der Queue und können
 *    jederzeit ersetzt werden. So bleiben voreilig geratene, später revidierte
 *    Zwischenergebnisse nicht als Dubletten in der History hängen.
 *  - pause/resume/clear.
 *
 * Der Timer ist injizierbar, damit Tests mit Fake-Timern arbeiten können.
 */
import type { SignItem } from '../types';

/** Schmale Timer-Abstraktion (Default: globaler setTimeout/clearTimeout). */
export interface TimerLike {
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(handle: number): void;
}

const defaultTimer: TimerLike = {
  setTimeout: (handler, ms) => setTimeout(handler, ms) as unknown as number,
  clearTimeout: (handle) => clearTimeout(handle),
};

export interface DisplayQueueOptions {
  /** Anzeigedauer pro Gebärde in ms (Default 600). */
  msPerSign?: number;
  /** Anzeigedauer pro Fingeralphabet-Buchstabe in ms (Default 350). */
  msPerLetter?: number;
  /** Max. Queue-Länge, ab der Backpressure greift (Default 20). */
  maxQueue?: number;
  /** Max. Länge der Historie (Default 50). */
  maxHistory?: number;
  /** Injizierbarer Timer (Default: globaler setTimeout). */
  timer?: TimerLike;
}

/** Interner Queue-Eintrag: SignItem plus Finalitäts-Flag (für Backpressure). */
interface QueuedItem {
  item: SignItem;
  isFinal: boolean;
}

type TickListener = (current: SignItem, history: SignItem[]) => void;

const DEFAULTS = {
  msPerSign: 600,
  msPerLetter: 350,
  maxQueue: 20,
  maxHistory: 50,
} as const;

export class DisplayQueue {
  private queue: QueuedItem[] = [];
  private historyBuf: SignItem[] = [];
  private currentItem: SignItem | null = null;
  /**
   * Wie viele Items je Segment bereits ANGEZEIGT wurden (in current/history
   * gewandert). Interim-Updates liefern den ganzen Segmenttext erneut; dieser
   * Zähler verhindert, dass schon gezeigte Tokens beim Ersetzen erneut
   * eingereiht werden (sonst Vervielfachung der Ausgabe).
   */
  private readonly displayed = new Map<string, number>();

  private paused = false;
  private timerHandle: number | null = null;

  private msPerSign: number;
  private readonly msPerLetter: number;
  private readonly maxQueue: number;
  private maxHistory: number;
  private readonly timer: TimerLike;

  private readonly listeners = new Set<TickListener>();

  constructor(options: DisplayQueueOptions = {}) {
    this.msPerSign = options.msPerSign ?? DEFAULTS.msPerSign;
    this.msPerLetter = options.msPerLetter ?? DEFAULTS.msPerLetter;
    this.maxQueue = options.maxQueue ?? DEFAULTS.maxQueue;
    this.maxHistory = options.maxHistory ?? DEFAULTS.maxHistory;
    this.timer = options.timer ?? defaultTimer;
  }

  // -- öffentlicher Zustand ----------------------------------------------------

  get current(): SignItem | null {
    return this.currentItem;
  }

  get history(): SignItem[] {
    return [...this.historyBuf];
  }

  /** Anzahl noch nicht angezeigter Items. */
  get pending(): number {
    return this.queue.length;
  }

  /** Die nächsten `count` noch nicht angezeigten Items (für Bild-Preloading). */
  upcoming(count = 5): SignItem[] {
    return this.queue.slice(0, count).map((q) => q.item);
  }

  // -- API ---------------------------------------------------------------------

  /**
   * Hängt Items an. `isFinal` steuert die Backpressure (Default true = nicht
   * verwerfbar). Für Interim-Segmente {@link replaceSegment} mit isFinal=false.
   */
  enqueue(items: SignItem[], isFinal = true): void {
    for (const item of items) this.queue.push({ item, isFinal });
    this.applyBackpressure();
    this.kick();
  }

  /**
   * Aktualisiert ein Segment mit seiner VOLLSTÄNDIGEN aktuellen Token-Folge
   * (Interim-Korrektur der Web Speech API). `items` ist die komplette Folge des
   * Segments, nicht nur ein Rest: Bereits angezeigte Tokens am Anfang bleiben
   * unangetastet, nur die noch wartenden Items werden durch den passenden
   * Ausschnitt ersetzt. Existiert das Segment noch nicht, wirkt es wie ein
   * normales {@link enqueue}.
   */
  replaceSegment(segmentId: string, items: SignItem[], isFinal = false): void {
    // Bereits angezeigte Tokens dieses Segments NICHT erneut einreihen.
    const shown = this.displayed.get(segmentId) ?? 0;
    const pendingItems = shown > 0 ? items.slice(shown) : items;
    const replacements: QueuedItem[] = pendingItems.map((item) => ({ item, isFinal }));

    // Position des ersten Treffers merken, um die Reihenfolge zu erhalten.
    const firstIdx = this.queue.findIndex((q) => q.item.token.segmentId === segmentId);
    const filtered = this.queue.filter((q) => q.item.token.segmentId !== segmentId);

    if (firstIdx === -1) {
      this.queue = [...filtered, ...replacements];
    } else {
      // Anzahl entfernter Items VOR firstIdx ist 0 (firstIdx ist der erste
      // Treffer), daher fügen wir an firstIdx in der gefilterten Liste ein.
      const insertAt = Math.min(firstIdx, filtered.length);
      this.queue = [...filtered.slice(0, insertAt), ...replacements, ...filtered.slice(insertAt)];
    }

    this.applyBackpressure();
    this.kick();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.clearTimer();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (this.timerHandle !== null) return;
    if (this.currentItem && this.queue.length > 0) {
      // Aktuelles Item noch eine volle Dauer halten, dann normal weiterlaufen
      // (kein Item wird beim Fortsetzen übersprungen).
      this.scheduleAfter(this.durationOf(this.currentItem));
    } else {
      this.kick();
    }
  }

  clear(): void {
    this.queue = [];
    this.historyBuf = [];
    this.currentItem = null;
    this.displayed.clear();
    this.clearTimer();
  }

  /** Registriert einen Tick-Listener. Gibt eine Unsubscribe-Funktion zurück. */
  onTick(cb: TickListener): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /** Setzt die Anzeigegeschwindigkeit pro Gebärde (B8 SettingsStore). */
  setSpeed(msPerSign: number): void {
    this.msPerSign = msPerSign;
  }

  /**
   * Setzt die maximale Verlaufslänge (B8 SettingsStore) und kürzt einen bereits
   * zu langen Verlauf sofort auf das neue Limit.
   */
  setMaxHistory(maxHistory: number): void {
    this.maxHistory = Math.max(1, Math.floor(maxHistory));
    if (this.historyBuf.length > this.maxHistory) {
      this.historyBuf.splice(0, this.historyBuf.length - this.maxHistory);
    }
  }

  // -- intern ------------------------------------------------------------------

  /** Anzeigedauer eines Items. */
  private durationOf(item: SignItem): number {
    if (item.kind === 'fingerspell') {
      return this.msPerLetter * Math.max(1, item.letters.length);
    }
    return this.msPerSign;
  }

  /**
   * Backpressure: solange die Queue zu lang ist, das älteste NICHT-finale Item
   * verwerfen. Sind nur noch finale Items übrig, bleibt die Queue ungekürzt.
   */
  private applyBackpressure(): void {
    while (this.queue.length > this.maxQueue) {
      const idx = this.queue.findIndex((q) => !q.isFinal);
      if (idx === -1) break;
      this.queue.splice(idx, 1);
    }
  }

  /** Startet die Anzeige, falls nichts läuft und ein FINALES Item wartet. */
  private kick(): void {
    if (this.paused || this.timerHandle !== null) return;
    if (!this.frontDisplayable()) return;
    this.advance();
  }

  /**
   * Ob das vorderste wartende Item dauerhaft angezeigt werden darf. Nur FINALE
   * Items werden ausgegeben; ein interim Item am Anfang lässt die Anzeige warten,
   * bis die Erkennung es bestätigt (oder via {@link replaceSegment} ersetzt).
   */
  private frontDisplayable(): boolean {
    const front = this.queue[0];
    return front !== undefined && front.isFinal;
  }

  /** Plant den nächsten Tick nach `ms`. */
  private scheduleAfter(ms: number): void {
    this.timerHandle = this.timer.setTimeout(() => {
      this.timerHandle = null;
      if (!this.paused) this.advance();
    }, ms);
  }

  /** Zeigt das nächste FINALE Item an und plant den Folgetick. */
  private advance(): void {
    // Nur finale Items ausgeben; interim Items am Anfang warten lassen.
    if (!this.frontDisplayable()) {
      this.timerHandle = null;
      return;
    }
    const next = this.queue.shift();
    if (!next) {
      this.timerHandle = null;
      return;
    }

    this.currentItem = next.item;
    this.historyBuf.push(next.item);
    if (this.historyBuf.length > this.maxHistory) {
      this.historyBuf.splice(0, this.historyBuf.length - this.maxHistory);
    }
    // Angezeigt-Zähler des Segments erhöhen (für die Interim-Ersetzung).
    const segId = next.item.token.segmentId;
    this.displayed.set(segId, (this.displayed.get(segId) ?? 0) + 1);
    this.notify();

    this.scheduleAfter(this.durationOf(next.item));
  }

  private notify(): void {
    if (!this.currentItem) return;
    const snapshot = [...this.historyBuf];
    for (const cb of this.listeners) cb(this.currentItem, snapshot);
  }

  private clearTimer(): void {
    if (this.timerHandle !== null) {
      this.timer.clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
  }
}
