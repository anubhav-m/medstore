import type { Density } from "./density";

/** The 4 dp grid. Components read the semantic tokens below, never these directly. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  xxxxl: 48,
} as const;

export interface SemanticSpacing {
  screenPadding: number;
  sectionGap: number;
  stackGap: number;
  inlineGap: number;
  platePadding: number;
  rowPaddingVertical: number;
  /** Horizontal padding inside inputs and buttons. */
  controlPadding: number;
  /** Space between a field and its label or helper line. */
  fieldGap: number;
  /** Space between touch targets. */
  touchGap: number;
  dialogPadding: number;
}

export const spacing: Record<Density, SemanticSpacing> = {
  comfortable: {
    screenPadding: space.lg,
    sectionGap: space.xxl,
    stackGap: space.md,
    inlineGap: space.sm,
    platePadding: space.lg,
    rowPaddingVertical: space.md,
    controlPadding: space.md,
    fieldGap: space.xs,
    touchGap: space.xs,
    dialogPadding: space.xl,
  },
  compact: {
    screenPadding: space.sm,
    sectionGap: space.lg,
    stackGap: space.xs,
    inlineGap: space.xs,
    platePadding: space.sm,
    rowPaddingVertical: 10,
    controlPadding: space.sm,
    fieldGap: space.xxs,
    touchGap: space.xs,
    dialogPadding: space.xl,
  },
};
