import { useState } from 'react';
import { ScrollView, StyleSheet, View, Alert } from 'react-native';
import {
  Text,
  List,
  Switch,
  Divider,
  useTheme,
  SegmentedButtons,
  Dialog,
  Portal,
  Button,
  TextInput,
  RadioButton,
} from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSettings, type ThemePref } from '@/lib/settings-context';
import { CURRENCY_SYMBOLS } from '@/lib/format';
import {
  cancelDailyReminder,
  scheduleDailyReminder,
  ensureNotificationPermission,
} from '@/lib/notifications';
import {
  setBiometricEnabled,
  isBiometricAvailable,
  setPin,
  verifyPin,
} from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { exportExpensesCsv, exportExpensesJson, shareFile } from '@/lib/export';

export default function Settings() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { lock } = useAuth();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [autoLockOpen, setAutoLockOpen] = useState(false);

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [reminderHour, setReminderHour] = useState(
    parseInt(settings.reminderTime.split(':')[0] ?? '21', 10)
  );

  const toggleReminder = async (enabled: boolean) => {
    if (enabled) {
      const ok = await ensureNotificationPermission();
      if (!ok) {
        Alert.alert('Permission denied', 'Enable notifications in system settings.');
        return;
      }
      const [h] = settings.reminderTime.split(':');
      await scheduleDailyReminder(parseInt(h, 10), 0);
    } else {
      await cancelDailyReminder();
    }
    await update('reminderEnabled', enabled);
  };

  const toggleBiometric = async (enabled: boolean) => {
    if (enabled) {
      const ok = await isBiometricAvailable();
      if (!ok) {
        Alert.alert(
          'Biometrics unavailable',
          'Set up fingerprint or face unlock in your device settings first.'
        );
        return;
      }
    }
    await setBiometricEnabled(enabled);
    await update('biometricEnabled', enabled);
  };

  const saveReminderTime = async () => {
    const time = `${String(reminderHour).padStart(2, '0')}:00`;
    await update('reminderTime', time);
    if (settings.reminderEnabled) {
      await scheduleDailyReminder(reminderHour, 0);
    }
    setReminderOpen(false);
  };

  const changePin = async () => {
    setPinError(null);
    const ok = await verifyPin(currentPin);
    if (!ok) {
      setPinError('Current PIN is incorrect.');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      setPinError('New PIN must be 4–6 digits.');
      return;
    }
    await setPin(newPin);
    setPinOpen(false);
    setCurrentPin('');
    setNewPin('');
    Alert.alert('PIN updated');
  };

  const exportCsv = async () => {
    try {
      const path = await exportExpensesCsv();
      await shareFile(path, 'text/csv');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? String(e));
    }
  };

  const exportJson = async () => {
    try {
      const path = await exportExpensesJson();
      await shareFile(path, 'application/json');
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? String(e));
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <List.Section>
        <List.Subheader>Appearance</List.Subheader>
        <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
          <SegmentedButtons
            value={settings.theme}
            onValueChange={(v) => update('theme', v as ThemePref)}
            buttons={[
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
              { value: 'system', label: 'System', icon: 'theme-light-dark' },
              { value: 'dark', label: 'Dark', icon: 'moon-waning-crescent' },
            ]}
          />
        </View>
        <List.Item
          title="Currency"
          description={settings.currency}
          left={(p) => <List.Icon {...p} icon="currency-usd" />}
          onPress={() => setCurrencyOpen(true)}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Security</List.Subheader>
        <List.Item
          title="Biometric unlock"
          left={(p) => <List.Icon {...p} icon="fingerprint" />}
          right={() => (
            <Switch
              value={settings.biometricEnabled}
              onValueChange={toggleBiometric}
            />
          )}
        />
        <List.Item
          title="Change PIN"
          left={(p) => <List.Icon {...p} icon="lock-reset" />}
          onPress={() => setPinOpen(true)}
        />
        <List.Item
          title="Auto-lock after"
          description={`${settings.autoLockMinutes} minute${
            settings.autoLockMinutes === 1 ? '' : 's'
          }`}
          left={(p) => <List.Icon {...p} icon="timer-outline" />}
          onPress={() => setAutoLockOpen(true)}
        />
        <List.Item
          title="Lock now"
          left={(p) => <List.Icon {...p} icon="lock" />}
          onPress={lock}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Reminders</List.Subheader>
        <List.Item
          title="Daily reminder"
          description={settings.reminderEnabled ? `at ${settings.reminderTime}` : 'Off'}
          left={(p) => <List.Icon {...p} icon="bell-outline" />}
          right={() => (
            <Switch
              value={settings.reminderEnabled}
              onValueChange={toggleReminder}
            />
          )}
        />
        <List.Item
          title="Reminder time"
          description={settings.reminderTime}
          left={(p) => <List.Icon {...p} icon="clock-outline" />}
          onPress={() => setReminderOpen(true)}
          disabled={!settings.reminderEnabled}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Money</List.Subheader>
        <List.Item
          title="Budgets"
          left={(p) => <List.Icon {...p} icon="chart-donut" />}
          onPress={() => router.push('/settings/budgets')}
        />
        <List.Item
          title="Recurring expenses"
          left={(p) => <List.Icon {...p} icon="repeat" />}
          onPress={() => router.push('/settings/recurring')}
        />
        <List.Item
          title="Categories"
          left={(p) => <List.Icon {...p} icon="tag-multiple-outline" />}
          onPress={() => router.push('/settings/categories')}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Subheader>Data</List.Subheader>
        <List.Item
          title="Export to CSV"
          left={(p) => <List.Icon {...p} icon="file-delimited-outline" />}
          onPress={exportCsv}
        />
        <List.Item
          title="Export to JSON"
          left={(p) => <List.Icon {...p} icon="code-json" />}
          onPress={exportJson}
        />
        <List.Item
          title="Backup & restore"
          description="Optional encrypted backup to your Google Drive"
          left={(p) => <List.Icon {...p} icon="cloud-outline" />}
          onPress={() => router.push('/settings/backup')}
        />
      </List.Section>

      <Divider />

      <List.Section>
        <List.Item
          title="About & Privacy"
          left={(p) => <List.Icon {...p} icon="information-outline" />}
          onPress={() => router.push('/settings/about')}
        />
      </List.Section>

      <Portal>
        <Dialog visible={currencyOpen} onDismiss={() => setCurrencyOpen(false)}>
          <Dialog.Title>Currency</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={settings.currency}
              onValueChange={(v) => {
                update('currency', v);
                setCurrencyOpen(false);
              }}
            >
              {Object.keys(CURRENCY_SYMBOLS).map((c) => (
                <RadioButton.Item key={c} label={`${c} (${CURRENCY_SYMBOLS[c]})`} value={c} />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={reminderOpen} onDismiss={() => setReminderOpen(false)}>
          <Dialog.Title>Reminder time</Dialog.Title>
          <Dialog.Content>
            <SegmentedButtons
              value={String(reminderHour)}
              onValueChange={(v) => setReminderHour(parseInt(v, 10))}
              buttons={[
                { value: '9', label: '9 AM' },
                { value: '13', label: '1 PM' },
                { value: '18', label: '6 PM' },
                { value: '21', label: '9 PM' },
              ]}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setReminderOpen(false)}>Cancel</Button>
            <Button onPress={saveReminderTime}>Save</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={autoLockOpen} onDismiss={() => setAutoLockOpen(false)}>
          <Dialog.Title>Auto-lock after</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              value={String(settings.autoLockMinutes)}
              onValueChange={(v) => {
                update('autoLockMinutes', parseInt(v, 10));
                setAutoLockOpen(false);
              }}
            >
              {['1', '2', '5', '15', '60'].map((m) => (
                <RadioButton.Item
                  key={m}
                  value={m}
                  label={`${m} minute${m === '1' ? '' : 's'}`}
                />
              ))}
            </RadioButton.Group>
          </Dialog.Content>
        </Dialog>

        <Dialog visible={pinOpen} onDismiss={() => setPinOpen(false)}>
          <Dialog.Title>Change PIN</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Current PIN"
              mode="outlined"
              keyboardType="number-pad"
              secureTextEntry
              value={currentPin}
              onChangeText={setCurrentPin}
              maxLength={6}
              style={{ marginBottom: 8 }}
            />
            <TextInput
              label="New PIN (4-6 digits)"
              mode="outlined"
              keyboardType="number-pad"
              secureTextEntry
              value={newPin}
              onChangeText={setNewPin}
              maxLength={6}
            />
            {pinError && (
              <Text style={{ color: theme.colors.error, marginTop: 8 }}>{pinError}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPinOpen(false)}>Cancel</Button>
            <Button onPress={changePin}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({});
