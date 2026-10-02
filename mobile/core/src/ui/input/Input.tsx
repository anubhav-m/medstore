import { useState } from "react";
import { ActivityIndicator, TextInput, View, type TextInputProps } from "react-native";
import { useDesign } from "../../theme/DesignProvider";
import { useStackedLayout } from "../../theme/useStackedLayout";
import { Icon } from "../Icon";
import { FocusRing } from "../internal/FocusRing";
import { IconButton } from "../internal/IconButton";
import { useAnnounce } from "../internal/useAnnounce";
import { Text } from "../Text";
import { FieldMessage } from "./FieldMessage";
import { useInputStyles } from "./inputStyles";
import { inputVariants, type InputVariant } from "./inputVariants";

interface InputProps {
  variant?: InputVariant;
  /** Always visible above the field. The placeholder is only an example, never the label. */
  label: string;
  /** phone: the 10 digits; code: up to 6 digits; money: rupees as typed ("45.5"). */
  value: string;
  onChangeText: (value: string) => void;
  helper?: string;
  /** From the form or the server's errors[]: says how to fix it. */
  error?: string;
  disabled?: boolean;
  /** A lookup is running (item-name suggestions). The field stays editable. */
  loading?: boolean;
  /** Shows the "120 / 500" counter (multiline). */
  maxLength?: number;
  placeholder?: string;
  /** password: "password" to sign in, "new-password" to choose one. */
  passwordPurpose?: "password" | "new-password";
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
}

export function Input({
  variant = "text",
  label,
  value,
  onChangeText,
  helper,
  error,
  disabled = false,
  loading = false,
  maxLength,
  placeholder,
  passwordPurpose = "password",
  onSubmitEditing,
}: InputProps) {
  const styles = useInputStyles();
  const { colors, familyColors, radii } = useDesign();
  const stacked = useStackedLayout();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const behaviour = inputVariants[variant];
  const isPassword = variant === "password";
  const shown = behaviour.display ? behaviour.display(value) : value;
  // The hint is only read when the field is focused; a new error is also said out loud.
  useAnnounce(error ? `${label}: ${error}` : undefined);

  return (
    <View style={styles.root}>
      {/* The field itself carries the label for TalkBack, so it isn't read twice. */}
      <View importantForAccessibility="no-hide-descendants">
        <Text variant="label">{label}</Text>
      </View>
      <View style={styles.fieldWrap}>
        <View
          style={[
            styles.field,
            focused && styles.focused,
            error ? styles.error : null,
            disabled && styles.disabled,
          ]}
        >
          {behaviour.prefix ? (
            <View style={[styles.prefix, stacked && styles.prefixStacked]}>
              <Text tabular color={disabled ? "disabled" : "ink"}>
                {behaviour.prefix}
              </Text>
            </View>
          ) : null}
          {variant === "search" ? (
            <View style={styles.leading}>
              <Icon name="magnify" color={colors.inkSecondary} />
            </View>
          ) : null}
          <TextInput
            {...behaviour.native}
            {...(isPassword && { secureTextEntry: !revealed, autoComplete: passwordPurpose })}
            value={shown}
            onChangeText={(text) =>
              onChangeText(behaviour.sanitise ? behaviour.sanitise(text) : text)
            }
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            editable={!disabled}
            maxLength={maxLength ?? behaviour.native.maxLength}
            placeholder={placeholder}
            placeholderTextColor={colors.inkTertiary}
            selectionColor={familyColors.haldi.solid}
            onSubmitEditing={onSubmitEditing}
            accessibilityLabel={label}
            accessibilityHint={error ?? helper}
            accessibilityState={{ disabled, busy: loading }}
            style={[
              styles.input,
              stacked && styles.inputStacked,
              variant === "code" && styles.code,
              variant === "multiline" && styles.multiline,
              (variant === "money" || variant === "phone") && styles.tabular,
              disabled && styles.inputDisabled,
            ]}
          />
          <View style={styles.trailing}>
            {loading ? (
              <View style={styles.trailingSpinner} importantForAccessibility="no-hide-descendants">
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : null}
            {isPassword && !disabled ? (
              <IconButton
                icon={revealed ? "eye-off-outline" : "eye-outline"}
                accessibilityLabel={revealed ? "Hide password" : "Show password"}
                onPress={() => setRevealed((current) => !current)}
              />
            ) : null}
            {variant === "search" && value.length > 0 && !disabled ? (
              <IconButton
                icon="close"
                accessibilityLabel="Clear search"
                onPress={() => onChangeText("")}
              />
            ) : null}
          </View>
        </View>
        <FocusRing visible={focused && !disabled} radius={radii.control} />
      </View>
      <FieldMessage
        helper={helper}
        error={error}
        count={
          variant === "multiline" && maxLength
            ? { length: value.length, max: maxLength }
            : undefined
        }
      />
    </View>
  );
}
