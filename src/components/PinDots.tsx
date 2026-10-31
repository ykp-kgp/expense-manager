import { View, StyleSheet } from 'react-native';
import { useAppTheme } from '@/theme';

export function PinDots({
  length,
  filled,
  error,
}: {
  length: number;
  filled: number;
  error?: boolean;
}) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const dots = Array.from({ length }, (_, i) => i < filled);
  const activeColor = error ? p.negative : p.label;
  return (
    <View style={styles.row}>
      {dots.map((on, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              borderColor: on ? activeColor : p.separator,
              backgroundColor: on ? activeColor : 'transparent',
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginVertical: 28 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5 },
});
