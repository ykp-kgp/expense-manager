import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Image, Alert, Platform } from 'react-native';
import {
  Text,
  Button,
  TextInput,
  IconButton,
  useTheme,
  Divider,
  Dialog,
  Portal,
  ActivityIndicator,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, parseISO } from 'date-fns';
import { AmountKeypad } from '@/components/AmountKeypad';
import { CategoryGrid } from '@/components/CategoryGrid';
import { PaymentMethodChips } from '@/components/PaymentMethodChips';
import { useDb } from '@/lib/db-context';
import { useSettings } from '@/lib/settings-context';
import {
  createExpense,
  deleteExpense,
  getExpense,
  updateExpense,
} from '@/lib/queries';
import { CURRENCY_SYMBOLS, todayISO } from '@/lib/format';
import {
  canAddTransaction,
  recordTransactionAdded,
  grantAdReward,
  getTransactionUsage,
  getDailyFreeLimit,
  getRewardPerAd,
  type TransactionUsage,
} from '@/lib/limits';
import { showRewardedAd, adsSupported } from '@/lib/ads';

const RECEIPTS_DIR = FileSystem.documentDirectory + 'receipts/';

async function ensureReceiptsDir() {
  const info = await FileSystem.getInfoAsync(RECEIPTS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(RECEIPTS_DIR, { intermediates: true });
}

export default function AddExpenseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? parseInt(params.id, 10) : null;
  const { categories, paymentMethods, bump } = useDb();
  const { settings } = useSettings();
  const symbol = CURRENCY_SYMBOLS[settings.currency] ?? settings.currency;

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [showDate, setShowDate] = useState(false);
  const [note, setNote] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [usage, setUsage] = useState<TransactionUsage | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const [adBusy, setAdBusy] = useState(false);

  const limitEnforced = !editingId && adsSupported();

  useEffect(() => {
    if (editingId) return;
    getTransactionUsage().then(setUsage).catch(() => undefined);
  }, [editingId]);

  useEffect(() => {
    if (categoryId == null && categories.length) setCategoryId(categories[0].id);
    if (paymentMethodId == null && paymentMethods.length)
      setPaymentMethodId(paymentMethods[0].id);
  }, [categories, paymentMethods, categoryId, paymentMethodId]);

  useEffect(() => {
    (async () => {
      if (editingId) {
        const ex = await getExpense(editingId);
        if (ex) {
          setAmount(String(ex.amount));
          setCategoryId(ex.categoryId);
          setPaymentMethodId(ex.paymentMethodId);
          setDate(ex.date);
          setNote(ex.note ?? '');
          setAttachment(ex.attachmentPath ?? null);
        }
      }
    })();
  }, [editingId]);

  const numericAmount = useMemo(() => {
    const v = parseFloat(amount);
    return isNaN(v) ? 0 : v;
  }, [amount]);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow photo access to attach receipts.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (res.canceled || !res.assets?.length) return;
    await ensureReceiptsDir();
    const src = res.assets[0].uri;
    const ext = src.split('.').pop() ?? 'jpg';
    const dest = `${RECEIPTS_DIR}receipt-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: src, to: dest });
    setAttachment(dest);
  };

  const removeAttachment = async () => {
    if (attachment) {
      try {
        await FileSystem.deleteAsync(attachment, { idempotent: true });
      } catch {}
    }
    setAttachment(null);
  };

  const persist = async () => {
    setBusy(true);
    try {
      const now = new Date();
      if (editingId) {
        await updateExpense(editingId, {
          amount: numericAmount,
          categoryId: categoryId!,
          paymentMethodId: paymentMethodId!,
          date,
          note: note || null,
          attachmentPath: attachment,
          updatedAt: now,
        });
      } else {
        await createExpense({
          amount: numericAmount,
          categoryId: categoryId!,
          paymentMethodId: paymentMethodId!,
          date,
          note: note || null,
          attachmentPath: attachment,
          createdAt: now,
          updatedAt: now,
        });
        await recordTransactionAdded();
      }
      bump();
      router.back();
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (numericAmount <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    if (!categoryId || !paymentMethodId) return;
    if (limitEnforced && !(await canAddTransaction())) {
      setLimitOpen(true);
      return;
    }
    await persist();
  };

  const watchAdToContinue = async () => {
    setAdBusy(true);
    try {
      const result = await showRewardedAd();
      if (result === 'dismissed') {
        Alert.alert(
          'Ad not completed',
          'Please watch the full ad to unlock more entries for today.'
        );
        return;
      }
      // Reward a completed view; fail open when an ad simply can't be served
      // so a flaky ad network never blocks the core "add expense" action.
      if (result === 'earned') {
        await grantAdReward();
      }
      setLimitOpen(false);
      await persist();
    } catch {
      // Treat unexpected ad errors as "unavailable" and let the user continue.
      setLimitOpen(false);
      await persist();
    } finally {
      setAdBusy(false);
    }
  };

  const remove = async () => {
    if (!editingId) return;
    Alert.alert('Delete expense?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(editingId);
          bump();
          router.back();
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.colors.background }} contentContainerStyle={styles.container}>
      <View style={styles.amountBox}>
        <Text variant="titleMedium" style={{ opacity: 0.6 }}>
          Amount
        </Text>
        <Text variant="displaySmall" style={{ fontWeight: '700' }}>
          {symbol}
          {amount || '0'}
        </Text>
        {limitEnforced && usage && (
          <Text
            variant="labelMedium"
            style={{
              marginTop: 6,
              color: usage.remaining > 0 ? theme.colors.onSurfaceVariant : theme.colors.error,
            }}
          >
            {usage.remaining > 0
              ? `${usage.remaining} of ${getDailyFreeLimit()} free ${
                  usage.remaining === 1 ? 'entry' : 'entries'
                } left today`
              : 'Daily limit reached — watch an ad to add more'}
          </Text>
        )}
      </View>
      <AmountKeypad value={amount} onChange={setAmount} />

      <Divider style={styles.divider} />
      <Text variant="titleSmall" style={styles.section}>
        Category
      </Text>
      <CategoryGrid
        items={categories}
        selectedId={categoryId}
        onSelect={setCategoryId}
      />

      <Text variant="titleSmall" style={styles.section}>
        Payment method
      </Text>
      <PaymentMethodChips
        items={paymentMethods}
        selectedId={paymentMethodId}
        onSelect={setPaymentMethodId}
      />

      <View style={styles.row}>
        <Button
          mode="outlined"
          icon="calendar"
          onPress={() => setShowDate(true)}
          style={{ flex: 1 }}
        >
          {format(parseISO(date), 'd MMM yyyy')}
        </Button>
      </View>
      {showDate && (
        <DateTimePicker
          value={parseISO(date)}
          mode="date"
          maximumDate={new Date()}
          onChange={(_, d) => {
            setShowDate(Platform.OS === 'ios');
            if (d) setDate(format(d, 'yyyy-MM-dd'));
          }}
        />
      )}

      <TextInput
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        mode="outlined"
        multiline
        style={styles.input}
      />

      <View style={styles.row}>
        <Button mode="outlined" icon="paperclip" onPress={pickImage} style={{ flex: 1 }}>
          {attachment ? 'Change receipt' : 'Attach receipt'}
        </Button>
        {attachment && (
          <IconButton icon="close" onPress={removeAttachment} />
        )}
      </View>
      {attachment && (
        <Image source={{ uri: attachment }} style={styles.preview} resizeMode="cover" />
      )}

      <View style={styles.actions}>
        {editingId ? (
          <Button mode="text" textColor={theme.colors.error} onPress={remove}>
            Delete
          </Button>
        ) : (
          <View />
        )}
        <Button mode="contained" onPress={save} loading={busy} disabled={busy}>
          {editingId ? 'Update' : 'Save'}
        </Button>
      </View>

      <Portal>
        <Dialog
          visible={limitOpen}
          onDismiss={() => {
            if (!adBusy) setLimitOpen(false);
          }}
        >
          <Dialog.Icon icon="movie-play-outline" />
          <Dialog.Title style={{ textAlign: 'center' }}>Daily limit reached</Dialog.Title>
          <Dialog.Content>
            <Text style={{ textAlign: 'center' }}>
              You&apos;ve used your {getDailyFreeLimit()} free entries for today. Watch a
              short ad to add {getRewardPerAd()} more, or come back tomorrow.
            </Text>
            {adBusy && <ActivityIndicator style={{ marginTop: 16 }} />}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setLimitOpen(false)} disabled={adBusy}>
              Not now
            </Button>
            <Button
              mode="contained"
              icon="play"
              onPress={watchAdToContinue}
              loading={adBusy}
              disabled={adBusy}
            >
              Watch ad (+{getRewardPerAd()})
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, paddingBottom: 32 },
  amountBox: { alignItems: 'center', paddingVertical: 8 },
  divider: { marginVertical: 12 },
  section: { marginTop: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  input: { marginTop: 12 },
  preview: { width: '100%', height: 180, borderRadius: 12, marginTop: 8 },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
});
