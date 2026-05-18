import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getSetting, setSetting } from '@/db';

export type ThemePref = 'light' | 'dark' | 'system';

export type AppSettings = {
  currency: string;
  theme: ThemePref;
  reminderEnabled: boolean;
  reminderTime: string;
  autoLockMinutes: number;
  biometricEnabled: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  currency: 'INR',
  theme: 'system',
  reminderEnabled: false,
  reminderTime: '21:00',
  autoLockMinutes: 2,
  biometricEnabled: false,
};

type Ctx = {
  settings: AppSettings;
  ready: boolean;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    const keys = Object.keys(DEFAULT_SETTINGS) as Array<keyof AppSettings>;
    const next: AppSettings = { ...DEFAULT_SETTINGS };
    for (const k of keys) {
      const raw = await getSetting(k);
      if (raw == null) continue;
      if (k === 'reminderEnabled' || k === 'biometricEnabled') {
        (next as any)[k] = raw === '1';
      } else if (k === 'autoLockMinutes') {
        (next as any)[k] = parseInt(raw, 10) || DEFAULT_SETTINGS.autoLockMinutes;
      } else {
        (next as any)[k] = raw;
      }
    }
    setSettings(next);
    setReady(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      let raw: string;
      if (typeof value === 'boolean') raw = value ? '1' : '0';
      else if (typeof value === 'number') raw = String(value);
      else raw = String(value);
      await setSetting(key, raw);
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const value = useMemo(() => ({ settings, ready, update }), [settings, ready, update]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      ready: false,
      update: async () => undefined,
    };
  }
  return ctx;
}
