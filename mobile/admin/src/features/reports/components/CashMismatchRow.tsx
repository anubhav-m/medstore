import {
  createStyles,
  formatCashDifference,
  formatCurrency,
  formatCurrencySpoken,
  OrderNumber,
  spokenOrderNumber,
  Text,
} from "@medstore/mobile-core";
import { memo } from "react";
import { View } from "react-native";
import { CashDifference } from "./CashDifference";

interface CashMismatchRowProps {
  orderNumber: string;
  expectedPaise: number;
  collectedPaise: number;
}

const useStyles = createStyles(({ colors, spacing, borderWidths }) => ({
  row: {
    gap: spacing.fieldGap,
    paddingVertical: spacing.rowPaddingVertical,
    borderBottomWidth: borderWidths.divider,
    borderBottomColor: colors.borderSubtle,
  },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: spacing.inlineGap,
    rowGap: spacing.fieldGap,
  },
}));

/** A delivered order whose collected cash differs from its total, as the daily report lists it. */
export const CashMismatchRow = memo(function CashMismatchRow({
  orderNumber,
  expectedPaise,
  collectedPaise,
}: CashMismatchRowProps) {
  const styles = useStyles();
  const difference = collectedPaise - expectedPaise;
  const spoken = [
    spokenOrderNumber(orderNumber),
    `expected ${formatCurrencySpoken(expectedPaise)}`,
    `collected ${formatCurrencySpoken(collectedPaise)}`,
    formatCashDifference(difference).spoken,
  ].join(", ");
  return (
    <View style={styles.row} accessible accessibilityLabel={spoken}>
      <View style={styles.line}>
        <OrderNumber value={orderNumber} emphasizeSequence />
        <CashDifference differencePaise={difference} />
      </View>
      <Text variant="caption" color="secondary" tabular>
        {`Expected ${formatCurrency(expectedPaise)} · Collected ${formatCurrency(collectedPaise)}`}
      </Text>
    </View>
  );
});
