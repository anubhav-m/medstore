const ORDER_NUMBER_PATTERN = /^([A-Z0-9]+)-(\d+)$/;

export interface OrderNumberParts {
  storeCode: string;
  sequence: string;
}

/** "ST01-000042" → { storeCode: "ST01", sequence: "000042" }, or null for anything else. */
export function splitOrderNumber(orderNumber: string): OrderNumberParts | null {
  const match = ORDER_NUMBER_PATTERN.exec(orderNumber);
  return match?.[1] && match[2] ? { storeCode: match[1], sequence: match[2] } : null;
}

/** "ST01-000042" → "Order S T 0 1, 0 0 0 0 4 2", so TalkBack reads it character by character. */
export function spokenOrderNumber(orderNumber: string): string {
  const parts = splitOrderNumber(orderNumber);
  const spell = (text: string) => text.split("").join(" ");
  return parts
    ? `Order ${spell(parts.storeCode)}, ${spell(parts.sequence)}`
    : `Order ${spell(orderNumber)}`;
}
