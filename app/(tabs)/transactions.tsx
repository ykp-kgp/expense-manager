import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, SectionList, Alert } from 'react-native';
import {
  Searchbar,
  Chip,
  Text,
  useTheme,
  FAB,
  Menu,
  IconButton,
  Appbar,
} from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useDb } from '@/lib/db-context';
import { useSettings } from '@/lib/settings-context';
import {
  listExpenses,
  deleteExpense,
  type ExpenseWithRefs,
} from '@/lib/queries';
import { ExpenseRow } from '@/components/ExpenseRow';
import { formatCurrency } from '@/lib/format';

type DateRange = 'this_month' | 'last_month' | 'last_3_months' | 'all';

export default function Transactions() {
  const theme = useTheme();
  const router = useRouter();
  const { categories, paymentMethods, ready, version, bump } = useDb();
  const { settings } = useSettings();

  const [search, setSearch] = useState('');
  const [range, setRange] = useState<DateRange>('this_month');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
  const [items, setItems] = useState<ExpenseWithRefs[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [catMenu, setCatMenu] = useState(false);
  const [pmMenu, setPmMenu] = useState(false);

  const filter = useMemo(() => {
    const now = new Date();
    let startDate: string | undefined;
    let endDate: string | undefined;
    if (range === 'this_month') {
      startDate = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');
    } else if (range === 'last_month') {
      startDate = format(new Date(now.getFullYear(), now.getMonth() - 1, 1), 'yyyy-MM-dd');
      endDate = format(new Date(now.getFullYear(), now.getMonth(), 0), 'yyyy-MM-dd');
    } else if (range === 'last_3_months') {
      startDate = format(new Date(now.getFullYear(), now.getMonth() - 2, 1), 'yyyy-MM-dd');
    }
    return {
      startDate,
      endDate,
      categoryId: categoryId ?? undefined,
      paymentMethodId: paymentMethodId ?? undefined,
      search: search.trim() || undefined,
    };
  }, [range, categoryId, paymentMethodId, search]);

  const load = useCallback(async () => {
    const rows = await listExpenses(filter);
    setItems(rows);
  }, [filter]);

  useEffect(() => {
    if (ready) load();
  }, [ready, version, load]);

  useFocusEffect(
    useCallback(() => {
      if (ready) load();
    }, [ready, load])
  );

  const sections = useMemo(() => {
    const map = new Map<string, ExpenseWithRefs[]>();
    for (const it of items) {
      const list = map.get(it.date) ?? [];
      list.push(it);
      map.set(it.date, list);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, data]) => {
        const total = data.reduce((s, x) => s + x.amount, 0);
        return {
          title: format(parseISO(date), 'EEEE, d MMM yyyy'),
          total,
          data,
        };
      });
  }, [items]);

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onItemPress = (item: ExpenseWithRefs) => {
    if (selected.size > 0) {
      toggleSelect(item.id);
    } else {
      router.push(`/modal/add-expense?id=${item.id}`);
    }
  };

  const deleteSelected = () => {
    Alert.alert(`Delete ${selected.size} expense(s)?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          for (const id of selected) await deleteExpense(id);
          setSelected(new Set());
          bump();
        },
      },
    ]);
  };

  return (
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      {selected.size > 0 ? (
        <Appbar.Header>
          <Appbar.Action icon="close" onPress={() => setSelected(new Set())} />
          <Appbar.Content title={`${selected.size} selected`} />
          <Appbar.Action icon="delete" onPress={deleteSelected} />
        </Appbar.Header>
      ) : (
        <View style={styles.searchWrap}>
          <Searchbar
            placeholder="Search amount or note"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      )}

      <View style={styles.filters}>
        {(['this_month', 'last_month', 'last_3_months', 'all'] as DateRange[]).map((r) => (
          <Chip
            key={r}
            selected={range === r}
            onPress={() => setRange(r)}
            style={styles.chip}
            compact
          >
            {labelFor(r)}
          </Chip>
        ))}
        <Menu
          visible={catMenu}
          onDismiss={() => setCatMenu(false)}
          anchor={
            <Chip
              icon="tag"
              selected={categoryId !== null}
              onPress={() => setCatMenu(true)}
              style={styles.chip}
              compact
            >
              {categoryId ? categories.find((c) => c.id === categoryId)?.name : 'All categories'}
            </Chip>
          }
        >
          <Menu.Item
            onPress={() => {
              setCategoryId(null);
              setCatMenu(false);
            }}
            title="All"
          />
          {categories.map((c) => (
            <Menu.Item
              key={c.id}
              onPress={() => {
                setCategoryId(c.id);
                setCatMenu(false);
              }}
              title={c.name}
            />
          ))}
        </Menu>
        <Menu
          visible={pmMenu}
          onDismiss={() => setPmMenu(false)}
          anchor={
            <Chip
              icon="credit-card"
              selected={paymentMethodId !== null}
              onPress={() => setPmMenu(true)}
              style={styles.chip}
              compact
            >
              {paymentMethodId
                ? paymentMethods.find((p) => p.id === paymentMethodId)?.name
                : 'All methods'}
            </Chip>
          }
        >
          <Menu.Item
            onPress={() => {
              setPaymentMethodId(null);
              setPmMenu(false);
            }}
            title="All"
          />
          {paymentMethods.map((p) => (
            <Menu.Item
              key={p.id}
              onPress={() => {
                setPaymentMethodId(p.id);
                setPmMenu(false);
              }}
              title={p.name}
            />
          ))}
        </Menu>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        contentContainerStyle={{ paddingBottom: 96 }}
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.sectionHeader,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text variant="labelLarge">{section.title}</Text>
            <Text variant="labelLarge">
              {formatCurrency(section.total, settings.currency)}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ opacity: 0.7 }}>No expenses match your filters.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ExpenseRow
            item={item}
            currency={settings.currency}
            selected={selected.has(item.id)}
            onPress={() => onItemPress(item)}
            onLongPress={() => toggleSelect(item.id)}
          />
        )}
      />

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => router.push('/modal/add-expense')}
      />
    </View>
  );
}

function labelFor(r: DateRange) {
  switch (r) {
    case 'this_month':
      return 'This month';
    case 'last_month':
      return 'Last month';
    case 'last_3_months':
      return 'Last 3 months';
    case 'all':
      return 'All time';
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchWrap: { padding: 12 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 6,
  },
  chip: { marginRight: 4, marginBottom: 4 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#0001', marginLeft: 68 },
  empty: { padding: 32, alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
