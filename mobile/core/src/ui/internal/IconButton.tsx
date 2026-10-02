import { Pressable } from "react-native";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { Icon, type IconName } from "../Icon";
import { FocusRing, useFocusState } from "./FocusRing";

interface IconButtonProps {
  icon: IconName;
  /** Required: an icon alone is never the label ("Show password", "Dismiss"). */
  accessibilityLabel: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}

const useStyles = createStyles(({ sizes, radii, colors }) => ({
  button: {
    width: sizes.touchTarget,
    height: sizes.touchTarget,
    borderRadius: radii.mark,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { backgroundColor: colors.sunken },
}));

/** A 48 dp icon-only button: the password eye, a field's clear button, a banner's dismiss. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  color,
  disabled = false,
}: IconButtonProps) {
  const styles = useStyles();
  const { colors, radii } = useDesign();
  const { focused, focusHandlers } = useFocusState();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      {...focusHandlers}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name={icon} color={disabled ? colors.inkDisabled : (color ?? colors.ink)} />
      <FocusRing visible={focused} radius={radii.mark} />
    </Pressable>
  );
}
