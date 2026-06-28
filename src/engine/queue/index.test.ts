import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DisplayQueue } from './index';
import type { SignItem, Token } from '../types';

function tok(normalized: string, segmentId = 's'): Token {
  return { raw: normalized, normalized, segmentId };
}

function sign(normalized: string, segmentId = 's'): SignItem {
  return { kind: 'sign', token: tok(normalized, segmentId), imageUrl: `/signs/${normalized}.svg` };
}

function fs(normalized: string, letterCount: number, segmentId = 's'): SignItem {
  return {
    kind: 'fingerspell',
    token: tok(normalized, segmentId),
    letters: Array.from({ length: letterCount }, (_, i) => ({
      char: String(i),
      imageUrl: `/alphabet/${i}.svg`,
    })),
  };
}

describe('B5 DisplayQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('zeigt Items in Reihenfolge mit Default-Tempo (600 ms)', () => {
    const q = new DisplayQueue();
    const seen: string[] = [];
    q.onTick((c) => seen.push(c.token.normalized));

    q.enqueue([sign('a'), sign('b'), sign('c')]);
    expect(q.current?.token.normalized).toBe('a'); // erstes Item sofort

    vi.advanceTimersByTime(600);
    expect(q.current?.token.normalized).toBe('b');
    vi.advanceTimersByTime(600);
    expect(q.current?.token.normalized).toBe('c');

    expect(seen).toEqual(['a', 'b', 'c']);
  });

  it('hält Fingeralphabet-Items 350 ms pro Buchstabe', () => {
    const q = new DisplayQueue();
    q.enqueue([fs('abc', 3), sign('x')]); // 3 Buchstaben -> 1050 ms
    expect(q.current?.kind).toBe('fingerspell');

    vi.advanceTimersByTime(1000);
    expect(q.current?.kind).toBe('fingerspell'); // noch nicht vorbei
    vi.advanceTimersByTime(50);
    expect(q.current?.token.normalized).toBe('x'); // nach 1050 ms
  });

  it('respektiert setSpeed', () => {
    const q = new DisplayQueue();
    q.setSpeed(200);
    q.enqueue([sign('a'), sign('b')]);
    vi.advanceTimersByTime(200);
    expect(q.current?.token.normalized).toBe('b');
  });

  it('pausiert und setzt fort, ohne ein Item zu überspringen', () => {
    const q = new DisplayQueue();
    q.enqueue([sign('a'), sign('b'), sign('c')]);
    expect(q.current?.token.normalized).toBe('a');

    vi.advanceTimersByTime(600);
    expect(q.current?.token.normalized).toBe('b');

    q.pause();
    vi.advanceTimersByTime(5000);
    expect(q.current?.token.normalized).toBe('b'); // eingefroren

    q.resume();
    expect(q.current?.token.normalized).toBe('b'); // hält noch eine volle Dauer
    vi.advanceTimersByTime(600);
    expect(q.current?.token.normalized).toBe('c');
  });

  it('clear leert Queue, current und history', () => {
    const q = new DisplayQueue();
    q.enqueue([sign('a'), sign('b')]);
    q.clear();
    expect(q.current).toBeNull();
    expect(q.history).toEqual([]);
    expect(q.pending).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(q.current).toBeNull();
  });

  it('begrenzt die History auf maxHistory', () => {
    const q = new DisplayQueue({ maxHistory: 3, msPerSign: 100 });
    q.enqueue(Array.from({ length: 6 }, (_, i) => sign(`w${i}`)));
    vi.advanceTimersByTime(100 * 6);
    expect(q.history.map((h) => h.token.normalized)).toEqual(['w3', 'w4', 'w5']);
  });

  it('setMaxHistory kürzt einen bereits zu langen Verlauf sofort (B8)', () => {
    const q = new DisplayQueue({ maxHistory: 50, msPerSign: 100 });
    q.enqueue(Array.from({ length: 5 }, (_, i) => sign(`w${i}`)));
    vi.advanceTimersByTime(100 * 5);
    expect(q.history).toHaveLength(5);

    q.setMaxHistory(2);
    expect(q.history.map((h) => h.token.normalized)).toEqual(['w3', 'w4']);
  });

  describe('Backpressure (> maxQueue)', () => {
    it('verwirft die ältesten NICHT-finalen Items', () => {
      const q = new DisplayQueue({ maxQueue: 3, msPerSign: 1000 });
      // Interim-Items strömen nach und lassen die Queue überlaufen. Interim wird
      // (noch) nicht dauerhaft angezeigt, landet also komplett in der Queue.
      q.enqueue([sign('i1'), sign('i2'), sign('i3'), sign('i4')], false); // 4 (> 3)

      expect(q.current).toBeNull(); // interim wird nicht angezeigt
      expect(q.pending).toBe(3);
      // Das älteste nicht-finale Item (i1) wurde verworfen.
      expect(q.upcoming(3).map((s) => s.token.normalized)).toEqual(['i2', 'i3', 'i4']);
    });

    it('behält finale Items, auch wenn die Queue überläuft', () => {
      const q = new DisplayQueue({ maxQueue: 2, msPerSign: 1000 });
      q.enqueue([sign('f0'), sign('f1'), sign('f2'), sign('f3')], true); // alle final
      // Nichts darf verworfen werden -> alle 4 erscheinen.
      const order: string[] = [q.current!.token.normalized];
      for (let i = 0; i < 3; i++) {
        vi.advanceTimersByTime(1000);
        order.push(q.current!.token.normalized);
      }
      expect(order).toEqual(['f0', 'f1', 'f2', 'f3']);
    });
  });

  describe('replaceSegment (Interim-Korrektur + Finalitäts-Gate)', () => {
    it('zeigt interim nichts an und gibt erst die finale Korrektur aus', () => {
      const q = new DisplayQueue({ msPerSign: 1000 });
      const seen: string[] = [];
      q.onTick((c) => seen.push(c.token.normalized));
      // Segment "seg1" interim: zwei Wörter — noch NICHTS angezeigt.
      q.enqueue([sign('hallo', 'seg1'), sign('wlt', 'seg1')], false);
      expect(q.current).toBeNull();

      // Finale Erkennung korrigiert "wlt" -> "welt" und bestätigt das Segment.
      q.replaceSegment('seg1', [sign('hallo', 'seg1'), sign('welt', 'seg1')], true);
      expect(q.current?.token.normalized).toBe('hallo'); // jetzt final -> angezeigt
      vi.advanceTimersByTime(1000);
      expect(q.current?.token.normalized).toBe('welt');
      expect(seen).toEqual(['hallo', 'welt']); // jede Gebärde genau einmal
    });

    it('zeigt voreilig falsch geratene Interim-Ergebnisse NICHT an ("test 2 3"-Geist)', () => {
      // Genau der gemeldete Fehler: Erkennung rät erst "test 2 3", korrigiert
      // dann zu "test 1 2 3". Das falsche Zwischenergebnis darf nie erscheinen.
      const q = new DisplayQueue({ msPerSign: 100 });
      const seen: string[] = [];
      q.onTick((c) => seen.push(c.token.normalized));
      const seg = (words: string[]) => words.map((w) => sign(w, 's'));

      q.replaceSegment('s', seg(['test', '2', '3']), false); // interim, falsch
      vi.advanceTimersByTime(500);
      expect(q.current).toBeNull(); // nichts angezeigt

      q.replaceSegment('s', seg(['test', '1', '2', '3']), true); // final, korrekt
      expect(q.current?.token.normalized).toBe('test');
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(100);
      expect(seen).toEqual(['test', '1', '2', '3']); // kein "2,3"-Geist
    });

    it('vervielfacht wachsende Interim-Ergebnisse NICHT ("Test 1 2 3"-Regression)', () => {
      // Realer Live-Pfad: jedes Interim-Update liefert den GANZEN bisher
      // erkannten Text. Erst das finale Ergebnis wird ausgegeben.
      const q = new DisplayQueue({ msPerSign: 100 });
      const seen: string[] = [];
      q.onTick((c) => seen.push(c.token.normalized));
      const seg = (words: string[]) => words.map((w) => sign(w, 's'));

      q.replaceSegment('s', seg(['test']), false);
      q.replaceSegment('s', seg(['test', '1']), false);
      q.replaceSegment('s', seg(['test', '1', '2']), false);
      vi.advanceTimersByTime(500);
      expect(q.current).toBeNull(); // interim → noch nichts

      q.replaceSegment('s', seg(['test', '1', '2', '3']), true); // final
      expect(q.current?.token.normalized).toBe('test');
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(100);
      vi.advanceTimersByTime(100);

      // Genau die erkannte Folge, jede Gebärde genau einmal.
      expect(seen).toEqual(['test', '1', '2', '3']);
    });

    it('verhält sich wie enqueue, wenn das Segment noch nicht existiert', () => {
      const q = new DisplayQueue({ msPerSign: 1000 });
      q.replaceSegment('neu', [sign('eins', 'neu'), sign('zwei', 'neu')], true);
      expect(q.current?.token.normalized).toBe('eins');
      vi.advanceTimersByTime(1000);
      expect(q.current?.token.normalized).toBe('zwei');
    });

    it('lässt wartende Items anderer Segmente unangetastet', () => {
      const q = new DisplayQueue({ msPerSign: 1000 });
      q.enqueue([sign('a1', 'segA'), sign('a2', 'segA')], true);
      // current = a1 (segA), Queue: [a2(segA)]
      q.enqueue([sign('b1', 'segB')], false); // Queue: [a2(segA), b1(segB)]

      q.replaceSegment('segB', [sign('B', 'segB')], true); // nur b1 -> B

      const order = [q.current!.token.normalized];
      for (let i = 0; i < 2; i++) {
        vi.advanceTimersByTime(1000);
        order.push(q.current!.token.normalized);
      }
      // a2 (anderes Segment) bleibt erhalten, nur b1 wurde zu B.
      expect(order).toEqual(['a1', 'a2', 'B']);
    });
  });

  it('onTick liefert eine funktionierende Unsubscribe-Funktion', () => {
    const q = new DisplayQueue({ msPerSign: 100 });
    const cb = vi.fn();
    const off = q.onTick(cb);
    q.enqueue([sign('a')]);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    q.enqueue([sign('b')]);
    vi.advanceTimersByTime(100);
    expect(cb).toHaveBeenCalledTimes(1); // keine weiteren Aufrufe
  });
});
