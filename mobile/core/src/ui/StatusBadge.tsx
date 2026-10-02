import type { OrderStatus } from "@medstore/shared";
import { useWindowDimensions, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { createStyles } from "../theme/createStyles";
import { useDesign } from "../theme/DesignProvider";
import { Icon } from "./Icon";
import { markEntering, markExiting } from "./status/markTransitions";
import { statusDisplay, statusLook } from "./status/orderStatusDisplay";
import { Text } from "./Text";

interface StatusBadgeProps {
  status: OrderStatus;
  /** mark: the disc, for order headers; badge: the tinted chip, for lists and timelines. */
  variant?: "mark" | "badge";
  /** Customer app only: the "what happens next" line under a mark (orderStatusNextStep). */
  nextStep?: string;
}

// Spread rather than StyleSheet.absoluteFill so the factory stays a plain object.
const absoluteFill = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

const useStyles = createStyles(({ sizes, spacing, space, radii, borderWidths, colors }) => ({
  markRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.inlineGap },
  markText: { flex: 1, gap: spacing.fieldGap },
  disc: { width: sizes.markDisc, height: sizes.markDisc },
  discFace: {
    ...absoluteFill,
    borderRadius: radii.mark,
    alignItems: "center",
    justifyContent: "center",
  },
  haldiRing: { borderWidth: borderWidths.control, borderColor: colors.haldiEdge },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: spacing.fieldGap,
    minHeight: sizes.badgeHeight,
    paddingHorizontal: spacing.inlineGap,
    paddingVertical: space.xxs,
    borderRadius: radii.badge,
  },
  badgeLabel: { flexShrink: 1 },
}));

/** Status is always disc or tint + glyph + word, never colour alone (DESIGN.md). */
export function StatusBadge({ status, variant = "badge", nextStep }: StatusBadgeProps) {
  const styles = useStyles();
  const { app, colors, familyColors, sizes, type } = useDesign();
  const { fontScale } = useWindowDimensions();
  const { icon } = statusDisplay(status);
  const look = statusLook(status, app);
  const family = familyColors[look.family];
  const isHaldi = look.family === "haldi";

  if (variant === "badge") {
    return (
      <View
        style={[styles.badge, { backgroundColor: family.tint }]}
        accessible
        accessibilityLabel={`Status: ${look.label}`}
      >
        <Icon name={icon} size="badge" color={family.solid} />
        <View style={styles.badgeLabel}>
          <Text variant="label" color={`${look.family}.onTint`}>
            {look.label}
          </Text>
        </View>
      </View>
    );
  }

  // The label's first line is centred on the disc; a wrapping next-step line grows downwards only.
  const labelOffset = Math.max(0, (sizes.markDisc - type.title.lineHeight * fontScale) / 2);
  return (
    <View
      style={styles.markRow}
      accessible
      accessibilityLabel={nextStep ? `Status: ${look.label}. ${nextStep}` : `Status: ${look.label}`}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.disc}>
        <LayoutAnimationConfig skipEntering>
          <Animated.View
            key={status}
            entering={markEntering}
            exiting={markExiting}
            style={[
              styles.discFace,
              { backgroundColor: isHaldi ? colors.haldi : family.solid },
              isHaldi && styles.haldiRing,
            ]}
          >
            <Icon name={icon} size="mark" color={family.onSolid} />
          </Animated.View>
        </LayoutAnimationConfig>
      </View>
      <View style={[styles.markText, { paddingTop: labelOffset }]}>
        <Text variant="title">{look.label}</Text>
        {nextStep ? <Text color="secondary">{nextStep}</Text> : null}
      </View>
    </View>
  );
}
