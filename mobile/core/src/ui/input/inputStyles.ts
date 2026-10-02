import { createStyles } from "../../theme/createStyles";

/** A multiline field grows to this many lines, then scrolls. */
const MULTILINE_MAX_LINES = 5;

export const useInputStyles = createStyles(
  ({ colors, familyColors, type, spacing, sizes, radii, borderWidths }) => ({
    root: { gap: spacing.fieldGap, alignSelf: "stretch" },
    fieldWrap: { alignSelf: "stretch" },
    field: {
      flexDirection: "row",
      alignItems: "stretch",
      minHeight: sizes.controlHeight,
      borderRadius: radii.control,
      borderWidth: borderWidths.control,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surface,
      overflow: "hidden",
    },
    focused: { borderColor: colors.ink },
    error: { borderColor: familyColors.brick.solid },
    disabled: { borderColor: colors.borderSubtle, backgroundColor: colors.disabledFill },
    prefix: {
      justifyContent: "center",
      paddingHorizontal: spacing.controlPadding,
      backgroundColor: colors.sunken,
    },
    // At large font sizes the +91 patch and the digits both need room, so the padding halves.
    prefixStacked: { paddingHorizontal: spacing.fieldGap },
    leading: { justifyContent: "center", paddingLeft: spacing.controlPadding },
    trailing: { flexDirection: "row", alignItems: "center" },
    trailingSpinner: { paddingHorizontal: spacing.controlPadding },
    input: {
      flex: 1,
      ...type.body,
      includeFontPadding: false,
      color: colors.ink,
      paddingHorizontal: spacing.controlPadding,
      paddingVertical: spacing.fieldGap,
      textAlignVertical: "center",
    },
    inputStacked: { paddingHorizontal: spacing.fieldGap },
    multiline: { maxHeight: type.body.lineHeight * MULTILINE_MAX_LINES + spacing.fieldGap * 2 },
    inputDisabled: { color: colors.inkDisabled },
    code: { letterSpacing: spacing.fieldGap, fontVariant: ["tabular-nums"] },
    tabular: { fontVariant: ["tabular-nums"] },
  }),
);
