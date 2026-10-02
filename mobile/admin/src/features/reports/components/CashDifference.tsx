import { createStyles, formatCashDifference, Icon, Text, useDesign } from "@medstore/mobile-core";
import { View } from "react-native";

const useStyles = createStyles(({ spacing }) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.fieldGap },
}));

/**
 * Collected − expected cash: "Matches" in green, or "+₹50.00 extra" / "−₹50.00 short" in rust with
 * the warning icon, so a mismatch never reads by colour alone.
 */
export function CashDifference({ differencePaise }: { differencePaise: number }) {
  const styles = useStyles();
  const { familyColors } = useDesign();
  const difference = formatCashDifference(differencePaise);
  const matches = difference.kind === "match";
  const family = matches ? "green" : "rust";
  return (
    <View style={styles.row} accessible accessibilityLabel={difference.spoken}>
      <Icon
        name={matches ? "check-circle-outline" : "alert-outline"}
        color={familyColors[family].solid}
      />
      <Text variant="bodyStrong" tabular color={family}>
        {difference.text}
      </Text>
    </View>
  );
}
