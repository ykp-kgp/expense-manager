import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { Text, Card, useTheme, FAB, ProgressBar, Button } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
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

export default function Dashboard() {
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSettings();
  const { ready, version } = useDb();
  const [recent, setRecent] = useState<ExpenseWithRefs[]>([]);
  const [thisMonth, setThisMonth] = useState(0);
  const [lastMonth, setLastMonth] = useState(0);
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [r, t, p, b] = await Promise.all([
      listExpenses({ limit: 5 }),
      monthTotal(),
      previousMonthTotal(),
      budgetProgressForMonth(monthKey()),
    ]);
    setRecent(r);
    setThisMonth(t);
    setLastMonth(p);
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
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={styles.heroCard}>
          <Card.Content>
            <Text variant="labelLarge" style={{ opacity: 0.8 }}>
              This month
            </Text>
            <Text variant="displaySmall" style={{ fontWeight: '700' }}>
              {formatCurrency(thisMonth, settings.currency)}
            </Text>
            {deltaPct != null && (
              <Text
                variant="bodyMedium"
                style={{
                  color: delta >= 0 ? theme.colors.error : theme.colors.primary,
                  marginTop: 4,
                }}
              >
                {delta >= 0 ? '▲' : '▼'} {Math.abs(deltaPct)}% vs last month
              </Text>
            )}
          </Card.Content>
        </Card>

        {budgets.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text variant="titleMedium">Budgets</Text>
              <Button compact onPress={() => router.push('/settings/budgets')}>
                Manage
              </Button>
            </View>
            {budgets.slice(0, 4).map((b) => {
              const pct = b.amount > 0 ? Math.min(b.spent / b.amount, 1) : 0;
              const over = b.spent > b.amount;
              return (
                <Card key={b.id} style={styles.budgetCard}>
                  <Card.Content>
                    <View style={styles.budgetRow}>
                      <Text variant="titleSmall">
                        {b.categoryName ?? 'Overall'}
                      </Text>
                      <Text
                        style={{
                          color: over ? theme.colors.error : theme.colors.onSurface,
                          fontWeight: '600',
                        }}
                      >
                        {formatCurrency(b.spent, settings.currency)} /{' '}
                        {formatCurrency(b.amount, settings.currency)}
                      </Text>
                    </View>
                    <ProgressBar
                      progress={pct}
                      color={over ? theme.colors.error : (b.categoryColor ?? theme.colors.primary)}
                      style={{ marginTop: 8, height: 8, borderRadius: 4 }}
                    />
                  </Card.Content>
                </Card>
              );
            })}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text variant="titleMedium">Recent</Text>
            <Button compact onPress={() => router.push('/(tabs)/transactions')}>
              See all
            </Button>
          </View>
          {recent.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
                <Text variant="titleMedium">No expenses yet</Text>
                <Text style={{ textAlign: 'center', opacity: 0.7 }}>
                  Start tracking your spending. Add your first expense and it will
                  show up here, in reports, and against your budgets.
                </Text>
                <Button
                  mode="contained"
                  icon="plus"
                  onPress={() => router.push('/modal/add-expense')}
                  style={{ marginTop: 8 }}
                >
                  Add your first expense
                </Button>
              </Card.Content>
            </Card>
          ) : (
            <Card>
              {recent.map((r) => (
                <ExpenseRow
                  key={r.id}
                  item={r}
                  currency={settings.currency}
                  onPress={() => router.push(`/modal/add-expense?id=${r.id}`)}
                  showDate
                />
              ))}
            </Card>
          )}
        </View>
      </ScrollView>

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => router.push('/modal/add-expense')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 96, gap: 16 },
  heroCard: { borderRadius: 20 },
  section: { gap: 8 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  budgetCard: { borderRadius: 16 },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emptyCard: { borderRadius: 16 },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
