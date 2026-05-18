import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import {
  Text,
  Card,
  Button,
  Dialog,
  Portal,
  TextInput,
  ProgressBar,
  useTheme,
  IconButton,
} from 'react-native-paper';
import { addMonths, format, subMonths } from 'date-fns';
import { useDb } from '@/lib/db-context';
import { useSettings } from '@/lib/settings-context';
import {
  budgetProgressForMonth,
  upsertBudget,
  deleteBudget,
  type BudgetProgress,
} from '@/lib/queries';
import { formatCurrency, monthKey } from '@/lib/format';

export default function BudgetsScreen() {
  const theme = useTheme();
  const { categories, ready, version, bump } = useDb();
  const { settings } = useSettings();
  const [month, setMonth] = useState(new Date());
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [editing, setEditing] = useState<{ categoryId: number | null; name: string } | null>(null);
  const [draft, setDraft] = useState('');

  const load = useCallback(async () => {
    setBudgets(await budgetProgressForMonth(monthKey(month)));
  }, [month]);

  useEffect(() => {
    if (ready) load();
  }, [ready, version, load]);

  const open = (categoryId: number | null, name: string) => {
    const existing = budgets.find((b) => b.categoryId === categoryId);
    setDraft(existing ? String(existing.amount) : '');
    setEditing({ categoryId, name });
  };

  const save = async () => {
    if (!editing) return;
    const amount = parseFloat(draft);
    if (isNaN(amount) || amount <= 0) {
      // allow delete via 0
      const existing = budgets.find((b) => b.categoryId === editing.categoryId);
      if (existing) await deleteBudget(existing.id);
    } else {
      await upsertBudget({
        categoryId: editing.categoryId,
        month: monthKey(month),
        amount,
      });
    }
    setEditing(null);
    setDraft('');
    bump();
    load();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.background }} contentContainerStyle={styles.content}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.monthRow}>
            <IconButton icon="chevron-left" onPress={() => setMonth((m) => subMonths(m, 1))} />
            <Text variant="titleMedium" style={{ flex: 1, textAlign: 'center' }}>
              {format(month, 'MMMM yyyy')}
            </Text>
            <IconButton icon="chevron-right" onPress={() => setMonth((m) => addMonths(m, 1))} />
          </View>
        </Card.Content>
      </Card>

      <BudgetItem
        name="Overall"
        currency={settings.currency}
        existing={budgets.find((b) => b.categoryId === null) ?? null}
        onEdit={() => open(null, 'Overall')}
      />

      <Text variant="labelLarge" style={styles.heading}>
        Per category
      </Text>
      {categories.map((c) => (
        <BudgetItem
          key={c.id}
          name={c.name}
          color={c.color}
          currency={settings.currency}
          existing={budgets.find((b) => b.categoryId === c.id) ?? null}
          onEdit={() => open(c.id, c.name)}
        />
      ))}

      <Portal>
        <Dialog visible={!!editing} onDismiss={() => setEditing(null)}>
          <Dialog.Title>{editing?.name} budget</Dialog.Title>
          <Dialog.Content>
            <TextInput
              mode="outlined"
              label="Amount (0 to remove)"
              keyboardType="numeric"
              value={draft}
              onChangeText={setDraft}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setEditing(null)}>Cancel</Button>
            <Button onPress={save}>Save</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

function BudgetItem({
  name,
  color,
  currency,
  existing,
  onEdit,
}: {
  name: string;
  color?: string;
  currency: string;
  existing: BudgetProgress | null;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const has = !!existing;
  const pct = has && existing!.amount > 0 ? Math.min(existing!.spent / existing!.amount, 1) : 0;
  const over = has && existing!.spent > existing!.amount;
  return (
    <Card style={styles.itemCard} onPress={onEdit}>
      <Card.Content>
        <View style={styles.itemRow}>
          <Text variant="titleSmall" style={{ flex: 1 }}>
            {name}
          </Text>
          <Text style={{ fontWeight: '600', color: over ? theme.colors.error : theme.colors.onSurface }}>
            {has
              ? `${formatCurrency(existing!.spent, currency)} / ${formatCurrency(existing!.amount, currency)}`
              : 'Not set'}
          </Text>
        </View>
        {has && (
          <ProgressBar
            progress={pct}
            color={over ? theme.colors.error : color ?? theme.colors.primary}
            style={{ marginTop: 8, height: 6, borderRadius: 3 }}
          />
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 8, paddingBottom: 32 },
  card: { borderRadius: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  itemCard: { borderRadius: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  heading: { marginTop: 16, marginLeft: 8, opacity: 0.8 },
});
