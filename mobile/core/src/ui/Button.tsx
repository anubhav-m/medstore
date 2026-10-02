import type { Ref } from "react";
import { Pressable, View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { useDesign } from "../theme/DesignProvider";
import { buttonColors, type ButtonVariant } from "./buttonColors";
import type { IconName } from "./Icon";
import { ButtonContent } from "./internal/ButtonContent";
import { FocusRing, useFocusState } from "./internal/FocusRing";

interface ButtonProps {
  variant?: ButtonVariant;
  /** A verb that says what happens: "Place order", never "OK". */
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  /** The ongoing verb shown while loading: "Placing order…". */
  loadingLabel?: string;
  /** Defaults to full width in the customer app and content width in the admin app. */
  fullWidth?: boolean;
  accessibilityHint?: string;
  /** Lets a dialog hand TalkBack focus back to the button that opened it. */
  ref?: Ref<View>;
}

const useStyles = createStyles(({ sizes, spacing, radii, borderWidths }) => ({
  pressable: {
    minHeight: sizes.controlHeight,
    minWidth: sizes.touchTarget,
    borderRadius: radii.control,
    borderWidth: borderWidths.control,
    paddingHorizontal: spacing.controlPadding,
    paddingVertical: spacing.fieldGap,
    justifyContent: "center",
  },
  textVariant: { minHeight: sizes.touchTarget },
  fullWidth: { alignSelf: "stretch" },
  hug: { alignSelf: "flex-start" },
  // Lays out the other state's content with no height, so the button is as wide as the wider of
  // its resting and loading content and never changes width when it starts or stops loading.
  ghost: { height: 0, overflow: "hidden" },
}));

export function Button({
  variant = "primary",
  label,
  onPress,
  icon,
  disabled = false,
  loading = false,
  loadingLabel,
  fullWidth,
  accessibilityHint,
  ref,
}: ButtonProps) {
  const styles = useStyles();
  const { density, radii } = useDesign();
  const { focused, focusHandlers } = useFocusState();
  const busyLabel = loadingLabel ?? label;
  const shownLabel = loading ? busyLabel : label;
  const stretch = fullWidth ?? density === "comfortable";
  // The loading reservation below widens a content-width button; centred, a text button's label
  // would drift away from the text it sits under (a banner's message), so it starts at the edge.
  const alignStart = variant === "text" && !stretch;

  return (
    <Pressable
      ref={ref}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={shownLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, busy: loading }}
      {...focusHandlers}
      style={({ pressed }) => {
        const palette = buttonColors(variant, { pressed, disabled });
        return [
          styles.pressable,
          variant === "text" && styles.textVariant,
          stretch ? styles.fullWidth : styles.hug,
          { backgroundColor: palette.fill, borderColor: palette.border },
        ];
      }}
    >
      {({ pressed }) => {
        const palette = buttonColors(variant, { pressed, disabled });
        const underline = variant === "text";
        return (
          <>
            <ButtonContent
              palette={palette}
              label={shownLabel}
              icon={icon}
              loading={loading}
              underline={underline}
              alignStart={alignStart}
            />
            <View style={styles.ghost} importantForAccessibility="no-hide-descendants">
              <ButtonContent
                palette={palette}
                label={loading ? label : busyLabel}
                icon={icon}
                loading={!loading}
                underline={underline}
                alignStart={alignStart}
              />
            </View>
            <FocusRing visible={focused} radius={radii.control} />
          </>
        );
      }}
    </Pressable>
  );
}
