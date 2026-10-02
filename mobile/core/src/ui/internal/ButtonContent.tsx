import { ActivityIndicator, View } from "react-native";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import type { ButtonPalette } from "../buttonColors";
import { Icon, type IconName } from "../Icon";
import { Text } from "../Text";

interface ButtonContentProps {
  palette: ButtonPalette;
  label: string;
  icon?: IconName;
  loading: boolean;
  underline: boolean;
  /** Start-aligned content: a content-width text button, whose label lines up with the text beside it. */
  alignStart: boolean;
}

const useStyles = createStyles(({ spacing }) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.inlineGap,
  },
  alignStart: { justifyContent: "flex-start" },
  label: { flexShrink: 1 },
}));

/** The leading icon (or spinner) and the label of a Button. */
export function ButtonContent({
  palette,
  label,
  icon,
  loading,
  underline,
  alignStart,
}: ButtonContentProps) {
  const styles = useStyles();
  const { sizes } = useDesign();
  const hasLeading = loading || icon !== undefined;
  return (
    <View style={[styles.row, alignStart && styles.alignStart]}>
      {loading ? (
        <ActivityIndicator size={sizes.spinnerInline} color={palette.icon} />
      ) : (
        icon && <Icon name={icon} color={palette.icon} />
      )}
      <View style={styles.label}>
        {/* A wrapped label fills the row, so with an icon it starts beside the icon, not centred. */}
        <Text
          variant="label"
          color={palette.label}
          align={hasLeading || alignStart ? "left" : "center"}
          underline={underline}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
