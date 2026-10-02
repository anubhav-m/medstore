import { View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { Button } from "./Button";
import type { IconName } from "./Icon";
import { StateDisc } from "./internal/StateDisc";
import { Text } from "./Text";

interface EmptyStateProps {
  icon: IconName;
  /** "No orders yet". */
  title: string;
  /** One sentence: what will appear here, and how. */
  message: string;
  /**
   * At most one action, always secondary: the screen's one turmeric action lives in its bottom
   * action bar (the One-Action Rule).
   */
  action?: { label: string; onPress: () => void };
}

const useStyles = createStyles(({ spacing }) => ({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.stackGap,
    padding: spacing.screenPadding,
  },
  text: { alignSelf: "stretch", gap: spacing.fieldGap },
  action: { alignSelf: "center", maxWidth: "100%" },
}));

/** No illustrations: a quiet disc, a title, one sentence and at most one action. */
export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <StateDisc icon={icon} />
      <View style={styles.text}>
        <Text variant="title" align="center">
          {title}
        </Text>
        <Text color="secondary" align="center">
          {message}
        </Text>
      </View>
      {action ? (
        <View style={styles.action}>
          <Button
            variant="secondary"
            label={action.label}
            onPress={action.onPress}
            fullWidth={false}
          />
        </View>
      ) : null}
    </View>
  );
}
