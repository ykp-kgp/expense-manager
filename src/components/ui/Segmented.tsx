import { View, Pressable, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from './Text';

export type SegmentOption<T extends string> = { value: T; label: string };

/** iOS segmented control: a filled track with a raised selected segment. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  return (
    <View style={[styles.track, { backgroundColor: p.fill }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segment,
              active && { backgroundColor: p.groupedCard },
              active && ios.isDark ? styles.segmentActiveDark : null,
            ]}
          >
            <AppText
              variant="footnote"
              weight={active ? '600' : '400'}
              numberOfLines={1}
              color={active ? p.label : p.secondaryLabel}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.sm + 1,
    gap: 2,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
  },
  // subtle lift for the selected segment (iOS uses a soft shadow)
  segmentActiveDark: {},
});
