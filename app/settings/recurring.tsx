import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { Switch } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { listRecurringRules, deleteRecurringRule, updateRecurringRule } from '@/lib/queries';
import { useDb } from '@/lib/db-context';
import { useSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/format';
import { AppText, Screen } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

export default function RecurringList() {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const router = useRouter();
  const { settings } = useSettings();
  const { ready, version, bump } = useDb();
  const [rules, setRules] = useState<any[]>([]);

  const load = useCallback(async () => {
    setRules(await listRecurringRules());
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, version, load]);

  useFocusEffect(
    useCallback(() => {
      if (ready) load();
    }, [ready, load])
  );

  const toggleActive = async (id: number, active: boolean) => {
    await updateRecurringRule(id, { active });
    bump();
  };

  const remove = (id: number) => {
    Alert.alert('Delete recurring rule?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRecurringRule(id);
          bump();
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
        <Pressable
          onPress={() => router.push('/settings/recurring-edit')}
          style={({ pressed }) => [styles.addRow, pressed && { backgroundColor: p.fill }]}
        >
          <View style={[styles.addIcon, { backgroundColor: p.tint }]}>
            <MaterialCommunityIcons name="plus" size={18} color={p.onTint} />
          </View>
          <AppText variant="body" tone="tint" weight="600">Add recurring expense</AppText>
        </Pressable>
      </View>

      {rules.length === 0 ? (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="repeat" size={28} color={p.tertiaryLabel} />
          <AppText variant="subhead" tone="secondary">No recurring expenses yet.</AppText>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
          {rules.map((item, i) => (
            <View key={item.id}>
              <Pressable
                onPress={() => router.push(`/settings/recurring-edit?id=${item.id}`)}
                onLongPress={() => remove(item.id)}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: p.fill }]}
              >
                <View style={[styles.icon, { backgroundColor: (item.categoryColor ?? p.tint) + '1F' }]}>
                  <MaterialCommunityIcons
                    name={(item.categoryIcon ?? 'repeat') as any}
                    size={19}
                    color={item.categoryColor ?? p.tint}
                  />
                </View>
                <View style={styles.text}>
                  <AppText variant="body" weight="600" numberOfLines={1}>
                    {item.categoryName} · {formatCurrency(item.amount, settings.currency)}
                  </AppText>
                  <AppText variant="footnote" tone="secondary" numberOfLines={1}>
                    {capitalize(item.frequency)} • next {format(parseISO(item.next_run_date), 'd MMM yyyy')}
                  </AppText>
                </View>
                <Switch
                  value={!!item.active}
                  onValueChange={(v) => toggleActive(item.id, v)}
                  color={p.toggleOn}
                />
              </Pressable>
              {i < rules.length - 1 ? (
                <View style={[styles.sep, { backgroundColor: p.separator }]} />
              ) : null}
            </View>
          ))}
        </View>
      )}
      <AppText variant="footnote" tone="secondary" style={styles.hint}>
        Tap a rule to edit it, or press and hold to delete.
      </AppText>
    </Screen>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, minHeight: 50 },
  addIcon: { width: 29, height: 29, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 60 },
  icon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 1 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 64 },
  empty: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.sm },
  hint: { marginLeft: spacing.xs },
});
