import { useEffect, useState } from 'react';
import { StyleSheet, Platform, Pressable, View } from 'react-native';
import { TextInput, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CategoryGrid } from '@/components/CategoryGrid';
import { PaymentMethodChips } from '@/components/PaymentMethodChips';
import { useDb } from '@/lib/db-context';
import { createRecurringRule, updateRecurringRule, listRecurringRules } from '@/lib/queries';
import { nextRunFromStart } from '@/lib/recurring';
import { todayISO } from '@/lib/format';
import { AppText, Screen, Segmented } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function RecurringEdit() {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editingId = params.id ? parseInt(params.id, 10) : null;
  const { categories, paymentMethods, bump } = useDb();

  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [interval, setInterval] = useState('1');
  const [startDate, setStartDate] = useState(todayISO());
  const [showDate, setShowDate] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (categoryId == null && categories.length) setCategoryId(categories[0].id);
    if (paymentMethodId == null && paymentMethods.length) setPaymentMethodId(paymentMethods[0].id);
  }, [categories, paymentMethods, categoryId, paymentMethodId]);

  useEffect(() => {
    (async () => {
      if (!editingId) return;
      const all = await listRecurringRules();
      const r = all.find((x: any) => x.id === editingId);
      if (!r) return;
      setAmount(String(r.amount));
      setCategoryId(r.category_id);
      setPaymentMethodId(r.payment_method_id);
      setFrequency(r.frequency);
      setInterval(String(r.interval_count));
      setStartDate(r.start_date);
      setNote(r.note ?? '');
    })();
  }, [editingId]);

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || !categoryId || !paymentMethodId) return;
    setBusy(true);
    try {
      const intv = Math.max(1, parseInt(interval, 10) || 1);
      const next = nextRunFromStart(startDate, frequency, intv);
      const payload = {
        amount: amt,
        categoryId,
        paymentMethodId,
        frequency,
        intervalCount: intv,
        startDate,
        nextRunDate: next,
        note: note || null,
      };
      if (editingId) await updateRecurringRule(editingId, payload);
      else await createRecurringRule({ ...payload, active: true, createdAt: new Date() });
      bump();
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll padded={false} contentStyle={{ paddingVertical: spacing.lg, gap: spacing.sm }}>
      <View style={styles.inset}>
        <TextInput label="Amount" mode="outlined" keyboardType="numeric" value={amount} onChangeText={setAmount} />
      </View>

      <Label>Category</Label>
      <CategoryGrid items={categories} selectedId={categoryId} onSelect={setCategoryId} />

      <Label>Payment method</Label>
      <PaymentMethodChips items={paymentMethods} selectedId={paymentMethodId} onSelect={setPaymentMethodId} />

      <Label>Frequency</Label>
      <View style={styles.inset}>
        <Segmented
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
          value={frequency}
          onChange={(v) => setFrequency(v as Frequency)}
        />
        <TextInput
          label="Repeat every (interval)"
          mode="outlined"
          keyboardType="numeric"
          value={interval}
          onChangeText={setInterval}
          style={{ marginTop: spacing.md }}
        />

        <Pressable
          onPress={() => setShowDate(true)}
          style={[styles.dateRow, { backgroundColor: p.groupedCard }]}
        >
          <MaterialCommunityIcons name="calendar" size={20} color={p.tint} />
          <AppText variant="body" style={{ flex: 1 }}>Start date</AppText>
          <AppText variant="body" tone="secondary">{format(parseISO(startDate), 'd MMM yyyy')}</AppText>
        </Pressable>
        {showDate ? (
          <DateTimePicker
            value={parseISO(startDate)}
            mode="date"
            onChange={(_, d) => {
              setShowDate(Platform.OS === 'ios');
              if (d) setStartDate(format(d, 'yyyy-MM-dd'));
            }}
          />
        ) : null}

        <TextInput
          label="Note (optional)"
          mode="outlined"
          value={note}
          onChangeText={setNote}
          style={{ marginTop: spacing.md }}
        />

        <Button
          mode="contained"
          onPress={save}
          loading={busy}
          disabled={busy}
          style={styles.save}
          contentStyle={styles.saveContent}
        >
          {editingId ? 'Update' : 'Save'}
        </Button>
      </View>
    </Screen>
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
  inset: { paddingHorizontal: spacing.lg },
  label: { marginTop: spacing.md, marginBottom: spacing.sm, marginLeft: spacing.lg + spacing.xs, letterSpacing: 0.5 },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 50,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  save: { marginTop: spacing.xl, borderRadius: radius.md },
  saveContent: { paddingVertical: spacing.xs },
});
