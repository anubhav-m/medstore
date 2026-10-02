import { useEffect, useState } from "react";
import { ActivityIndicator, useWindowDimensions, View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { useDesign } from "../theme/DesignProvider";
import { loaderDelays } from "../theme/motion";
import { Text } from "./Text";

interface LoaderProps {
  /** screen: first load with nothing to show; inline: inside a row or field; placeholder: list rows. */
  variant?: "screen" | "inline" | "placeholder";
  /** screen: what is loading, "Loading your orders". */
  label?: string;
  /** placeholder: how many rows to draw. */
  rows?: number;
}

const DEFAULT_PLACEHOLDER_ROWS = 3;

const useStyles = createStyles(({ colors, spacing, radii, borderWidths }) => ({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.stackGap,
    padding: spacing.screenPadding,
  },
  rows: { gap: spacing.stackGap },
  row: {
    gap: spacing.fieldGap,
    padding: spacing.platePadding,
    borderRadius: radii.plate,
    borderWidth: borderWidths.divider,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  // Static blocks the height of a title and a body line. No shimmer: it costs battery on cheap phones.
  blockTitle: {
    width: "45%",
    borderRadius: radii.badge,
    backgroundColor: colors.sunken,
  },
  blockBody: {
    width: "80%",
    borderRadius: radii.badge,
    backgroundColor: colors.sunken,
  },
}));

/** Reveals the label after 400 ms (no flash on fast loads), then adds a slow-connection line. */
function useLoaderStage(): "quiet" | "label" | "slow" {
  const [stage, setStage] = useState<"quiet" | "label" | "slow">("quiet");
  useEffect(() => {
    const showLabel = setTimeout(() => setStage("label"), loaderDelays.showLabelAfterMs);
    const showSlow = setTimeout(() => setStage("slow"), loaderDelays.slowConnectionAfterMs);
    return () => {
      clearTimeout(showLabel);
      clearTimeout(showSlow);
    };
  }, []);
  return stage;
}

function ScreenLoader({ label }: { label: string }) {
  const styles = useStyles();
  const { colors, sizes } = useDesign();
  const stage = useLoaderStage();
  return (
    <View style={styles.screen} accessibilityLiveRegion="polite">
      <ActivityIndicator size={sizes.spinnerScreen} color={colors.ink} accessibilityLabel={label} />
      {stage !== "quiet" ? <Text align="center">{label}</Text> : null}
      {stage === "slow" ? (
        <Text color="secondary" align="center">
          Still loading. Your connection may be slow.
        </Text>
      ) : null}
    </View>
  );
}

export function Loader({
  variant = "screen",
  label = "Loading",
  rows = DEFAULT_PLACEHOLDER_ROWS,
}: LoaderProps) {
  const styles = useStyles();
  const { colors, sizes, type } = useDesign();
  const { fontScale } = useWindowDimensions();
  if (variant === "screen") return <ScreenLoader label={label} />;
  if (variant === "inline") {
    return (
      <ActivityIndicator size={sizes.spinnerInline} color={colors.ink} accessibilityLabel={label} />
    );
  }
  return (
    <View style={styles.rows} accessible accessibilityLabel={label}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          {/* Grow with the font size, so the real rows don't jump when they replace these. */}
          <View style={[styles.blockTitle, { height: type.title.lineHeight * fontScale }]} />
          <View style={[styles.blockBody, { height: type.body.lineHeight * fontScale }]} />
        </View>
      ))}
    </View>
  );
}
