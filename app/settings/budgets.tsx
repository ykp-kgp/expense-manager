import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
import { AppText, Screen } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

export default function BudgetsScreen() {
  const { ios } = useAppTheme();
  const p = ios.palette;
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
      const existing = budgets.find((b) => b.categoryId === editing.categoryId);
      if (existing) await deleteBudget(existing.id);
    } else {
      await upsertBudget({ categoryId: editing.categoryId, month: monthKey(month), amount });
    }
    setEditing(null);
    setDraft('');
    bump();
    load();
  };

  const atCurrentMonth = monthKey(month) === monthKey(new Date());

  return (
    <Screen scroll>
      {/* Month stepper */}
      <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
        <View style={styles.monthRow}>
          <StepButton icon="chevron-left" onPress={() => setMonth((m) => subMonths(m, 1))} />
          <AppText variant="headline">{format(month, 'MMMM yyyy')}</AppText>
          <StepButton
            icon="chevron-right"
            disabled={atCurrentMonth}
            onPress={() => setMonth((m) => addMonths(m, 1))}
          />
        </View>
      </View>

      <AppText variant="footnote" tone="secondary" style={styles.groupTitle}>
        OVERALL
      </AppText>
      <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
        <BudgetItem
          name="Overall"
          currency={settings.currency}
          existing={budgets.find((b) => b.categoryId === null) ?? null}
          onEdit={() => open(null, 'Overall')}
        />
      </View>

      <AppText variant="footnote" tone="secondary" style={styles.groupTitle}>
        PER CATEGORY
      </AppText>
      <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
        {categories.map((c, i) => (
          <View key={c.id}>
            <BudgetItem
              name={c.name}
              color={c.color}
              currency={settings.currency}
              existing={budgets.find((b) => b.categoryId === c.id) ?? null}
              onEdit={() => open(c.id, c.name)}
            />
            {i < categories.length - 1 ? (
              <View style={[styles.sep, { backgroundColor: p.separator }]} />
            ) : null}
          </View>
        ))}
      </View>

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
    </Screen>
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
  const { ios } = useAppTheme();
  const p = ios.palette;
  const has = !!existing;
  const pct = has && existing!.amount > 0 ? Math.min(existing!.spent / existing!.amount, 1) : 0;
  const over = has && existing!.spent > existing!.amount;
  const barColor = over ? p.negative : color ?? p.tint;
  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: p.fill }]}
    >
      <View style={styles.itemRow}>
        <AppText variant="body" weight="600" style={{ flex: 1 }} numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="subhead" tone={over ? 'negative' : 'secondary'}>
          {has
            ? `${formatCurrency(existing!.spent, currency)} / ${formatCurrency(existing!.amount, currency)}`
            : 'Not set'}
        </AppText>
      </View>
      {has ? (
        <View style={[styles.track, { backgroundColor: p.fill }]}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
        </View>
      ) : null}
    </Pressable>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
}: {
  icon: 'chevron-left' | 'chevron-right';
  onPress: () => void;
  disabled?: boolean;
}) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={({ pressed }) => [
        styles.step,
        { backgroundColor: p.fill },
        pressed && !disabled ? { opacity: 0.6 } : null,
      ]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={disabled ? p.tertiaryLabel : p.tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.sm },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { marginLeft: spacing.lg + spacing.xs, marginTop: spacing.md, marginBottom: spacing.sm, letterSpacing: 0.5 },
  item: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: spacing.lg },
});
