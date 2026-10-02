import { colors, familyColors } from "../theme/colors";
import type { TextColor } from "./Text";

export type ButtonVariant = "primary" | "secondary" | "text" | "danger" | "dangerSecondary";

export interface ButtonPalette {
  fill: string;
  border: string;
  label: TextColor;
  icon: string;
}

const TRANSPARENT = colors.transparent;
const brick = familyColors.brick.solid;

const resting: Record<ButtonVariant, ButtonPalette> = {
  primary: { fill: colors.haldi, border: colors.haldiEdge, label: "ink", icon: colors.ink },
  secondary: { fill: colors.surface, border: colors.ink, label: "ink", icon: colors.ink },
  text: { fill: TRANSPARENT, border: TRANSPARENT, label: "ink", icon: colors.ink },
  danger: { fill: brick, border: brick, label: "onSolid", icon: colors.surface },
  dangerSecondary: { fill: colors.surface, border: brick, label: "brick", icon: brick },
};

const pressedFill: Record<ButtonVariant, string> = {
  primary: colors.haldiPressed,
  secondary: colors.sunken,
  text: colors.pressedOverlay,
  danger: colors.brickPressed,
  dangerSecondary: colors.sunken,
};

const disabledPalette: ButtonPalette = {
  fill: colors.disabledFill,
  border: colors.disabledFill,
  label: "disabled",
  icon: colors.inkDisabled,
};

/** Colours per DESIGN.md: a visible fill change on press, and one flat look for disabled. */
export function buttonColors(
  variant: ButtonVariant,
  { pressed, disabled }: { pressed: boolean; disabled: boolean },
): ButtonPalette {
  if (disabled) {
    return variant === "text"
      ? { ...disabledPalette, fill: TRANSPARENT, border: TRANSPARENT }
      : disabledPalette;
  }
  const palette = resting[variant];
  if (!pressed) return palette;
  const fill = pressedFill[variant];
  // The danger button has no separate border, so it darkens with the fill.
  return { ...palette, fill, border: variant === "danger" ? fill : palette.border };
}
