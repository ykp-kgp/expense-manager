import { Children, isValidElement, cloneElement, type ReactNode } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '@/theme';
import { radius, spacing } from '@/theme/tokens';
import { AppText } from './Text';

const ICON_TILE = 29;
const ROW_MIN_HEIGHT = 44;
const CONTENT_INSET = spacing.lg; // 16
const ICON_CONTENT_INSET = CONTENT_INSET + ICON_TILE + spacing.md; // text start past an icon

/**
 * iOS grouped, inset list section: an optional uppercase header, a rounded
 * card holding rows separated by inset hairlines, and an optional footer.
 * (`color.md › Platform considerations`, grouped background hierarchy.)
 */
export function Section({
  header,
  footer,
  children,
  style,
}: {
  header?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { ios } = useAppTheme();
  const items = Children.toArray(children).filter(isValidElement);

  return (
    <View style={[styles.section, style]}>
      {header ? (
        <AppText variant="footnote" tone="secondary" style={styles.header}>
          {header.toUpperCase()}
        </AppText>
      ) : null}
      <View style={[styles.card, { backgroundColor: ios.palette.groupedCard }]}>
        {items.map((child, i) =>
          cloneElement(child as any, { isLast: i === items.length - 1, key: i })
        )}
      </View>
      {footer ? (
        <AppText variant="footnote" tone="secondary" style={styles.footer}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

export type RowProps = {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  iconBackground?: string;
  accessory?: 'chevron' | 'none' | ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  destructive?: boolean;
  selected?: boolean;
  disabled?: boolean;
  /** Injected by `Section`. */
  isLast?: boolean;
};

export function Row({
  title,
  subtitle,
  value,
  icon,
  iconColor,
  iconBackground,
  accessory = 'none',
  onPress,
  onLongPress,
  destructive,
  selected,
  disabled,
  isLast,
}: RowProps) {
  const { ios } = useAppTheme();
  const p = ios.palette;
  const hasIcon = !!icon;
  const inset = hasIcon ? ICON_CONTENT_INSET : CONTENT_INSET;
  const isChevron = accessory === 'chevron' || (!!onPress && accessory === 'chevron');
  const titleColor = destructive ? p.negative : p.label;

  const content = (
    <View style={styles.rowInner}>
      {hasIcon ? (
        <View
          style={[
            styles.iconTile,
            { backgroundColor: iconBackground ?? p.tint },
          ]}
        >
          <MaterialCommunityIcons
            name={icon as any}
            size={17}
            color={iconColor ?? p.onTint}
          />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <AppText variant="body" color={disabled ? p.tertiaryLabel : titleColor} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="footnote" tone="secondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="body" tone="secondary" numberOfLines={1} style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {accessory === 'chevron' ? (
        <MaterialCommunityIcons name="chevron-right" size={20} color={p.tertiaryLabel} />
      ) : null}
      {accessory !== 'chevron' && accessory !== 'none' ? accessory : null}
    </View>
  );

  return (
    <View>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled || !onPress}
        android_ripple={onPress ? { color: p.fill } : undefined}
        style={({ pressed }) => [
          styles.row,
          { paddingLeft: hasIcon ? CONTENT_INSET : CONTENT_INSET },
          selected && { backgroundColor: p.selection },
          pressed && onPress ? { backgroundColor: p.fill } : null,
        ]}
      >
        {content}
      </Pressable>
      {!isLast ? (
        <View style={[styles.separator, { left: inset, backgroundColor: p.separator }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: spacing.xxl },
  header: {
    marginLeft: CONTENT_INSET + spacing.xs,
    marginBottom: spacing.sm,
    letterSpacing: 0.5,
  },
  footer: {
    marginLeft: CONTENT_INSET + spacing.xs,
    marginRight: CONTENT_INSET,
    marginTop: spacing.sm,
  },
  card: {
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    minHeight: ROW_MIN_HEIGHT,
    justifyContent: 'center',
    paddingRight: CONTENT_INSET,
    paddingVertical: spacing.sm,
  },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 1 },
  value: { maxWidth: '55%', textAlign: 'right' },
  separator: { position: 'absolute', bottom: 0, right: 0, height: StyleSheet.hairlineWidth },
});
