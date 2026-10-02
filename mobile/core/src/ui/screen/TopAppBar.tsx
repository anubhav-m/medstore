import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStyles } from "../../theme/createStyles";
import type { IconName } from "../Icon";
import { IconButton } from "../internal/IconButton";
import { Text } from "../Text";

export interface AppBarAction {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
}

interface TopAppBarProps {
  title: string;
  onBack?: () => void;
  trailingAction?: AppBarAction;
}

const useStyles = createStyles(({ colors, spacing, sizes }) => ({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.fieldGap,
    minHeight: sizes.appBarHeight,
    paddingHorizontal: spacing.screenPadding - spacing.fieldGap,
    backgroundColor: colors.surface,
  },
  title: { flex: 1, paddingVertical: spacing.fieldGap, paddingHorizontal: spacing.fieldGap },
}));

/** Material top app bar: flat, no shadow. The title wraps rather than truncating. */
export function TopAppBar({ title, onBack, trailingAction }: TopAppBarProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      {onBack ? (
        <IconButton icon="arrow-left" accessibilityLabel="Go back" onPress={onBack} />
      ) : null}
      <View style={styles.title}>
        <Text variant="headline">{title}</Text>
      </View>
      {trailingAction ? <IconButton {...trailingAction} /> : null}
    </View>
  );
}
