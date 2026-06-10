/**
 * B6 — Steuerung & Einstellungen (unten, zentriert, responsive).
 *
 * Start/Stop, Pause/Resume, Geschwindigkeitsregler, Kontrast-/Füllwort-Toggle
 * und das Texteingabefeld (Fallback ohne Mikrofon + Testwerkzeug).
 */
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useSettings } from '../modules/settings';
import type { SessionState } from '../modules/session';

interface ControlsProps {
  state: SessionState;
  supported: boolean;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  onSubmitText: (text: string) => void;
  className?: string;
}

export function Controls({
  state,
  supported,
  onStart,
  onStop,
  onPause,
  onResume,
  onSubmitText,
  className = '',
}: ControlsProps) {
  const { settings, update } = useSettings();
  const [text, setText] = useState('');

  const listening = state === 'listening' || state === 'paused' || state === 'requesting-mic';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmitText(text);
    setText('');
  };

  return (
    <section
      aria-label="Steuerung"
      className={`flex flex-col items-center gap-4 rounded-3xl border border-black/5 bg-white/70 p-4 shadow-lg backdrop-blur sm:p-5 dark:border-white/10 dark:bg-white/[0.04] ${className}`}
    >
      {/* Texteingabe (Fallback + Test) — volle Breite, zentriert. */}
      <form onSubmit={handleSubmit} className="flex w-full max-w-xl gap-2">
        <label className="sr-only" htmlFor="text-input">
          Text zum Übersetzen
        </label>
        <input
          id="text-input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Text eingeben und Enter drücken, z. B. Hallo ich habe eine Frage"
          className="min-w-0 flex-1 rounded-full border border-current/20 bg-white/80 px-4 py-2.5 outline-none transition focus:border-brand dark:bg-white/10"
        />
        <button
          type="submit"
          className="rounded-full bg-accent px-5 py-2.5 font-semibold text-white shadow transition hover:brightness-110 active:scale-95"
        >
          Übersetzen
        </button>
      </form>

      {/* Hauptbuttons — zentriert. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!listening ? (
          <button
            type="button"
            onClick={onStart}
            disabled={!supported}
            className="rounded-full bg-brand px-8 py-3 text-lg font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ● Aufnahme starten
          </button>
        ) : (
          <button
            type="button"
            onClick={onStop}
            className="rounded-full bg-red-600 px-8 py-3 text-lg font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-95"
          >
            ■ Stoppen
          </button>
        )}

        {state === 'listening' && (
          <button
            type="button"
            onClick={onPause}
            className="rounded-full border-2 border-current px-5 py-3 font-semibold transition hover:bg-current/10 active:scale-95"
          >
            ❚❚ Pause
          </button>
        )}
        {state === 'paused' && (
          <button
            type="button"
            onClick={onResume}
            className="rounded-full border-2 border-current px-5 py-3 font-semibold transition hover:bg-current/10 active:scale-95"
          >
            ▶ Fortsetzen
          </button>
        )}

        <StatusBadge state={state} />
      </div>

      {/* Einstellungen (B8) — zentriert. */}
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm opacity-90">
        <label className="flex items-center gap-2">
          <span className="whitespace-nowrap">Tempo: {settings.msPerSign} ms</span>
          <input
            type="range"
            min={200}
            max={1500}
            step={50}
            value={settings.msPerSign}
            onChange={(e) => update({ msPerSign: Number(e.target.value) })}
            className="accent-brand"
          />
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={settings.fillerFilter}
            onChange={(e) => update({ fillerFilter: e.target.checked })}
            className="accent-brand"
          />
          Füllwörter filtern
        </label>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={(e) => update({ highContrast: e.target.checked })}
            className="accent-brand"
          />
          Hoher Kontrast
        </label>
      </div>
    </section>
  );
}

function StatusBadge({ state }: { state: SessionState }) {
  const map: Record<SessionState, { label: string; cls: string }> = {
    idle: { label: 'Bereit', cls: 'bg-black/10 dark:bg-white/10' },
    'requesting-mic': { label: 'Mikrofon…', cls: 'bg-amber-400/30 text-amber-700' },
    listening: { label: '● Hört zu', cls: 'bg-green-500/20 text-green-700 animate-pulse' },
    paused: { label: '❚❚ Pausiert', cls: 'bg-amber-400/30 text-amber-700' },
    error: { label: 'Fehler', cls: 'bg-red-500/20 text-red-700' },
  };
  const { label, cls } = map[state];
  return (
    <span
      aria-live="polite"
      className={`rounded-full px-4 py-2 text-sm font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}
