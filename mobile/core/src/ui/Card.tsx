import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { useDesign } from "../theme/DesignProvider";
import { Icon } from "./Icon";
import { FocusRing, useFocusState } from "./internal/FocusRing";

interface PlainCardProps {
  /** plain: static; its contents are read one by one. */
  variant?: "plain";
  children: ReactNode;
}

interface PressableCardProps {
  /** pressable: opens something (chevron); turn: the customer must act here (one per screen). */
  variant: "pressable" | "turn";
  onPress: () => void;
  /**
   * TalkBack reads only this, never the contents, so it must hold everything the card shows that
   * matters: "Order S T 0 1, 0 0 0 0 4 2, Status: On the way, 1 thousand 250 rupees".
   */
  accessibilityLabel: string;
  children: ReactNode;
}

type CardProps = PlainCardProps | PressableCardProps;

const useStyles = createStyles(({ colors, spacing, radii, borderWidths }) => ({
  plate: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.inlineGap,
    padding: spacing.platePadding,
    borderRadius: radii.plate,
    borderWidth: borderWidths.divider,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.sunken },
  turn: {
    borderWidth: borderWidths.control,
    borderColor: colors.haldiEdge,
    backgroundColor: colors.haldiTint,
  },
  // The turn card keeps its tint when pressed so its meaning doesn't flicker; its border turns ink.
  turnPressed: { borderColor: colors.ink },
  content: { flex: 1, gap: spacing.stackGap },
}));

export function Card(props: CardProps) {
  const styles = useStyles();
  const { colors, radii } = useDesign();
  const { focused, focusHandlers } = useFocusState();
  const content = <View style={styles.content}>{props.children}</View>;

  if (!("onPress" in props)) {
    return <View style={styles.plate}>{content}</View>;
  }

  const { variant, onPress, accessibilityLabel } = props;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...focusHandlers}
      style={({ pressed }) => [
        styles.plate,
        variant === "turn"
          ? [styles.turn, pressed && styles.turnPressed]
          : pressed && styles.pressed,
      ]}
    >
      {content}
      <Icon name="chevron-right" color={colors.ink} />
      <FocusRing visible={focused} radius={radii.plate} />
    </Pressable>
  );
}
