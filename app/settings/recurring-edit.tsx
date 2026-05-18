import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, Platform } from 'react-native';
import {
  Text,
  TextInput,
  SegmentedButtons,
  Button,
  useTheme,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CategoryGrid } from '@/components/CategoryGrid';
import { PaymentMethodChips } from '@/components/PaymentMethodChips';
import { useDb } from '@/lib/db-context';
import {
  createRecurringRule,
  updateRecurringRule,
  listRecurringRules,
} from '@/lib/queries';
import { nextRunFromStart } from '@/lib/recurring';
import { todayISO } from '@/lib/format';

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function RecurringEdit() {
  const theme = useTheme();
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
    if (paymentMethodId == null && paymentMethods.length)
      setPaymentMethodId(paymentMethods[0].id);
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
      if (editingId) {
        await updateRecurringRule(editingId, {
          amount: amt,
          categoryId,
          paymentMethodId,
          frequency,
          intervalCount: intv,
          startDate,
          nextRunDate: next,
          note: note || null,
        });
      } else {
        await createRecurringRule({
          amount: amt,
          categoryId,
          paymentMethodId,
          frequency,
          intervalCount: intv,
          startDate,
          nextRunDate: next,
          note: note || null,
          active: true,
          createdAt: new Date(),
        });
      }
      bump();
      router.back();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <TextInput
        label="Amount"
        mode="outlined"
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
      />

      <Text variant="titleSmall" style={styles.label}>
        Category
      </Text>
      <CategoryGrid
        items={categories}
        selectedId={categoryId}
        onSelect={setCategoryId}
      />

      <Text variant="titleSmall" style={styles.label}>
        Payment method
      </Text>
      <PaymentMethodChips
        items={paymentMethods}
        selectedId={paymentMethodId}
        onSelect={setPaymentMethodId}
      />

      <Text variant="titleSmall" style={styles.label}>
        Frequency
      </Text>
      <SegmentedButtons
        value={frequency}
        onValueChange={(v) => setFrequency(v as Frequency)}
        buttons={[
          { value: 'daily', label: 'Daily' },
          { value: 'weekly', label: 'Weekly' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'yearly', label: 'Yearly' },
        ]}
      />

      <TextInput
        label="Repeat every (interval)"
        mode="outlined"
        keyboardType="numeric"
        value={interval}
        onChangeText={setInterval}
        style={{ marginTop: 12 }}
      />

      <Button
        mode="outlined"
        icon="calendar"
        onPress={() => setShowDate(true)}
        style={{ marginTop: 12 }}
      >
        Start date: {format(parseISO(startDate), 'd MMM yyyy')}
      </Button>
      {showDate && (
        <DateTimePicker
          value={parseISO(startDate)}
          mode="date"
          onChange={(_, d) => {
            setShowDate(Platform.OS === 'ios');
            if (d) setStartDate(format(d, 'yyyy-MM-dd'));
          }}
        />
      )}

      <TextInput
        label="Note (optional)"
        mode="outlined"
        value={note}
        onChangeText={setNote}
        style={{ marginTop: 12 }}
      />

      <Button mode="contained" onPress={save} loading={busy} disabled={busy} style={{ marginTop: 24 }}>
        {editingId ? 'Update' : 'Save'}
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 8, paddingBottom: 32 },
  label: { marginTop: 12, marginLeft: 4 },
});
