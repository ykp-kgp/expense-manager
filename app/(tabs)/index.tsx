import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useDb } from '@/lib/db-context';
import { useSettings } from '@/lib/settings-context';
import {
  listExpenses,
  monthTotal,
  previousMonthTotal,
  budgetProgressForMonth,
  type ExpenseWithRefs,
  type BudgetProgress,
} from '@/lib/queries';
import { ExpenseRow } from '@/components/ExpenseRow';
import { formatCurrency, monthKey } from '@/lib/format';
import { AppText, Screen, LargeTitle } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

export default function Dashboard() {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const router = useRouter();
  const { settings } = useSettings();
  const { ready, version } = useDb();
  const [recent, setRecent] = useState<ExpenseWithRefs[]>([]);
  const [thisMonth, setThisMonth] = useState(0);
  const [lastMonth, setLastMonth] = useState(0);
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [r, t, pm, b] = await Promise.all([
      listExpenses({ limit: 5 }),
      monthTotal(),
      previousMonthTotal(),
      budgetProgressForMonth(monthKey()),
    ]);
    setRecent(r);
    setThisMonth(t);
    setLastMonth(pm);
    setBudgets(b);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, version, load]);

  useFocusEffect(
    useCallback(() => {
      if (ready) load();
    }, [ready, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const delta = thisMonth - lastMonth;
  const deltaPct = lastMonth > 0 ? Math.round((delta / lastMonth) * 100) : null;

  return (
    <Screen
      scroll
      padded={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={p.secondaryLabel} />}
    >
      <LargeTitle
        title="Summary"
        subtitle={format(new Date(), 'MMMM yyyy')}
        trailing={<AddButton onPress={() => router.push('/modal/add-expense')} />}
      />

      <View style={styles.body}>
        {/* Signature: one bold number carries the screen. */}
        <View style={[styles.hero, { backgroundColor: p.groupedCard }]}>
          <AppText variant="footnote" tone="secondary" style={styles.heroLabel}>
            SPENT THIS MONTH
          </AppText>
          <AppText variant="largeTitle" weight="700" style={styles.heroAmount}>
            {formatCurrency(thisMonth, settings.currency)}
          </AppText>
          {deltaPct != null ? (
            <View style={styles.deltaRow}>
              <MaterialCommunityIcons
                name={delta >= 0 ? 'arrow-up' : 'arrow-down'}
                size={15}
                color={delta >= 0 ? p.negative : p.positive}
              />
              <AppText variant="subhead" weight="600" tone={delta >= 0 ? 'negative' : 'positive'}>
                {Math.abs(deltaPct)}%
              </AppText>
              <AppText variant="subhead" tone="secondary">
                vs last month
              </AppText>
            </View>
          ) : (
            <AppText variant="subhead" tone="secondary" style={styles.deltaRow}>
              No spending last month to compare
            </AppText>
          )}
        </View>

        {budgets.length > 0 ? (
          <Group title="Budgets" action="Manage" onAction={() => router.push('/settings/budgets')}>
            <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
              {budgets.slice(0, 4).map((b, i, arr) => {
                const pct = b.amount > 0 ? Math.min(b.spent / b.amount, 1) : 0;
                const over = b.spent > b.amount;
                const barColor = over ? p.negative : b.categoryColor ?? p.tint;
                return (
                  <View key={b.id} style={styles.budgetItem}>
                    <View style={styles.budgetTop}>
                      <AppText variant="subhead" weight="600">
                        {b.categoryName ?? 'Overall'}
                      </AppText>
                      <AppText variant="subhead" tone={over ? 'negative' : 'secondary'}>
                        {formatCurrency(b.spent, settings.currency)} / {formatCurrency(b.amount, settings.currency)}
                      </AppText>
                    </View>
                    <View style={[styles.track, { backgroundColor: p.fill }]}>
                      <View
                        style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: barColor }]}
                      />
                    </View>
                    {i < arr.length - 1 ? (
                      <View style={[styles.budgetSep, { backgroundColor: p.separator }]} />
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Group>
        ) : null}

        <Group title="Recent" action="See All" onAction={() => router.push('/(tabs)/transactions')}>
          <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
            {recent.length === 0 ? (
              <View style={styles.empty}>
                <MaterialCommunityIcons name="tray-arrow-down" size={28} color={p.tertiaryLabel} />
                <AppText variant="subhead" tone="secondary" style={{ textAlign: 'center' }}>
                  No expenses yet. Tap + to add your first one.
                </AppText>
              </View>
            ) : (
              recent.map((r, i) => (
                <View key={r.id}>
                  <ExpenseRow
                    item={r}
                    currency={settings.currency}
                    onPress={() => router.push(`/modal/add-expense?id=${r.id}`)}
                    showDate
                  />
                  {i < recent.length - 1 ? (
                    <View style={[styles.sep, { backgroundColor: p.separator }]} />
                  ) : null}
                </View>
              ))
            )}
          </View>
        </Group>
      </View>
    </Screen>
  );
}

function AddButton({ onPress }: { onPress: () => void }) {
  const { ios } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityLabel="Add expense"
      accessibilityRole="button"
      style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.5 }]}
    >
      <MaterialCommunityIcons name="plus" size={26} color={ios.palette.tint} />
    </Pressable>
  );
}

function Group({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <AppText variant="footnote" tone="secondary" style={styles.groupTitle}>
          {title.toUpperCase()}
        </AppText>
        {action ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <AppText variant="subhead" tone="tint">
              {action}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, gap: spacing.xxl, paddingTop: spacing.sm },
  addBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  hero: {
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  heroLabel: { letterSpacing: 0.5 },
  heroAmount: { marginTop: spacing.xs, marginBottom: spacing.sm },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },

  group: { gap: spacing.sm },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  groupTitle: { letterSpacing: 0.5 },

  card: { borderRadius: radius.lg, overflow: 'hidden' },
  budgetItem: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  budgetTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  budgetSep: { height: StyleSheet.hairlineWidth, marginTop: spacing.md, marginHorizontal: -spacing.lg },

  sep: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  empty: { padding: spacing.xxl, alignItems: 'center', gap: spacing.sm },
});
