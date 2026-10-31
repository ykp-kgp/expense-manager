import { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Dimensions, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { addMonths, format, subMonths } from 'date-fns';
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
import { AppText, Screen, LargeTitle } from '@/components/ui';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function Reports() {
  const { ios } = useAppTheme();
  const p = ios.palette;
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

  const pieData = byCat.map((c) => ({ value: c.total, color: c.color, text: '' }));
  const maxBar = Math.max(...last6.map((x) => x.total), 1);
  const barData = last6.map((m) => ({
    value: m.total,
    label: m.month,
    frontColor: p.tint,
    topLabelComponent: () =>
      m.total > 0 ? (
        <AppText variant="caption2" tone="secondary" style={{ marginBottom: 2 }}>
          {Math.round(m.total)}
        </AppText>
      ) : null,
  }));
  const atCurrentMonth = monthKey(month) === monthKey(new Date());

  return (
    <Screen scroll padded={false}>
      <LargeTitle title="Insights" />
      <View style={styles.body}>
        {/* Month switcher + total */}
        <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
          <View style={styles.monthRow}>
            <StepButton icon="chevron-left" onPress={() => setMonth((m) => subMonths(m, 1))} />
            <View style={styles.monthCenter}>
              <AppText variant="subhead" tone="secondary">{format(month, 'MMMM yyyy')}</AppText>
              <AppText variant="title1" weight="700" style={{ marginTop: 2 }}>
                {formatCurrency(total, settings.currency)}
              </AppText>
            </View>
            <StepButton
              icon="chevron-right"
              disabled={atCurrentMonth}
              onPress={() => setMonth((m) => addMonths(m, 1))}
            />
          </View>
        </View>

        {/* By category */}
        <View style={styles.group}>
          <AppText variant="footnote" tone="secondary" style={styles.groupTitle}>
            BY CATEGORY
          </AppText>
          <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
            {pieData.length === 0 ? (
              <EmptyBlock label="No expenses this month yet." />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <PieChart
                  data={pieData}
                  radius={SCREEN_WIDTH / 4.5}
                  innerRadius={SCREEN_WIDTH / 7}
                  innerCircleColor={p.groupedCard}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: 'center' }}>
                      <AppText variant="caption1" tone="secondary">Total</AppText>
                      <AppText variant="headline">{formatCurrency(total, settings.currency)}</AppText>
                    </View>
                  )}
                />
                <View style={styles.legend}>
                  {byCat.map((c, i) => (
                    <View key={c.categoryId}>
                      <View style={styles.legendRow}>
                        <View style={[styles.dot, { backgroundColor: c.color }]} />
                        <AppText variant="body" style={{ flex: 1 }} numberOfLines={1}>{c.name}</AppText>
                        <AppText variant="body" weight="600">{formatCurrency(c.total, settings.currency)}</AppText>
                      </View>
                      {i < byCat.length - 1 ? (
                        <View style={[styles.sep, { backgroundColor: p.separator }]} />
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Trend */}
        <View style={styles.group}>
          <AppText variant="footnote" tone="secondary" style={styles.groupTitle}>
            LAST 6 MONTHS
          </AppText>
          <View style={[styles.card, { backgroundColor: p.groupedCard }]}>
            <BarChart
              data={barData}
              barWidth={26}
              spacing={18}
              barBorderRadius={6}
              yAxisThickness={0}
              xAxisThickness={0}
              noOfSections={4}
              maxValue={Math.ceil(maxBar * 1.1)}
              isAnimated
              disableScroll
              yAxisTextStyle={{ color: p.secondaryLabel, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: p.secondaryLabel, fontSize: 11 }}
            />
          </View>
        </View>
      </View>
    </Screen>
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

function EmptyBlock({ label }: { label: string }) {
  const { ios } = useAppTheme();
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons name="chart-arc" size={28} color={ios.palette.tertiaryLabel} />
      <AppText variant="subhead" tone="secondary">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.xxl },
  card: { borderRadius: radius.lg, padding: spacing.lg },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthCenter: { alignItems: 'center', flex: 1 },
  step: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  group: { gap: spacing.sm },
  groupTitle: { marginLeft: spacing.xs, letterSpacing: 0.5 },
  legend: { marginTop: spacing.lg, width: '100%' },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 22 },
  empty: { paddingVertical: spacing.xl, alignItems: 'center', gap: spacing.sm },
});
