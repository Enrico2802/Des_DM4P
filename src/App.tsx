/**
 * App — komponiert die UI (B6) über dem SessionController (B7).
 *
 * Vollhöhen-Layout: kompakter Header oben, große Gebärden-Bühne (~2/3),
 * Verlaufsstreifen, und die Steuerung unten zentriert (responsive/mobil).
 * Liest ?demo=1 und spielt dann das Demo-Skript in dieselbe Pipeline ein.
 */
import { useEffect } from 'react';
import { useSignBridge } from './modules/session';
import { useSettings } from './modules/settings';
import { runDemo } from './demo';
import { SignDisplay } from './components/SignDisplay';
import { HistoryStrip } from './components/HistoryStrip';
import { Controls } from './components/Controls';

function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === '1';
}

export default function App() {
  const bridge = useSignBridge();
  const { settings } = useSettings();

  // Demo-Modus: sobald das Wörterbuch geladen ist, Skript abspielen.
  useEffect(() => {
    if (!isDemoMode() || !bridge.dictionaryReady) return;
    const stop = runDemo(bridge.feedSegment);
    return stop;
  }, [bridge.dictionaryReady, bridge.feedSegment]);

  return (
    <div
      className={
        settings.highContrast
          ? 'flex min-h-screen flex-col bg-neutral-950 text-neutral-50'
          : 'flex min-h-screen flex-col bg-gradient-to-b from-white via-neutral-50 to-neutral-200 text-neutral-900'
      }
    >
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-6">
        {/* Kompakter Header */}
        <header className="flex flex-none items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-2xl">
              🤟
            </span>
            <div>
              <h1 className="text-xl font-extrabold leading-tight sm:text-2xl">
                SignBridge
              </h1>
              <p className="text-xs opacity-60 sm:text-sm">Speech Becomes Sign · DGS</p>
            </div>
          </div>
          {isDemoMode() && (
            <span className="rounded-full bg-brand/15 px-3 py-1 text-sm font-semibold text-brand">
              Demo
            </span>
          )}
        </header>

        {bridge.error && (
          <div
            role="alert"
            className="flex-none rounded-xl border border-red-400 bg-red-50 p-3 text-red-800"
          >
            {bridge.error}
          </div>
        )}

        {!bridge.supported && !bridge.error && (
          <div className="flex-none rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
            Dieser Browser unterstützt die Web Speech API nicht (am besten Chrome/Edge). Das
            Texteingabefeld füttert dieselbe Pipeline und funktioniert überall.
          </div>
        )}

        {/* Große Bühne — füllt den verfügbaren Platz (~2/3) */}
        <SignDisplay current={bridge.current} upcoming={bridge.upcoming(5)} className="flex-1" />

        <div className="flex-none">
          <HistoryStrip history={bridge.history} />
        </div>

        {/* Steuerung unten, zentriert */}
        <Controls
          className="flex-none"
          state={bridge.state}
          supported={bridge.supported}
          onStart={bridge.start}
          onStop={bridge.stop}
          onPause={bridge.pause}
          onResume={bridge.resume}
          onSubmitText={bridge.submitText}
        />
      </div>
    </div>
  );
}
