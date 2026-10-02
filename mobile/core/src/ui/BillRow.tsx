import { View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { useStackedLayout } from "../theme/useStackedLayout";
import { Amount } from "./Amount";
import { amountText } from "./internal/amountText";
import { Text } from "./Text";

interface BillRowProps {
  /** Free text from the bill, shown in full: medicine names are only ever on order detail. */
  name: string;
  quantity: number;
  unitPricePaise: number;
  /** lineTotalPaise from the server. */
  lineTotalPaise: number;
}

const useStyles = createStyles(({ spacing, space }) => ({
  root: { gap: space.xxs },
  figures: { flexDirection: "row", alignItems: "baseline", gap: spacing.inlineGap },
  figuresStacked: { gap: space.xxs },
  rate: { flex: 1 },
}));

/**
 * One bill line: the item name, then "2 × ₹45.50" on the left and the line total right-aligned.
 * In stacked mode the line total moves below the rate.
 */
export function BillRow({ name, quantity, unitPricePaise, lineTotalPaise }: BillRowProps) {
  const styles = useStyles();
  const stacked = useStackedLayout();
  const unitPrice = amountText(unitPricePaise);
  const spoken = `${name}, ${quantity} at ${unitPrice.spoken}, ${amountText(lineTotalPaise).spoken}`;
  return (
    <View style={styles.root} accessible accessibilityLabel={spoken}>
      <Text>{name}</Text>
      <View style={stacked ? styles.figuresStacked : styles.figures}>
        <View style={stacked ? undefined : styles.rate}>
          <Text color="secondary" tabular>
            {`${quantity} × ${unitPrice.text}`}
          </Text>
        </View>
        <Amount paise={lineTotalPaise} />
      </View>
    </View>
  );
}
