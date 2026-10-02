import { View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { useDesign } from "../theme/DesignProvider";
import { Text } from "./Text";

const APP_NAMES = { customer: "MedStore", admin: "MedStore Admin" } as const;

const useStyles = createStyles(({ colors, sizes, spacing, radii, borderWidths }) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.inlineGap },
  disc: {
    // min sizes: the "M" is text, so the disc grows with the font size rather than clipping it.
    minWidth: sizes.markDisc,
    minHeight: sizes.markDisc,
    // Stays a circle when the "M" grows with the font size.
    aspectRatio: 1,
    borderRadius: radii.mark,
    borderWidth: borderWidths.control,
    borderColor: colors.haldiEdge,
    backgroundColor: colors.haldi,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: { flexShrink: 1 },
}));

/**
 * Placeholder logo until the real one exists: a haldi disc with an ink "M" and the wordmark. This is
 * the only place the brand is drawn, so replacing it is a one-file change.
 */
export function BrandMark() {
  const styles = useStyles();
  const { app } = useDesign();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="image"
      accessibilityLabel={APP_NAMES[app]}
    >
      <View style={styles.disc}>
        <Text variant="title" align="center">
          M
        </Text>
      </View>
      <View style={styles.wordmark}>
        <Text variant="headline">{APP_NAMES[app]}</Text>
      </View>
    </View>
  );
}
