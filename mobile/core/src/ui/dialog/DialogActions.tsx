import { View } from "react-native";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { useStackedLayout } from "../../theme/useStackedLayout";
import { Button } from "../Button";

interface DialogActionsProps {
  destructive: boolean;
  confirmLabel: string;
  loadingLabel?: string;
  dismissLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  loading: boolean;
  confirmDisabled: boolean;
}

const useStyles = createStyles(({ spacing }) => ({
  row: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: spacing.touchGap,
  },
  stacked: { gap: spacing.touchGap },
}));

/**
 * Compact density at normal font size: side by side, right-aligned, dismiss on the left.
 * Comfortable density or a large font: stacked full width, confirm on top.
 */
export function DialogActions({
  destructive,
  confirmLabel,
  loadingLabel,
  dismissLabel,
  onConfirm,
  onDismiss,
  loading,
  confirmDisabled,
}: DialogActionsProps) {
  const styles = useStyles();
  const { density } = useDesign();
  const stackedForFont = useStackedLayout();
  const stacked = density === "comfortable" || stackedForFont;

  const confirm = (
    <Button
      variant={destructive ? "danger" : "primary"}
      label={confirmLabel}
      loadingLabel={loadingLabel}
      onPress={onConfirm}
      loading={loading}
      disabled={confirmDisabled}
      fullWidth={stacked}
    />
  );
  const keep = (
    <Button
      variant={stacked ? "secondary" : "text"}
      label={dismissLabel}
      onPress={onDismiss}
      disabled={loading}
      fullWidth={stacked}
    />
  );

  return (
    <View style={stacked ? styles.stacked : styles.row}>
      {stacked ? confirm : keep}
      {stacked ? keep : confirm}
    </View>
  );
}
