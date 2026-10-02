import { View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { useStackedLayout } from "../theme/useStackedLayout";
import { Amount } from "./Amount";
import { amountText } from "./internal/amountText";
import { Text } from "./Text";

interface AmountRowProps {
  /** "Subtotal", "Delivery fee", "Discount", "Total", "Expected cash". */
  label: string;
  /** Integer paise from the server. */
  paise: number;
  /** The bill total: a Display amount under a 1 dp rule. */
  total?: boolean;
}

const useStyles = createStyles(({ colors, spacing, space, borderWidths }) => ({
  row: { flexDirection: "row", alignItems: "baseline", gap: spacing.inlineGap },
  stacked: { alignItems: "stretch", gap: space.xxs },
  // Labels are a word or two and never shrink; a very long amount shrinks to fit instead
  // (fitOneLine), rather than squeezing the label into a column of single letters.
  label: { flexGrow: 1, flexShrink: 0 },
  amount: { flexShrink: 1 },
  rule: {
    paddingTop: spacing.stackGap,
    borderTopWidth: borderWidths.divider,
    borderTopColor: colors.borderSubtle,
  },
}));

/**
 * A label and a right-aligned amount on one line. At large font sizes (stacked mode) the label goes
 * on top and the amount below, still right-aligned, so neither is squeezed.
 */
export function AmountRow({ label, paise, total = false }: AmountRowProps) {
  const styles = useStyles();
  const stacked = useStackedLayout();
  return (
    <View
      style={[stacked ? styles.stacked : styles.row, total && styles.rule]}
      accessible
      accessibilityLabel={`${label}: ${amountText(paise).spoken}`}
    >
      <View style={styles.label}>
        <Text variant={total ? "bodyStrong" : "body"}>{label}</Text>
      </View>
      <View style={styles.amount}>
        <Amount paise={paise} size={total ? "total" : "row"} />
      </View>
    </View>
  );
}
