import { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, Image, Alert, Platform, Pressable } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { createExpense, deleteExpense, getExpense, updateExpense } from '@/lib/queries';
import { CURRENCY_SYMBOLS, todayISO } from '@/lib/format';
import { AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

const RECEIPTS_DIR = FileSystem.documentDirectory + 'receipts/';

async function ensureReceiptsDir() {
  const info = await FileSystem.getInfoAsync(RECEIPTS_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(RECEIPTS_DIR, { intermediates: true });
}

export default function AddExpenseScreen() {
  const { ios } = useAppTheme();
  const p = ios.palette;
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

  useEffect(() => {
    if (categoryId == null && categories.length) setCategoryId(categories[0].id);
    if (paymentMethodId == null && paymentMethods.length) setPaymentMethodId(paymentMethods[0].id);
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
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
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

  const save = async () => {
    if (numericAmount <= 0) {
      Alert.alert('Enter an amount');
      return;
    }
    if (!categoryId || !paymentMethodId) return;
    setBusy(true);
    try {
      const now = new Date();
      const payload = {
        amount: numericAmount,
        categoryId,
        paymentMethodId,
        date,
        note: note || null,
        attachmentPath: attachment,
        updatedAt: now,
      };
      if (editingId) await updateExpense(editingId, payload);
      else await createExpense({ ...payload, createdAt: now });
      bump();
      router.back();
    } finally {
      setBusy(false);
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
    <View style={[styles.flex, { backgroundColor: p.background }]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Amount */}
        <View style={styles.amountBox}>
          <AppText variant="footnote" tone="secondary" style={styles.eyebrow}>
            AMOUNT
          </AppText>
          <AppText variant="largeTitle" weight="700" style={{ fontSize: 48, lineHeight: 56 }}>
            {symbol}
            {amount || '0'}
          </AppText>
        </View>
        <AmountKeypad value={amount} onChange={setAmount} />

        <Label>Category</Label>
        <CategoryGrid items={categories} selectedId={categoryId} onSelect={setCategoryId} />

        <Label>Payment method</Label>
        <PaymentMethodChips items={paymentMethods} selectedId={paymentMethodId} onSelect={setPaymentMethodId} />

        <View style={styles.inset}>
          <Pressable
            onPress={() => setShowDate(true)}
            style={[styles.dateRow, { backgroundColor: p.groupedCard }]}
          >
            <MaterialCommunityIcons name="calendar" size={20} color={p.tint} />
            <AppText variant="body" style={{ flex: 1 }}>Date</AppText>
            <AppText variant="body" tone="secondary">{format(parseISO(date), 'd MMM yyyy')}</AppText>
          </Pressable>
          {showDate ? (
            <DateTimePicker
              value={parseISO(date)}
              mode="date"
              maximumDate={new Date()}
              onChange={(_, d) => {
                setShowDate(Platform.OS === 'ios');
                if (d) setDate(format(d, 'yyyy-MM-dd'));
              }}
            />
          ) : null}

          <TextInput
            label="Note (optional)"
            value={note}
            onChangeText={setNote}
            mode="outlined"
            multiline
            style={styles.input}
          />

          <Pressable
            onPress={pickImage}
            style={[styles.dateRow, { backgroundColor: p.groupedCard, marginTop: spacing.md }]}
          >
            <MaterialCommunityIcons name="paperclip" size={20} color={p.tint} />
            <AppText variant="body" style={{ flex: 1 }}>
              {attachment ? 'Change receipt' : 'Attach receipt'}
            </AppText>
            {attachment ? (
              <Pressable onPress={removeAttachment} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle" size={20} color={p.tertiaryLabel} />
              </Pressable>
            ) : (
              <MaterialCommunityIcons name="chevron-right" size={20} color={p.tertiaryLabel} />
            )}
          </Pressable>
          {attachment ? (
            <Image source={{ uri: attachment }} style={styles.preview} resizeMode="cover" />
          ) : null}

          <Button
            mode="contained"
            onPress={save}
            loading={busy}
            disabled={busy}
            style={styles.save}
            contentStyle={styles.saveContent}
          >
            {editingId ? 'Update expense' : 'Save expense'}
          </Button>
          {editingId ? (
            <Button mode="text" textColor={p.negative} onPress={remove}>
              Delete
            </Button>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return (
    <AppText variant="footnote" tone="secondary" style={styles.label}>
      {children.toUpperCase()}
    </AppText>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingVertical: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.sm },
  amountBox: { alignItems: 'center', paddingVertical: spacing.md },
  eyebrow: { letterSpacing: 0.5, marginBottom: spacing.xs },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.lg + spacing.xs, letterSpacing: 0.5 },
  inset: { paddingHorizontal: spacing.lg },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
    borderRadius: radius.md,
  },
  input: { marginTop: spacing.md },
  preview: { width: '100%', height: 180, borderRadius: radius.lg, marginTop: spacing.md },
  save: { marginTop: spacing.xl, borderRadius: radius.md },
  saveContent: { paddingVertical: spacing.xs },
});
