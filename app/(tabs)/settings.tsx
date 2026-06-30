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
  ActivityIndicator,
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
import { useDb } from '@/lib/db-context';
import {
  exportExpensesCsv,
  exportExpensesJson,
  shareFile,
  pickJsonFile,
  importExpensesFromJson,
  type ImportMode,
} from '@/lib/export';
import { wipeAllData } from '@/lib/reset';

export default function Settings() {
  const theme = useTheme();
  const router = useRouter();
  const { settings, update } = useSettings();
  const { lock, refresh: refreshAuth } = useAuth();
  const { bump, refresh: refreshDb } = useDb();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [autoLockOpen, setAutoLockOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipePin, setWipePin] = useState('');
  const [wipeError, setWipeError] = useState<string | null>(null);
  const [wipeBusy, setWipeBusy] = useState(false);

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

  const runImport = async (mode: ImportMode) => {
    setImportBusy(true);
    try {
      const raw = await pickJsonFile();
      if (raw == null) return;
      const result = await importExpensesFromJson(raw, mode);
      await refreshDb();
      bump();
      setImportOpen(false);
      const parts = [`${result.imported} expense${result.imported === 1 ? '' : 's'} imported`];
      if (result.skipped > 0) {
        parts.push(`${result.skipped} skipped (invalid)`);
      }
      Alert.alert('Import complete', parts.join(', ') + '.');
    } catch (e: any) {
      Alert.alert('Import failed', e?.message ?? String(e));
    } finally {
      setImportBusy(false);
    }
  };

  const confirmWipe = async () => {
    setWipeError(null);
    const ok = await verifyPin(wipePin);
    if (!ok) {
      setWipeError('Incorrect PIN.');
      return;
    }
    setWipeBusy(true);
    try {
      await wipeAllData();
      await refreshDb();
      bump();
      setWipeOpen(false);
      setWipePin('');
      await refreshAuth();
    } catch (e: any) {
      setWipeError(e?.message ?? 'Could not delete data.');
    } finally {
      setWipeBusy(false);
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
          title="Import from file"
          description="Restore expenses from an exported JSON file"
          left={(p) => <List.Icon {...p} icon="file-import-outline" />}
          onPress={() => setImportOpen(true)}
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
        <List.Subheader>Danger zone</List.Subheader>
        <List.Item
          title="Delete all data"
          description="Erase all expenses, settings, PIN and receipts"
          titleStyle={{ color: theme.colors.error }}
          left={(p) => <List.Icon {...p} icon="delete-forever-outline" color={theme.colors.error} />}
          onPress={() => {
            setWipePin('');
            setWipeError(null);
            setWipeOpen(true);
          }}
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

        <Dialog
          visible={importOpen}
          onDismiss={() => {
            if (!importBusy) setImportOpen(false);
          }}
        >
          <Dialog.Title>Import expenses</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 8 }}>
              Choose a JSON file you previously exported. Categories and payment
              methods are matched by name and created if missing. Receipt images
              are not included in exports.
            </Text>
            <Text style={{ opacity: 0.7 }}>
              • Merge adds the imported expenses to your existing ones.{'\n'}
              • Replace deletes all current expenses first.
            </Text>
            {importBusy && <ActivityIndicator style={{ marginTop: 12 }} />}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setImportOpen(false)} disabled={importBusy}>
              Cancel
            </Button>
            <Button onPress={() => runImport('merge')} disabled={importBusy}>
              Merge
            </Button>
            <Button
              onPress={() => runImport('replace')}
              disabled={importBusy}
              textColor={theme.colors.error}
            >
              Replace
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog
          visible={wipeOpen}
          onDismiss={() => {
            if (!wipeBusy) setWipeOpen(false);
          }}
        >
          <Dialog.Title>Delete all data?</Dialog.Title>
          <Dialog.Content>
            <Text style={{ marginBottom: 12 }}>
              This permanently erases all expenses, budgets, recurring rules,
              receipts, settings, and your PIN. This cannot be undone. Export a
              backup first if you want to keep your data.
            </Text>
            <TextInput
              label="Enter PIN to confirm"
              mode="outlined"
              keyboardType="number-pad"
              secureTextEntry
              value={wipePin}
              onChangeText={setWipePin}
              maxLength={6}
              autoFocus
            />
            {wipeBusy && <ActivityIndicator style={{ marginTop: 12 }} />}
            {wipeError && (
              <Text style={{ color: theme.colors.error, marginTop: 8 }}>{wipeError}</Text>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setWipeOpen(false)} disabled={wipeBusy}>
              Cancel
            </Button>
            <Button
              onPress={confirmWipe}
              disabled={wipeBusy || wipePin.length < 4}
              textColor={theme.colors.error}
            >
              Delete everything
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({});
