import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, StyleSheet, Dimensions } from 'react-native';
import { Text, Card, useTheme, IconButton } from 'react-native-paper';
import { useFocusEffect } from 'expo-router';
import { addMonths, format, subMonths, parseISO } from 'date-fns';
import { PieChart, BarChart } from 'react-native-gifted-charts';
import { useDb } from '@/lib/db-context';
import { useSettings } from '@/lib/settings-context';
import {
  monthTotal,
  totalsByCategoryForMonth,
  totalsForLastNMonths,
  type CategoryTotal,
} from '@/lib/queries';
import { formatCurrency, monthKey } from '@/lib/format';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function Reports() {
  const theme = useTheme();
  const { ready, version } = useDb();
  const { settings } = useSettings();
  const [month, setMonth] = useState<Date>(new Date());
  const [total, setTotal] = useState(0);
  const [byCat, setByCat] = useState<CategoryTotal[]>([]);
  const [last6, setLast6] = useState<Array<{ month: string; total: number }>>([]);

  const load = useCallback(async () => {
    const [t, c, b] = await Promise.all([
      monthTotal(month),
      totalsByCategoryForMonth(month),
      totalsForLastNMonths(6),
    ]);
    setTotal(t);
    setByCat(c.filter((x) => x.total > 0));
    setLast6(b);
  }, [month]);

  useEffect(() => {
    if (ready) load();
  }, [ready, version, load]);

  useFocusEffect(
    useCallback(() => {
      if (ready) load();
    }, [ready, load])
  );

  const pieData = byCat.map((c) => ({
    value: c.total,
    color: c.color,
    text: '',
  }));

  const maxBar = Math.max(...last6.map((x) => x.total), 1);
  const barData = last6.map((m) => ({
    value: m.total,
    label: m.month,
    frontColor: theme.colors.primary,
    topLabelComponent: () =>
      m.total > 0 ? (
        <Text style={{ fontSize: 10, color: theme.colors.onSurfaceVariant }}>
          {Math.round(m.total)}
        </Text>
      ) : null,
  }));

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.monthRow}>
            <IconButton
              icon="chevron-left"
              onPress={() => setMonth((m) => subMonths(m, 1))}
            />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text variant="titleMedium">{format(month, 'MMMM yyyy')}</Text>
              <Text variant="headlineSmall" style={{ fontWeight: '700' }}>
                {formatCurrency(total, settings.currency)}
              </Text>
            </View>
            <IconButton
              icon="chevron-right"
              onPress={() => setMonth((m) => addMonths(m, 1))}
              disabled={monthKey(month) === monthKey(new Date())}
            />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="By category" />
        <Card.Content>
          {pieData.length === 0 ? (
            <Text style={{ opacity: 0.7, paddingVertical: 16 }}>
              No expenses this month yet.
            </Text>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <PieChart
                data={pieData}
                radius={SCREEN_WIDTH / 4}
                innerRadius={SCREEN_WIDTH / 7}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, opacity: 0.7 }}>Total</Text>
                    <Text style={{ fontWeight: '700' }}>
                      {formatCurrency(total, settings.currency)}
                    </Text>
                  </View>
                )}
              />
              <View style={{ marginTop: 16, width: '100%' }}>
                {byCat.map((c) => (
                  <View key={c.categoryId} style={styles.legendRow}>
                    <View style={[styles.dot, { backgroundColor: c.color }]} />
                    <Text style={{ flex: 1 }}>{c.name}</Text>
                    <Text style={{ fontWeight: '600' }}>
                      {formatCurrency(c.total, settings.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Last 6 months" />
        <Card.Content>
          <BarChart
            data={barData}
            barWidth={28}
            spacing={16}
            yAxisThickness={0}
            xAxisThickness={0}
            noOfSections={4}
            maxValue={Math.ceil(maxBar * 1.1)}
            isAnimated
            disableScroll
            yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
            xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}
          />
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12, gap: 12, paddingBottom: 24 },
  card: { borderRadius: 16 },
  monthRow: { flexDirection: 'row', alignItems: 'center' },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 8,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
});
