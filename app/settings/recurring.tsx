import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert } from 'react-native';
import { Text, Card, useTheme, FAB, IconButton, Switch } from 'react-native-paper';
import { useFocusEffect, useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import {
  listRecurringRules,
  deleteRecurringRule,
  updateRecurringRule,
} from '@/lib/queries';
import { useDb } from '@/lib/db-context';
import { useSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/format';

export default function RecurringList() {
  const theme = useTheme();
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
    Alert.alert('Delete recurring rule?', '', [
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
    <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
      <FlatList
        data={rules}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 12, gap: 8, paddingBottom: 96 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ opacity: 0.7 }}>
              No recurring expenses. Tap + to add one.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium">
                    {item.categoryName} – {formatCurrency(item.amount, settings.currency)}
                  </Text>
                  <Text style={{ opacity: 0.7, marginTop: 2 }}>
                    {capitalize(item.frequency)} • next{' '}
                    {format(parseISO(item.next_run_date), 'd MMM yyyy')}
                  </Text>
                  {item.note ? (
                    <Text style={{ opacity: 0.7, marginTop: 2 }}>{item.note}</Text>
                  ) : null}
                </View>
                <Switch
                  value={!!item.active}
                  onValueChange={(v) => toggleActive(item.id, v)}
                />
                <IconButton
                  icon="pencil"
                  onPress={() =>
                    router.push(`/settings/recurring-edit?id=${item.id}`)
                  }
                />
                <IconButton icon="delete" onPress={() => remove(item.id)} />
              </View>
            </Card.Content>
          </Card>
        )}
      />
      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => router.push('/settings/recurring-edit')}
      />
    </View>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  empty: { padding: 32, alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});
