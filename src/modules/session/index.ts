/**
 * B7 — SessionController
 *
 * Der EINZIGE Baustein, der alle anderen kennt. Verdrahtet die Pipeline
 *   B1 (Segment) → B2 (normalize) → B3/B4 (resolve) → B5 (Queue)
 * und stellt der UI (B6) den Hook `useSignBridge()` bereit.
 *
 * State Machine: idle → requesting-mic → listening ⇄ paused → error.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { SignItem, TranscriptSegment } from '../../types';
import { loadDictionary, Dictionary } from '../dictionary';
import { normalize } from '../normalizer';
import { resolve } from '../resolver';
import { DisplayQueue } from '../queue';
import { SpeechCapture } from '../speech';
import { useSettings } from '../settings';

export type SessionState = 'idle' | 'requesting-mic' | 'listening' | 'paused' | 'error';

export interface SignBridgeApi {
  state: SessionState;
  /** Aktuell angezeigtes SignItem (oder null). */
  current: SignItem | null;
  /** Verlaufsstreifen der zuletzt angezeigten Items. */
  history: SignItem[];
  /** Fehlermeldung, falls state === "error". */
  error: string | null;
  /** Ob die Web Speech API verfügbar ist. */
  supported: boolean;
  /** Ob das Wörterbuch geladen ist. */
  dictionaryReady: boolean;

  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  /** Text manuell in DIESELBE Pipeline einspeisen (Fallback + Testwerkzeug). */
  submitText: (text: string) => void;
  /** Rohes Segment einspeisen (für den Demo-Modus / Tests; nutzt replaceSegment). */
  feedSegment: (segment: TranscriptSegment, segmentId: string) => void;
  /** Nächste wartende Items (für Bild-Preloading in der UI). */
  upcoming: (count?: number) => SignItem[];
}

const DICTIONARY_URL = `${import.meta.env.BASE_URL ?? '/'}dictionary.json`;

export function useSignBridge(): SignBridgeApi {
  const { settings } = useSettings();

  // Aktuelle Settings in einer Ref spiegeln, damit die Pipeline-Callbacks
  // immer den neuesten Stand lesen, ohne neu verdrahtet zu werden.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [state, setState] = useState<SessionState>('idle');
  const [current, setCurrent] = useState<SignItem | null>(null);
  const [history, setHistory] = useState<SignItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dictionaryReady, setDictionaryReady] = useState(false);

  const supported = SpeechCapture.isSupported();

  // Bausteine einmalig erzeugen.
  const queueRef = useRef<DisplayQueue>();
  if (!queueRef.current) {
    queueRef.current = new DisplayQueue({
      msPerSign: settings.msPerSign,
      maxHistory: settings.historyLength,
    });
  }
  const captureRef = useRef<SpeechCapture>();
  if (!captureRef.current) {
    captureRef.current = new SpeechCapture({ lang: 'de-DE' });
  }
  const lookupRef = useRef<(w: string) => ReturnType<Dictionary['lookup']>>(() => null);
  const manualCounter = useRef(0);

  // -- Pipeline-Verdrahtung (einmalig) ----------------------------------------
  useEffect(() => {
    const queue = queueRef.current!;
    const capture = captureRef.current!;

    const offTick = queue.onTick((cur, hist) => {
      setCurrent(cur);
      setHistory(hist);
    });

    const offSegment = capture.onSegment((segment, segmentId) => {
      const tokens = normalize(segment, segmentId, {
        filterFillers: settingsRef.current.fillerFilter,
      });
      const items = tokens.map((t) => resolve(t, lookupRef.current));
      // Interim-Updates ersetzen frühere Items desselben Segments.
      queue.replaceSegment(segmentId, items, segment.isFinal);
    });

    const offState = capture.onStateChange((s, err) => {
      if (s === 'listening') {
        setState((prev) => (prev === 'paused' ? prev : 'listening'));
      } else if (s === 'error') {
        setState('error');
        setError(err ?? 'Unbekannter Spracherkennungsfehler.');
      }
    });

    // Wörterbuch laden (B0). Offline-fähig durch IndexedDB-Cache.
    loadDictionary(DICTIONARY_URL)
      .then((dict) => {
        lookupRef.current = dict.lookup;
        setDictionaryReady(true);
      })
      .catch((e: unknown) => {
        setError(`Wörterbuch konnte nicht geladen werden: ${(e as Error).message}`);
      });

    return () => {
      offTick();
      offSegment();
      offState();
      capture.stop();
      queue.clear();
    };
  }, []);

  // Geschwindigkeit live nachführen (B8 → B5).
  useEffect(() => {
    queueRef.current?.setSpeed(settings.msPerSign);
  }, [settings.msPerSign]);

  // -- öffentliche Aktionen ----------------------------------------------------
  const start = useCallback(async () => {
    setError(null);
    if (!SpeechCapture.isSupported()) {
      setState('error');
      setError(
        'Web Speech API wird in diesem Browser nicht unterstützt (am besten Chrome/Edge). ' +
          'Du kannst stattdessen das Texteingabefeld zum Testen nutzen.',
      );
      return;
    }
    setState('requesting-mic');
    try {
      await captureRef.current!.start();
    } catch (e) {
      setState('error');
      setError((e as Error).message);
    }
  }, []);

  const stop = useCallback(() => {
    captureRef.current?.stop();
    queueRef.current?.clear();
    setCurrent(null);
    setHistory([]);
    setState('idle');
  }, []);

  const pause = useCallback(() => {
    queueRef.current?.pause();
    setState((prev) => (prev === 'listening' ? 'paused' : prev));
  }, []);

  const resume = useCallback(() => {
    queueRef.current?.resume();
    setState((prev) => (prev === 'paused' ? 'listening' : prev));
  }, []);

  const submitText = useCallback((text: string) => {
    if (!text.trim()) return;
    const segmentId = `manual-${(manualCounter.current += 1)}`;
    const segment = { text, isFinal: true, timestamp: Date.now() };
    const tokens = normalize(segment, segmentId, {
      filterFillers: settingsRef.current.fillerFilter,
    });
    const items = tokens.map((t) => resolve(t, lookupRef.current));
    queueRef.current?.enqueue(items, true);
  }, []);

  const feedSegment = useCallback((segment: TranscriptSegment, segmentId: string) => {
    const tokens = normalize(segment, segmentId, {
      filterFillers: settingsRef.current.fillerFilter,
    });
    const items = tokens.map((t) => resolve(t, lookupRef.current));
    queueRef.current?.replaceSegment(segmentId, items, segment.isFinal);
  }, []);

  const upcoming = useCallback((count = 5) => queueRef.current?.upcoming(count) ?? [], []);

  return {
    state,
    current,
    history,
    error,
    supported,
    dictionaryReady,
    start,
    stop,
    pause,
    resume,
    submitText,
    feedSegment,
    upcoming,
  };
}
