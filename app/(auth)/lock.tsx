import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinKeypad } from '@/components/PinKeypad';
import { PinDots } from '@/components/PinDots';
import { useAuth } from '@/lib/auth-context';
import {
  verifyPin,
  authenticateBiometric,
  isBiometricAvailable,
  isBiometricEnabled,
  getPinLength,
} from '@/lib/auth';

export default function Lock() {
  const theme = useTheme();
  const { markUnlocked } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState(false);
  const [pinLength, setPinLength] = useState(6);

  useEffect(() => {
    (async () => {
      setPinLength(await getPinLength());
      const enabled = await isBiometricEnabled();
      const avail = await isBiometricAvailable();
      const useBio = enabled && avail;
      setBio(useBio);
      if (useBio) {
        const ok = await authenticateBiometric();
        if (ok) markUnlocked();
      }
    })();
  }, [markUnlocked]);

  useEffect(() => {
    if (pin.length >= 4) {
      (async () => {
        const ok = await verifyPin(pin);
        if (ok) {
          markUnlocked();
        } else if (pin.length >= pinLength) {
          setError('Incorrect PIN');
          setTimeout(() => {
            setPin('');
            setError(null);
          }, 600);
        }
      })();
    }
  }, [pin, pinLength, markUnlocked]);

  const handleDigit = (d: string) => {
    setError(null);
    if (pin.length < pinLength) setPin(pin + d);
  };

  const handleBio = async () => {
    const ok = await authenticateBiometric();
    if (ok) markUnlocked();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Enter your PIN
        </Text>
        <PinDots length={pinLength} filled={pin.length} error={!!error} />
        {error && (
          <Text style={{ color: theme.colors.error, textAlign: 'center' }}>{error}</Text>
        )}
        <PinKeypad
          onDigit={handleDigit}
          onBackspace={() => setPin((p) => p.slice(0, -1))}
          onBiometric={handleBio}
          showBiometric={bio}
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
