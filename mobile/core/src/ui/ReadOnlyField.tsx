import { View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { Text } from "./Text";

interface ReadOnlyFieldProps {
  label: string;
  /** Empty shows "Not added", so the row never looks broken. */
  value: string;
  /** Why it can't be edited here: "Your email can't be changed." */
  helper?: string;
}

const NOT_ADDED = "Not added";

const useStyles = createStyles(({ spacing }) => ({
  root: { gap: spacing.fieldGap },
}));

/**
 * A value the user can see but not edit, in full-contrast ink. Never a disabled Input: disabled
 * grey is too faint to read, and a value people need to check must stay readable.
 */
export function ReadOnlyField({ label, value, helper }: ReadOnlyFieldProps) {
  const styles = useStyles();
  const shown = value.trim() === "" ? NOT_ADDED : value;
  return (
    <View
      style={styles.root}
      accessible
      accessibilityLabel={`${label}: ${shown}`}
      accessibilityHint={helper}
    >
      <Text variant="label">{label}</Text>
      <Text color={shown === NOT_ADDED ? "secondary" : "ink"}>{shown}</Text>
      {helper ? (
        <Text variant="caption" color="secondary">
          {helper}
        </Text>
      ) : null}
    </View>
  );
}
