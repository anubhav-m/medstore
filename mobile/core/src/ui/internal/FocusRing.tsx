import { useState } from "react";
import { View } from "react-native";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";

const useStyles = createStyles(({ colors, borderWidths }) => {
  const inset = -(borderWidths.focus + borderWidths.focusOffset);
  return {
    ring: {
      position: "absolute",
      top: inset,
      right: inset,
      bottom: inset,
      left: inset,
      borderWidth: borderWidths.focus,
      borderColor: colors.ink,
    },
  };
});

/** Tracks keyboard / switch-access focus on a Pressable. TalkBack draws its own focus. */
export function useFocusState() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    focusHandlers: { onFocus: () => setFocused(true), onBlur: () => setFocused(false) },
  };
}

interface FocusRingProps {
  visible: boolean;
  /** The control's corner radius; the ring follows it at its offset. */
  radius: number;
}

/** The 3 dp ink ring drawn 2 dp outside a focused control. */
export function FocusRing({ visible, radius }: FocusRingProps) {
  const styles = useStyles();
  const { borderWidths } = useDesign();
  if (!visible) return null;
  const ringRadius = radius + borderWidths.focus + borderWidths.focusOffset;
  return <View pointerEvents="none" style={[styles.ring, { borderRadius: ringRadius }]} />;
}
