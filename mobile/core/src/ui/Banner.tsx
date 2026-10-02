import { useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeOut, ReduceMotion } from "react-native-reanimated";
import { semanticFamily, type SemanticTone } from "../theme/colors";
import { createStyles } from "../theme/createStyles";
import { useDesign } from "../theme/DesignProvider";
import { durations } from "../theme/motion";
import { Button } from "./Button";
import { Icon, type IconName } from "./Icon";
import { IconButton } from "./internal/IconButton";
import { useAnnounce } from "./internal/useAnnounce";
import { Text } from "./Text";

interface BannerProps {
  variant: SemanticTone;
  /** What happened, in one line: "Order placed." */
  title: string;
  /** What happens next. */
  message?: string;
  action?: { label: string; onPress: () => void };
  onDismiss?: () => void;
}

const toneIcon: Record<SemanticTone, IconName> = {
  success: "check-circle-outline",
  info: "information-outline",
  warning: "alert-outline",
  danger: "alert-octagon-outline",
};

const entering = FadeIn.duration(durations.standard).reduceMotion(ReduceMotion.System);
const exiting = FadeOut.duration(durations.fast).reduceMotion(ReduceMotion.System);

const useStyles = createStyles(({ spacing, sizes, radii, borderWidths }) => {
  // Space between the dismiss button's edge and its glyph.
  const dismissInset = (sizes.touchTarget - sizes.iconInline) / 2;
  return {
    plate: { gap: spacing.fieldGap, padding: spacing.platePadding, borderRadius: radii.plate },
    header: { flexDirection: "row", alignItems: "flex-start", gap: spacing.inlineGap },
    // Leaves room for the dismiss button, which sits in the plate's corner.
    headerDismissible: { paddingEnd: sizes.touchTarget - dismissInset },
    iconBox: { justifyContent: "center" },
    title: { flex: 1 },
    // Positioned on the plate rather than in the title row, so its 48 dp target doesn't make the
    // row taller than one line of title (and the title-to-message gap stays the same with or
    // without it). Its glyph lines up with the plate's padding.
    dismiss: { position: "absolute", right: Math.max(0, spacing.platePadding - dismissInset) },
    // The text button's own padding and border are pulled back so its label lines up with the message.
    action: {
      alignSelf: "flex-start",
      marginStart: -(spacing.controlPadding + borderWidths.control),
    },
  };
});

/**
 * The feedback pattern after an action (DESIGN.md): an inline plate at the top of the content that
 * stays until the next action or a dismiss, announced to TalkBack. Never a snackbar or toast. Only
 * the title row shares its width with the dismiss button; the message uses the full width. The icon
 * and the dismiss button are centred on the title's first line.
 */
export function Banner({ variant, title, message, action, onDismiss }: BannerProps) {
  const styles = useStyles();
  const { familyColors, sizes, spacing, type } = useDesign();
  const { fontScale } = useWindowDimensions();
  const family = semanticFamily[variant];
  const colorsForTone = familyColors[family];
  const firstLine = type.bodyStrong.lineHeight * fontScale;
  const dismissTop = Math.max(0, spacing.platePadding + (firstLine - sizes.touchTarget) / 2);
  useAnnounce(message ? `${title} ${message}` : title);
  return (
    <Animated.View
      entering={entering}
      exiting={exiting}
      style={[styles.plate, { backgroundColor: colorsForTone.tint }]}
      accessibilityRole={variant === "danger" ? "alert" : "summary"}
    >
      <View style={[styles.header, onDismiss && styles.headerDismissible]}>
        <View style={[styles.iconBox, { height: firstLine }]}>
          <Icon name={toneIcon[variant]} color={colorsForTone.solid} />
        </View>
        <View style={styles.title}>
          <Text variant="bodyStrong" color={`${family}.onTint`}>
            {title}
          </Text>
        </View>
      </View>
      {message ? <Text>{message}</Text> : null}
      {action ? (
        <View style={styles.action}>
          <Button variant="text" label={action.label} onPress={action.onPress} fullWidth={false} />
        </View>
      ) : null}
      {onDismiss ? (
        <View style={[styles.dismiss, { top: dismissTop }]}>
          <IconButton icon="close" accessibilityLabel="Dismiss" onPress={onDismiss} />
        </View>
      ) : null}
    </Animated.View>
  );
}
