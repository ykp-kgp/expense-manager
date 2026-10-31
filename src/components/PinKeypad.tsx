import { View, StyleSheet, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppText } from '@/components/ui';
import { useAppTheme } from '@/theme';

type Props = {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onBiometric?: () => void;
  showBiometric?: boolean;
  disabled?: boolean;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinKeypad({ onDigit, onBackspace, onBiometric, showBiometric, disabled }: Props) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  return (
    <View style={styles.grid}>
      {KEYS.map((k) => (
        <PadButton key={k} onPress={() => onDigit(k)} disabled={disabled}>
          <AppText variant="title1" weight="400">{k}</AppText>
        </PadButton>
      ))}
      <PadButton onPress={onBiometric} disabled={!showBiometric || disabled}>
        {showBiometric ? (
          <MaterialCommunityIcons name="fingerprint" size={28} color={p.tint} />
        ) : null}
      </PadButton>
      <PadButton onPress={() => onDigit('0')} disabled={disabled}>
        <AppText variant="title1" weight="400">0</AppText>
      </PadButton>
      <PadButton onPress={onBackspace} disabled={disabled}>
        <MaterialCommunityIcons name="backspace-outline" size={26} color={p.label} />
      </PadButton>
    </View>
  );
}

function PadButton({
  children,
  onPress,
  disabled,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { ios } = useAppTheme();
  return (
    <Pressable
      android_ripple={{ color: ios.palette.fill, borderless: true }}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled ? { backgroundColor: ios.palette.fill } : null,
        { opacity: disabled ? 0.3 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: 280,
    alignSelf: 'center',
  },
  btn: {
    width: 80,
    height: 80,
    margin: 6,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
