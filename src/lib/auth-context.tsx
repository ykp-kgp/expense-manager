import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { hasPin } from './auth';
import { useSettings } from './settings-context';

type AuthState = {
  isReady: boolean;
  pinSet: boolean;
  unlocked: boolean;
};

type Ctx = AuthState & {
  refresh: () => Promise<void>;
  markUnlocked: () => void;
  lock: () => void;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isReady: false,
    pinSet: false,
    unlocked: false,
  });
  const { settings } = useSettings();
  const lastBackgroundRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const pinSet = await hasPin();
    setState((s) => ({ ...s, pinSet, isReady: true, unlocked: pinSet ? s.unlocked : true }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        lastBackgroundRef.current = Date.now();
      } else if (next === 'active') {
        const last = lastBackgroundRef.current;
        if (last != null) {
          const elapsedMs = Date.now() - last;
          const limitMs = (settings.autoLockMinutes ?? 2) * 60_000;
          if (elapsedMs >= limitMs) {
            setState((s) => (s.pinSet ? { ...s, unlocked: false } : s));
          }
        }
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [settings.autoLockMinutes]);

  const markUnlocked = useCallback(() => {
    setState((s) => ({ ...s, unlocked: true }));
  }, []);

  const lock = useCallback(() => {
    setState((s) => ({ ...s, unlocked: false }));
  }, []);

  const value = useMemo<Ctx>(
    () => ({ ...state, refresh, markUnlocked, lock }),
    [state, refresh, markUnlocked, lock]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      isReady: false,
      pinSet: false,
      unlocked: false,
      refresh: async () => undefined,
      markUnlocked: () => undefined,
      lock: () => undefined,
    };
  }
  return ctx;
}
