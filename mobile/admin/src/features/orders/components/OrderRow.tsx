import type { OrderStatus } from "@medstore/shared";
import {
  Amount,
  createStyles,
  formatCurrencySpoken,
  Icon,
  OrderNumber,
  spokenOrderNumber,
  StatusBadge,
  statusLook,
  Text,
  useDesign,
} from "@medstore/mobile-core";
import { memo } from "react";
import { Pressable, View } from "react-native";

interface OrderRowMeta {
  /** "Waiting 12 min" (New), "7 min left" (Awaiting customer), "Delivered 4:30 PM". */
  text: string;
  /** The same in whole words for TalkBack, when the text abbreviates. */
  spoken?: string;
  /** A bill about to expire: rust with the timer icon. */
  urgent?: boolean;
}

interface OrderRowProps {
  orderNumber: string;
  status: OrderStatus;
  meta: OrderRowMeta;
  /** The bill total; absent until a bill has been sent. */
  totalPaise?: number;
  onPress: () => void;
}

const useStyles = createStyles(({ colors, spacing }) => ({
  row: {
    gap: spacing.fieldGap,
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: spacing.rowPaddingVertical,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.sunken },
  line: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    columnGap: spacing.inlineGap,
    rowGap: spacing.fieldGap,
  },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.fieldGap },
}));

/**
 * One order in the admin queue, two lines tall: the order number and total, then the status badge
 * and how long it has waited. No patient names, photos or medicines: those are on order detail only.
 */
export const OrderRow = memo(function OrderRow({
  orderNumber,
  status,
  meta,
  totalPaise,
  onPress,
}: OrderRowProps) {
  const styles = useStyles();
  const { app, familyColors } = useDesign();
  const spoken = [
    spokenOrderNumber(orderNumber),
    `Status: ${statusLook(status, app).label}`,
    meta.spoken ?? meta.text,
    totalPaise === undefined ? "No bill yet" : formatCurrencySpoken(totalPaise),
  ].join(", ");

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.line}>
        <OrderNumber value={orderNumber} emphasizeSequence />
        {totalPaise === undefined ? null : <Amount paise={totalPaise} />}
      </View>
      <View style={styles.line}>
        <StatusBadge status={status} />
        <View style={styles.meta}>
          {meta.urgent ? <Icon name="timer-sand" color={familyColors.rust.solid} /> : null}
          <Text variant="caption" tabular color={meta.urgent ? "rust" : "secondary"}>
            {meta.text}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});
