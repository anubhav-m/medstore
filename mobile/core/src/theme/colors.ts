// Every value is a role from DESIGN.md; the contrast of each allowed pair is recorded there.
export const colors = {
  ground: "#F4F5F1",
  surface: "#FFFFFF",
  sunken: "#E9ECE7",
  ink: "#17211F",
  inkSecondary: "#4A5652",
  inkTertiary: "#5E6A66",
  inkDisabled: "#9AA39F",
  disabledFill: "#E3E6E2",
  borderSubtle: "#D6DBD6",
  borderStrong: "#7A8581",
  scrim: "#17211F80",
  /** Ink at 12 %: the pressed fill of text buttons, visible on white and on every tint. */
  pressedOverlay: "#17211F1F",
  haldi: "#F2B705",
  haldiPressed: "#D9A300",
  haldiEdge: "#8F6A00",
  haldiTint: "#FFF3C4",
  onHaldiTint: "#5C4300",
  brickPressed: "#8A1C16",
  transparent: "transparent",
} as const;

export type ColorFamily =
  "haldi" | "slate" | "indigo" | "teal" | "green" | "brick" | "rust" | "grey";

interface FamilyColors {
  /** Mark disc, icons and coloured text on light surfaces. */
  solid: string;
  /** Badge and banner background. */
  tint: string;
  /** Text on the tint. */
  onTint: string;
  /** Glyph drawn on a solid disc. */
  onSolid: string;
}

export const familyColors: Record<ColorFamily, FamilyColors> = {
  // Haldi is too light to carry text or a 3:1 boundary; its edge colour stands in as "solid".
  haldi: {
    solid: colors.haldiEdge,
    tint: colors.haldiTint,
    onTint: colors.onHaldiTint,
    onSolid: colors.ink,
  },
  slate: { solid: "#3E5C7E", tint: "#E4EBF3", onTint: "#2C4560", onSolid: colors.surface },
  indigo: { solid: "#3949A0", tint: "#E6E9F7", onTint: "#28357A", onSolid: colors.surface },
  teal: { solid: "#0B6E69", tint: "#DDF1EF", onTint: "#08524E", onSolid: colors.surface },
  green: { solid: "#2E7D32", tint: "#E3F2E3", onTint: "#1F5B23", onSolid: colors.surface },
  brick: { solid: "#B3261E", tint: "#FBE6E4", onTint: "#8A1C16", onSolid: colors.surface },
  rust: { solid: "#A84B0C", tint: "#FCEBDD", onTint: "#7A3608", onSolid: colors.surface },
  grey: { solid: "#5E6A66", tint: "#E9ECE7", onTint: "#3C4643", onSolid: colors.surface },
};

export type SemanticTone = "success" | "info" | "warning" | "danger";

export const semanticFamily: Record<SemanticTone, ColorFamily> = {
  success: "green",
  info: "slate",
  warning: "rust",
  danger: "brick",
};
