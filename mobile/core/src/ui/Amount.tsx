import { useStackedLayout } from "../theme/useStackedLayout";
import { amountText } from "./internal/amountText";
import { Text, type TextColor } from "./Text";

interface AmountProps {
  /** Integer paise from the server. Never computed from floats. */
  paise: number;
  /** row: a bill line or summary value; total: the bill total. */
  size?: "row" | "total";
  align?: "left" | "right";
  color?: TextColor;
}

/**
 * Money on screen: always formatCurrency, tabular figures, and a spoken label for TalkBack. An amount
 * never breaks across lines: at large font sizes the total steps down to Headline, and any amount
 * still too wide shrinks to fit its row.
 */
export function Amount({ paise, size = "row", align = "right", color = "ink" }: AmountProps) {
  const stacked = useStackedLayout();
  const totalVariant = stacked ? "headline" : "display";
  const amount = amountText(paise);
  return (
    <Text
      variant={size === "total" ? totalVariant : "bodyStrong"}
      tabular
      align={align}
      color={color}
      fitOneLine
      accessibilityLabel={amount.spoken}
    >
      {amount.text}
    </Text>
  );
}
