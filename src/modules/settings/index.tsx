/**
 * B8 — SettingsStore
 *
 * Anzeigegeschwindigkeit, Füllwort-Filter, Kontrast und Verlaufslänge.
 * Persistenz in localStorage. Bereitgestellt als React Context + Hook.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

export interface Settings {
  /** Anzeigedauer pro Gebärde in ms. */
  msPerSign: number;
  /** Füllwörter herausfiltern. */
  fillerFilter: boolean;
  /** Hoher Kontrast / dunkles Thema. */
  highContrast: boolean;
  /** Maximale Länge des Verlaufsstreifens. */
  historyLength: number;
}

export const DEFAULT_SETTINGS: Settings = {
  msPerSign: 600,
  fillerFilter: false,
  highContrast: false,
  historyLength: 50,
};

const STORAGE_KEY = 'signbridge:settings';

function loadSettings(): Settings {
  if (typeof localStorage === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* Persistenz ist Best-Effort. */
    }
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), []);

  const value = useMemo(() => ({ settings, update, reset }), [settings, update, reset]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings muss innerhalb von <SettingsProvider> verwendet werden.');
  return ctx;
}
