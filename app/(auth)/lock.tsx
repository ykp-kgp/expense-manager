import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinKeypad } from '@/components/PinKeypad';
import { PinDots } from '@/components/PinDots';
import { useAuth } from '@/lib/auth-context';
import {
  verifyPin,
  verifyPinWithLockout,
  getLockStatus,
  getPinLength,
  backfillPinLength,
  resetLockout,
  authenticateBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
} from '@/lib/auth';

const MAX_PIN = 6;

function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

export default function Lock() {
  const theme = useTheme();
  const { markUnlocked } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const [pinLength, setPinLength] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [tick, setTick] = useState(Date.now());
  const lastChecked = useRef('');

  const maxLen = pinLength ?? MAX_PIN;
  const remainingMs = lockedUntil ? Math.max(0, lockedUntil - tick) : 0;
  const locked = remainingMs > 0;

  const unlock = useCallback(
    async (enteredLength?: number) => {
      if (enteredLength) await backfillPinLength(enteredLength);
      await resetLockout();
      markUnlocked();
    },
    [markUnlocked]
  );

  const failFor = useCallback((res: { lockedUntil: number | null; attemptsRemaining: number; locked: boolean }) => {
    setLockedUntil(res.lockedUntil);
    setAttemptsRemaining(res.attemptsRemaining);
    if (res.locked && res.lockedUntil) {
      setTick(Date.now());
      setError('Too many attempts.');
    } else {
      setError(
        res.attemptsRemaining > 0
          ? `Incorrect PIN. ${res.attemptsRemaining} attempt${
              res.attemptsRemaining === 1 ? '' : 's'
            } left.`
          : 'Incorrect PIN.'
      );
    }
    setTimeout(() => {
      setPin('');
      setError(null);
      lastChecked.current = '';
    }, 700);
  }, []);

  // Initial biometric prompt + load PIN length and any existing lockout.
  useEffect(() => {
    (async () => {
      const [status, len] = await Promise.all([getLockStatus(), getPinLength()]);
      setPinLength(len);
      setLockedUntil(status.lockedUntil);
      setAttemptsRemaining(status.attemptsRemaining);

      const [enabled, avail] = await Promise.all([
        isBiometricEnabled(),
        isBiometricAvailable(),
      ]);
      const useBio = enabled && avail;
      setBio(useBio);
      if (useBio && !status.locked) {
        const ok = await authenticateBiometric();
        if (ok) await unlock();
      }
    })();
  }, [unlock]);

  // Tick the countdown while locked.
  useEffect(() => {
    if (!locked) return;
    const id = setInterval(() => setTick(Date.now()), 500);
    return () => clearInterval(id);
  }, [locked]);

  // Verify as digits are entered.
  useEffect(() => {
    if (locked || pin.length < 4 || pin === lastChecked.current) return;

    const known = pinLength != null;
    const atFullLength = pin.length === maxLen;
    // For legacy PINs of unknown length, opportunistically check for a match at
    // any length ≥ 4 (without counting), and count only at the maximum length.
    const legacyProbe = !known && pin.length >= 4 && pin.length < maxLen;
    if (!atFullLength && !legacyProbe) return;

    lastChecked.current = pin;
    const entered = pin;
    (async () => {
      if (atFullLength) {
        const res = await verifyPinWithLockout(entered);
        if (res.ok) await unlock(entered.length);
        else failFor(res);
      } else {
        // Legacy probe: match-only, no lockout accounting.
        if (await verifyPin(entered)) await unlock(entered.length);
      }
    })();
  }, [pin, locked, pinLength, maxLen, unlock, failFor]);

  const handleDigit = (d: string) => {
    if (locked) return;
    setError(null);
    if (pin.length < maxLen) setPin(pin + d);
  };

  const handleBio = async () => {
    if (locked) return;
    const ok = await authenticateBiometric();
    if (ok) await unlock();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Enter your PIN
        </Text>
        <PinDots length={maxLen} filled={pin.length} error={!!error} />
        {locked ? (
          <Text style={{ color: theme.colors.error, textAlign: 'center' }}>
            Too many attempts. Try again in {formatCountdown(remainingMs)}.
          </Text>
        ) : error ? (
          <Text style={{ color: theme.colors.error, textAlign: 'center' }}>{error}</Text>
        ) : (
          attemptsRemaining != null &&
          attemptsRemaining < 3 && (
            <Text style={{ color: theme.colors.error, textAlign: 'center', opacity: 0.8 }}>
              {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} left before lockout.
            </Text>
          )
        )}
        <PinKeypad
          onDigit={handleDigit}
          onBackspace={() => setPin((p) => p.slice(0, -1))}
          onBiometric={handleBio}
          showBiometric={bio && !locked}
          disabled={locked}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { textAlign: 'center' },
});
