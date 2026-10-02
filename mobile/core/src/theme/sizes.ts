import type { Density } from "./density";

export interface ComponentSizes {
  controlHeight: number;
  /** Minimum size of every pressable, in both densities. */
  touchTarget: number;
  iconInline: number;
  iconBadge: number;
  markDisc: number;
  markGlyph: number;
  badgeHeight: number;
  /** Disc behind EmptyState and ErrorState icons. */
  stateDisc: number;
  stateGlyph: number;
  spinnerScreen: number;
  spinnerInline: number;
  /** Width cap for content on wide screens; the admin app uses the full width. */
  contentMaxWidth?: number;
  navigationIndicatorWidth: number;
  navigationIndicatorHeight: number;
  /** Material dialog maximum width. */
  dialogMaxWidth: number;
  /** Material top app bar height. */
  appBarHeight: number;
  /** Bottom navigation bar height (Material: 80). */
  navigationBarHeight: number;
}

export const sizes: Record<Density, ComponentSizes> = {
  comfortable: {
    controlHeight: 56,
    touchTarget: 48,
    iconInline: 24,
    iconBadge: 18,
    markDisc: 48,
    markGlyph: 28,
    badgeHeight: 32,
    stateDisc: 56,
    stateGlyph: 28,
    spinnerScreen: 48,
    spinnerInline: 20,
    contentMaxWidth: 560,
    navigationIndicatorWidth: 64,
    navigationIndicatorHeight: 32,
    dialogMaxWidth: 560,
    appBarHeight: 64,
    navigationBarHeight: 80,
  },
  compact: {
    controlHeight: 48,
    touchTarget: 48,
    iconInline: 20,
    iconBadge: 16,
    markDisc: 36,
    markGlyph: 20,
    badgeHeight: 28,
    stateDisc: 56,
    stateGlyph: 28,
    spinnerScreen: 48,
    spinnerInline: 20,
    navigationIndicatorWidth: 56,
    navigationIndicatorHeight: 28,
    dialogMaxWidth: 560,
    appBarHeight: 56,
    navigationBarHeight: 72,
  },
};

/** Font scale at which label/value rows and button rows stack (DESIGN.md, Layout). */
export const STACKED_FONT_SCALE = 1.3;
