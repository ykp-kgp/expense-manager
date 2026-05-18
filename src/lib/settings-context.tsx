import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getSetting, setSetting, setSettingsBatch } from '@/db';
import { useDb } from '@/lib/db-context';

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

function toRaw(value: AppSettings[keyof AppSettings]): string {
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') return String(value);
  return String(value);
}

type Ctx = {
  settings: AppSettings;
  ready: boolean;
  update: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  updateMany: (partial: Partial<AppSettings>) => Promise<void>;
};

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { ready: dbReady } = useDb();
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
    if (!dbReady) return;
    load();
  }, [dbReady, load]);

  const update = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      await setSetting(key, toRaw(value));
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const updateMany = useCallback(async (partial: Partial<AppSettings>) => {
    const keys = Object.keys(partial) as Array<keyof AppSettings>;
    if (keys.length === 0) return;
    const batch: Record<string, string> = {};
    for (const key of keys) {
      batch[key] = toRaw(partial[key]!);
    }
    await setSettingsBatch(batch);
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const value = useMemo(
    () => ({ settings, ready, update, updateMany }),
    [settings, ready, update, updateMany]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): Ctx {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    return {
      settings: DEFAULT_SETTINGS,
      ready: false,
      update: async () => undefined,
      updateMany: async () => undefined,
    };
  }
  return ctx;
}
