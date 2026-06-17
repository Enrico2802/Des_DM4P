import { describe, it, expect, vi } from 'vitest';
import { SpeechCapture } from './index';
import type { SpeechRecognitionLike, SpeechResultEventLike } from './index';
import type { TranscriptSegment } from '../../types';

/** Steuerbarer Mock der Recognition-Engine. */
class MockRecognition implements SpeechRecognitionLike {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: SpeechResultEventLike) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;

  startCount = 0;
  stopCount = 0;

  start(): void {
    this.startCount += 1;
  }
  stop(): void {
    this.stopCount += 1;
  }

  // -- Test-Helfer zum Auslösen von Events --
  emitResult(resultIndex: number, items: Array<{ transcript: string; isFinal: boolean }>): void {
    const results = items.map((it) => ({ isFinal: it.isFinal, 0: { transcript: it.transcript } }));
    this.onresult?.({ resultIndex, results });
  }
  emitEnd(): void {
    this.onend?.();
  }
  emitError(error: string): void {
    this.onerror?.({ error });
  }
}

function setup() {
  const rec = new MockRecognition();
  const capture = new SpeechCapture({ createRecognition: () => rec, now: () => 1000 });
  return { rec, capture };
}

describe('B1 SpeechCapture', () => {
  it('konfiguriert die Engine mit de-DE, continuous, interimResults', async () => {
    const { rec, capture } = setup();
    await capture.start();
    expect(rec.lang).toBe('de-DE');
    expect(rec.continuous).toBe(true);
    expect(rec.interimResults).toBe(true);
    expect(rec.startCount).toBe(1);
  });

  it('vergibt pro Result-Index eine stabile segmentId (interim → final)', async () => {
    const { rec, capture } = setup();
    const segs: Array<{ seg: TranscriptSegment; id: string }> = [];
    capture.onSegment((seg, id) => segs.push({ seg, id }));
    await capture.start();

    rec.emitResult(0, [{ transcript: 'hallo we', isFinal: false }]);
    rec.emitResult(0, [{ transcript: 'hallo welt', isFinal: true }]);

    expect(segs).toHaveLength(2);
    expect(segs[0]?.id).toBe(segs[1]?.id); // gleicher Index → gleiche Id
    expect(segs[0]?.seg.isFinal).toBe(false);
    expect(segs[1]?.seg.isFinal).toBe(true);
    expect(segs[1]?.seg.text).toBe('hallo welt');
  });

  it('vergibt unterschiedliche Ids für unterschiedliche Result-Indizes', async () => {
    const { rec, capture } = setup();
    const ids: string[] = [];
    capture.onSegment((_seg, id) => ids.push(id));
    await capture.start();

    rec.emitResult(0, [
      { transcript: 'satz eins', isFinal: true },
      { transcript: 'satz zwei', isFinal: false },
    ]);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('startet nach onend automatisch neu (kein Nutzer-Stop)', async () => {
    const { rec, capture } = setup();
    await capture.start();
    expect(rec.startCount).toBe(1);

    rec.emitEnd(); // Chrome stoppt nach Stille
    expect(rec.startCount).toBe(2); // Auto-Restart
  });

  it('vergibt nach Auto-Restart neue Session-Ids (kein Id-Kollaps)', async () => {
    const { rec, capture } = setup();
    const ids: string[] = [];
    capture.onSegment((_seg, id) => ids.push(id));
    await capture.start();

    rec.emitResult(0, [{ transcript: 'a', isFinal: true }]);
    rec.emitEnd(); // Restart → neue Session
    rec.emitResult(0, [{ transcript: 'b', isFinal: true }]);

    expect(ids[0]).not.toBe(ids[1]); // gleicher resultIndex, aber andere Session
  });

  it('startet NICHT neu, nachdem der Nutzer gestoppt hat', async () => {
    const { rec, capture } = setup();
    await capture.start();
    capture.stop();
    const before = rec.startCount;
    rec.emitEnd();
    expect(rec.startCount).toBe(before); // kein Restart
  });

  it('geht bei "not-allowed" in den Fehlerzustand und startet nicht neu', async () => {
    const { rec, capture } = setup();
    const states: Array<{ state: string; error?: string }> = [];
    capture.onStateChange((state, error) => states.push({ state, error }));
    await capture.start();

    rec.emitError('not-allowed');
    const startsBefore = rec.startCount;
    rec.emitEnd();

    expect(states.some((s) => s.state === 'error')).toBe(true);
    expect(states.find((s) => s.state === 'error')?.error).toMatch(/Mikrofon/);
    expect(rec.startCount).toBe(startsBefore); // kein Auto-Restart nach Fehler
  });

  it('behandelt "no-speech" als gutartig und startet via onend neu', async () => {
    const { rec, capture } = setup();
    const states: string[] = [];
    capture.onStateChange((state) => states.push(state));
    await capture.start();

    rec.emitError('no-speech');
    expect(states).not.toContain('error');
    rec.emitEnd();
    expect(rec.startCount).toBe(2); // Restart trotz no-speech
  });

  it('onSegment/onStateChange liefern funktionierende Unsubscribes', async () => {
    const { rec, capture } = setup();
    const cb = vi.fn();
    const off = capture.onSegment(cb);
    await capture.start();
    rec.emitResult(0, [{ transcript: 'x', isFinal: true }]);
    expect(cb).toHaveBeenCalledTimes(1);
    off();
    rec.emitResult(0, [{ transcript: 'y', isFinal: true }]);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
