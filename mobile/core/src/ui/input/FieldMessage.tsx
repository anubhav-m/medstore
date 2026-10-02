import { View } from "react-native";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { Icon } from "../Icon";
import { Text } from "../Text";

/** The counter turns rust this close to the limit (DESIGN.md). */
const COUNTER_WARNING_CHARS = 20;

interface FieldMessageProps {
  helper?: string;
  error?: string;
  count?: { length: number; max: number };
}

const useStyles = createStyles(({ spacing }) => ({
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.inlineGap },
  message: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: spacing.fieldGap },
  messageText: { flex: 1 },
}));

/** The line under a field: the error (icon + brick text) or the helper, plus an optional counter. */
export function FieldMessage({ helper, error, count }: FieldMessageProps) {
  const styles = useStyles();
  const { familyColors } = useDesign();
  if (!error && !helper && !count) return null;
  const nearLimit = count ? count.max - count.length <= COUNTER_WARNING_CHARS : false;
  return (
    <View style={styles.row}>
      <View style={styles.message}>
        {error ? <Icon name="alert-circle-outline" color={familyColors.brick.solid} /> : null}
        <View style={styles.messageText}>
          {error || helper ? (
            <Text variant="caption" color={error ? "brick" : "secondary"}>
              {error ?? helper}
            </Text>
          ) : null}
        </View>
      </View>
      {count ? (
        <Text
          variant="caption"
          tabular
          color={nearLimit ? "rust" : "secondary"}
          accessibilityLabel={`${count.length} of ${count.max} characters`}
        >
          {`${count.length} / ${count.max}`}
        </Text>
      ) : null}
    </View>
  );
}
