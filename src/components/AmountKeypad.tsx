import { View, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '<'] as const;

export function AmountKeypad({
  onChange,
  value,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const { ios } = useAppTheme();

  const press = (k: string) => {
    if (k === '<') {
      onChange(value.slice(0, -1));
      return;
    }
    if (k === '.') {
      if (value.includes('.')) return;
      if (value === '') {
        onChange('0.');
        return;
      }
    }
    if (value === '0' && k !== '.') {
      onChange(k);
      return;
    }
    if (value.includes('.')) {
      const decimals = value.split('.')[1];
      if (decimals && decimals.length >= 2) return;
    }
    onChange(value + k);
  };

  return (
    <View style={styles.grid}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          onPress={() => press(k)}
          android_ripple={{ color: ios.palette.fill, borderless: true }}
          style={({ pressed }) => [
            styles.btn,
            pressed ? { backgroundColor: ios.palette.fill } : null,
          ]}
        >
          {k === '<' ? (
            <MaterialCommunityIcons
              name="backspace-outline"
              size={26}
              color={ios.palette.label}
            />
          ) : (
            <AppText variant="title2" weight="400">
              {k}
            </AppText>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  btn: {
    width: '32%',
    aspectRatio: 1.7,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 2,
    borderRadius: 16,
  },
});
