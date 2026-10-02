import { splitOrderNumber, spokenOrderNumber } from "../format/orderNumber";
import { ORDER_NUMBER_TRACKING, type TextRole } from "../theme/typography";
import { Text } from "./Text";

interface OrderNumberProps {
  /** Exactly as the server sends it, e.g. "ST01-000042". Never trimmed. */
  value: string;
  variant?: Extract<TextRole, "body" | "title" | "headline">;
  /** Admin rows: the sequence in the strong weight so the changing digits stand out. */
  emphasizeSequence?: boolean;
}

export function OrderNumber({
  value,
  variant = "body",
  emphasizeSequence = false,
}: OrderNumberProps) {
  const parts = splitOrderNumber(value);
  const label = spokenOrderNumber(value);
  if (!emphasizeSequence || !parts) {
    return (
      <Text
        variant={variant}
        tabular
        letterSpacing={ORDER_NUMBER_TRACKING}
        accessibilityLabel={label}
      >
        {value}
      </Text>
    );
  }
  return (
    <Text variant="body" tabular letterSpacing={ORDER_NUMBER_TRACKING} accessibilityLabel={label}>
      {`${parts.storeCode}-`}
      <Text variant="bodyStrong" tabular letterSpacing={ORDER_NUMBER_TRACKING}>
        {parts.sequence}
      </Text>
    </Text>
  );
}
