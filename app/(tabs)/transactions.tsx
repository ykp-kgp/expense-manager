import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, SectionList, Alert, Pressable } from 'react-native';
import { Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useDb } from '@/lib/db-context';
import { useSettings } from '@/lib/settings-context';
import { listExpenses, deleteExpense, type ExpenseWithRefs } from '@/lib/queries';
import { ExpenseRow } from '@/components/ExpenseRow';
import { formatCurrency } from '@/lib/format';
import { AppText, LargeTitle, Segmented, SearchField } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

type DateRange = 'this_month' | 'last_month' | 'last_3_months' | 'all';

const RANGE_OPTIONS = [
  { value: 'this_month' as const, label: 'Month' },
  { value: 'last_month' as const, label: 'Last' },
  { value: 'last_3_months' as const, label: '3 Mo' },
  { value: 'all' as const, label: 'All' },
];

export default function Transactions() {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
    setItems(await listExpenses(filter));
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
      .map(([date, data]) => ({
        title: format(parseISO(date), 'EEEE, d MMMM'),
        total: data.reduce((s, x) => s + x.amount, 0),
        data,
      }));
  }, [items]);

  const toggleSelect = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const onItemPress = (item: ExpenseWithRefs) => {
    if (selected.size > 0) toggleSelect(item.id);
    else router.push(`/modal/add-expense?id=${item.id}`);
  };

  const deleteSelected = () => {
    Alert.alert(`Delete ${selected.size} expense${selected.size === 1 ? '' : 's'}?`, 'This cannot be undone.', [
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

  const catLabel = categoryId ? categories.find((c) => c.id === categoryId)?.name ?? 'Category' : 'Category';
  const pmLabel = paymentMethodId ? paymentMethods.find((m) => m.id === paymentMethodId)?.name ?? 'Method' : 'Method';

  return (
    <View style={[styles.flex, { backgroundColor: p.background }]}>
      {selected.size > 0 ? (
        <View style={[styles.selectionBar, { paddingTop: insets.top + spacing.sm, borderBottomColor: p.separator }]}>
          <Pressable onPress={() => setSelected(new Set())} hitSlop={8}>
            <AppText variant="body" tone="tint">Cancel</AppText>
          </Pressable>
          <AppText variant="headline">{selected.size} selected</AppText>
          <Pressable onPress={deleteSelected} hitSlop={8}>
            <AppText variant="body" tone="negative" weight="600">Delete</AppText>
          </Pressable>
        </View>
      ) : (
        <LargeTitle
          title="Activity"
          trailing={
            <Pressable
              onPress={() => router.push('/modal/add-expense')}
              hitSlop={10}
              accessibilityLabel="Add expense"
              style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.5 }]}
            >
              <MaterialCommunityIcons name="plus" size={26} color={p.tint} />
            </Pressable>
          }
        />
      )}

      <View style={styles.controls}>
        <SearchField value={search} onChangeText={setSearch} placeholder="Search amount or note" />
        <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
        <View style={styles.filterRow}>
          <Menu
            visible={catMenu}
            onDismiss={() => setCatMenu(false)}
            anchor={
              <FilterChip
                label={catLabel}
                active={categoryId !== null}
                icon="tag-outline"
                onPress={() => setCatMenu(true)}
              />
            }
          >
            <Menu.Item onPress={() => { setCategoryId(null); setCatMenu(false); }} title="All categories" />
            {categories.map((c) => (
              <Menu.Item key={c.id} onPress={() => { setCategoryId(c.id); setCatMenu(false); }} title={c.name} />
            ))}
          </Menu>
          <Menu
            visible={pmMenu}
            onDismiss={() => setPmMenu(false)}
            anchor={
              <FilterChip
                label={pmLabel}
                active={paymentMethodId !== null}
                icon="credit-card-outline"
                onPress={() => setPmMenu(true)}
              />
            }
          >
            <Menu.Item onPress={() => { setPaymentMethodId(null); setPmMenu(false); }} title="All methods" />
            {paymentMethods.map((m) => (
              <Menu.Item key={m.id} onPress={() => { setPaymentMethodId(m.id); setPmMenu(false); }} title={m.name} />
            ))}
          </Menu>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <AppText variant="footnote" tone="secondary" weight="600" style={{ letterSpacing: 0.3 }}>
              {section.title.toUpperCase()}
            </AppText>
            <AppText variant="footnote" tone="secondary" weight="600">
              {formatCurrency(section.total, settings.currency)}
            </AppText>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="magnify" size={30} color={p.tertiaryLabel} />
            <AppText variant="subhead" tone="secondary">No expenses match your filters.</AppText>
          </View>
        }
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <View
              style={[
                styles.itemWrap,
                { backgroundColor: p.groupedCard },
                first && styles.itemFirst,
                last && styles.itemLast,
              ]}
            >
              <ExpenseRow
                item={item}
                currency={settings.currency}
                selected={selected.has(item.id)}
                onPress={() => onItemPress(item)}
                onLongPress={() => toggleSelect(item.id)}
              />
              {!last ? <View style={[styles.sep, { backgroundColor: p.separator }]} /> : null}
            </View>
          );
        }}
      />
    </View>
  );
}

function FilterChip({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
}) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: active ? p.selection : p.fill },
        pressed && { opacity: 0.6 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={15} color={active ? p.tint : p.secondaryLabel} />
      <AppText variant="footnote" weight={active ? '600' : '400'} color={active ? p.tint : p.label} numberOfLines={1}>
        {label}
      </AppText>
      <MaterialCommunityIcons name="chevron-down" size={15} color={active ? p.tint : p.secondaryLabel} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  addBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  controls: { paddingHorizontal: spacing.lg, gap: spacing.md, paddingBottom: spacing.md },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  itemWrap: { overflow: 'hidden' },
  itemFirst: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  itemLast: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.sm },
});
