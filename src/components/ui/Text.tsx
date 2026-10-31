import { Text as RNText, type TextProps } from 'react-native';
import { useAppTheme } from '@/theme';
import { typography, type TypeVariant } from '@/theme/tokens';

type Tone = 'primary' | 'secondary' | 'tertiary' | 'tint' | 'positive' | 'negative' | 'onTint';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  /** Explicit color overrides `tone`. */
  color?: string;
  weight?: '400' | '500' | '600' | '700';
};

export function AppText({
  variant = 'body',
  tone = 'primary',
  color,
  weight,
  style,
  ...rest
}: AppTextProps) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const toneColor: Record<Tone, string> = {
    primary: p.label,
    secondary: p.secondaryLabel,
    tertiary: p.tertiaryLabel,
    tint: p.tint,
    positive: p.positive,
    negative: p.negative,
    onTint: p.onTint,
  };
  return (
    <RNText
      {...rest}
      style={[
        typography[variant],
        { color: color ?? toneColor[tone] },
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
}
