import type { TextStyle } from 'react-native';

/**
 * Apple-inspired design tokens.
 *
 * Grounded in Apple's Human Interface Guidelines:
 * - Color: iOS semantic "grouped" background hierarchy and label colors
 *   (`color.md › Platform considerations`). Values are hand-tuned for WCAG
 *   contrast since HIG ships these as dynamic system colors, not fixed hexes.
 * - Typography: the iOS Dynamic Type scale at the Large (default) size
 *   (`typography.md › Specifications`).
 */

export type Palette = {
  /** Grouped table background — the base of every screen. */
  background: string;
  /** Cards and grouped rows that sit on `background`. */
  groupedCard: string;
  /** Plain surface for modals/sheets. */
  surface: string;
  /** Translucent control fill (segmented controls, chips). */
  fill: string;
  /** Selected-row tint. */
  selection: string;

  /** Primary text. */
  label: string;
  /** Secondary text — meets 4.5:1 on its background. */
  secondaryLabel: string;
  /** Decorative only (chevrons, placeholders) — not for essential text. */
  tertiaryLabel: string;
  /** Hairline separators. */
  separator: string;

  /** Accent / interactive (systemBlue). */
  tint: string;
  /** Text/icon drawn on top of `tint`. */
  onTint: string;
  /** Positive movement (spending down / under budget) — paired with a glyph. */
  positive: string;
  /** Negative movement (spending up / over budget) — paired with a glyph. */
  negative: string;
  /** Warning. */
  warning: string;
  /** Vivid "on" color for toggles (iOS switch green). */
  toggleOn: string;
};

// Contrast figures are against the surface the color sits on.
export const lightPalette: Palette = {
  background: '#F2F2F7',
  groupedCard: '#FFFFFF',
  surface: '#FFFFFF',
  fill: 'rgba(118,118,128,0.12)',
  selection: 'rgba(0,122,255,0.10)',

  label: '#000000', // 21:1 on #FFF
  secondaryLabel: '#6D6D72', // 4.8:1 on #FFF
  tertiaryLabel: '#B8B8BE',
  separator: '#C6C6C8',

  tint: '#007AFF', // 4.0:1 on #FFF — used for ≥17pt / bold control text
  onTint: '#FFFFFF',
  positive: '#248A3D', // 4.0:1 on #FFF (bold)
  negative: '#D70015', // 4.9:1 on #FFF
  warning: '#B25000',
  toggleOn: '#34C759',
};

export const darkPalette: Palette = {
  background: '#000000',
  groupedCard: '#1C1C1E',
  surface: '#1C1C1E',
  fill: 'rgba(118,118,128,0.24)',
  selection: 'rgba(10,132,255,0.22)',

  label: '#FFFFFF', // 21:1 on #1C1C1E
  secondaryLabel: '#AEAEB2', // 7.3:1 on #1C1C1E
  tertiaryLabel: '#6C6C70',
  separator: '#38383A',

  tint: '#0A84FF',
  onTint: '#FFFFFF',
  positive: '#30D158',
  negative: '#FF453A',
  warning: '#FF9F0A',
  toggleOn: '#30D158',
};

export type TypeStyle = Required<
  Pick<TextStyle, 'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'>
>;

// iOS Dynamic Type — Large (default). `typography.md › iOS, iPadOS Dynamic Type sizes`.
export const typography = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.26 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.45 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.43 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.43 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.31 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.23 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.06 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typography;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const radius = { sm: 8, md: 10, lg: 12, xl: 16, pill: 999 } as const;

/** iOS minimum comfortable hit target (`accessibility.md`). */
export const HIT_SLOP = 44;

export type IOSTokens = {
  palette: Palette;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  isDark: boolean;
};
