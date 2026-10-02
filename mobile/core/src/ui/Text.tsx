import type { ReactNode } from "react";
import { Text as NativeText, type TextProps as NativeTextProps } from "react-native";
import type { ColorFamily } from "../theme/colors";
import { createStyles } from "../theme/createStyles";
import { useDesign } from "../theme/DesignProvider";
import type { TextRole } from "../theme/typography";

type TextFamily = Exclude<ColorFamily, "haldi">;

/** Ink roles, a family's solid colour (coloured text on light surfaces), or a family's on-tint text. */
export type TextColor =
  "ink" | "secondary" | "tertiary" | "disabled" | "onSolid" | TextFamily | `${ColorFamily}.onTint`;

interface TextProps {
  variant?: TextRole;
  color?: TextColor;
  /** Tabular figures: for every price, quantity, count, time and order number. */
  tabular?: boolean;
  align?: "left" | "center" | "right";
  /** Only for list rows (addresses, medicine names) whose full text is one tap away. */
  numberOfLines?: number;
  /**
   * Keeps one unbreakable value on one line, shrinking it only when it can't fit the width: amounts
   * and navigation labels, which must never break mid-number or mid-word (DESIGN.md).
   */
  fitOneLine?: boolean;
  accessibilityLabel?: string;
  accessibilityLiveRegion?: NativeTextProps["accessibilityLiveRegion"];
  /** Extra letter-spacing, used only by order numbers. */
  letterSpacing?: number;
  /** Text buttons only. */
  underline?: boolean;
  children: ReactNode;
}

const HEADING_ROLES: readonly TextRole[] = ["display", "headline", "title"];

const useStyles = createStyles(({ type }) => ({
  base: { includeFontPadding: false },
  ...type,
  tabular: { fontVariant: ["tabular-nums"] },
  underline: { textDecorationLine: "underline" },
}));

/** The only way to put words on screen. Size comes from the app's density; it always scales. */
export function Text({
  variant = "body",
  color = "ink",
  tabular = false,
  align,
  numberOfLines,
  fitOneLine = false,
  accessibilityLabel,
  accessibilityLiveRegion,
  letterSpacing,
  underline = false,
  children,
}: TextProps) {
  const styles = useStyles();
  const { colors, familyColors } = useDesign();
  const roleColors: Record<string, string> = {
    ink: colors.ink,
    secondary: colors.inkSecondary,
    tertiary: colors.inkTertiary,
    disabled: colors.inkDisabled,
    onSolid: colors.surface,
  };
  const [family, part] = color.split(".") as [ColorFamily, "onTint" | undefined];
  const resolvedColor =
    roleColors[color] ?? (part ? familyColors[family].onTint : familyColors[family].solid);
  return (
    <NativeText
      style={[
        styles.base,
        styles[variant],
        tabular && styles.tabular,
        underline && styles.underline,
        { color: resolvedColor, textAlign: align, letterSpacing },
      ]}
      numberOfLines={fitOneLine ? 1 : numberOfLines}
      adjustsFontSizeToFit={fitOneLine}
      accessibilityRole={HEADING_ROLES.includes(variant) ? "header" : undefined}
      accessibilityLabel={accessibilityLabel}
      accessibilityLiveRegion={accessibilityLiveRegion}
    >
      {children}
    </NativeText>
  );
}
