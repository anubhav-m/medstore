import { REASON_NOTE_MAX_LENGTH } from "@medstore/shared";
import { Pressable, View } from "react-native";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { Icon } from "../Icon";
import { Input } from "../input/Input";
import { Text } from "../Text";

const OTHER = "OTHER";

interface ReasonPickerProps<Code extends string> {
  /** "Why are you rejecting this order?" */
  label: string;
  /** A labels Record from reasonLabels.ts, e.g. rejectReasonLabels. */
  reasons: Record<Code, string>;
  value: Code | null;
  onChange: (code: Code) => void;
  note: string;
  onNoteChange: (note: string) => void;
  noteError?: string;
}

const useStyles = createStyles(({ spacing, sizes, radii, colors }) => ({
  root: { gap: spacing.stackGap },
  options: { gap: spacing.touchGap },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.inlineGap,
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.fieldGap,
    borderRadius: radii.control,
  },
  pressed: { backgroundColor: colors.sunken },
  optionLabel: { flex: 1 },
}));

/** Reason codes as radio rows plus a note, which becomes required when "Other" is chosen. */
export function ReasonPicker<Code extends string>({
  label,
  reasons,
  value,
  onChange,
  note,
  onNoteChange,
  noteError,
}: ReasonPickerProps<Code>) {
  const styles = useStyles();
  const { colors } = useDesign();
  const codes = Object.keys(reasons) as Code[];
  const noteRequired = value === OTHER;

  return (
    <View style={styles.root}>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={label}>
        <Text variant="label">{label}</Text>
        {codes.map((code) => {
          const selected = code === value;
          return (
            <Pressable
              key={code}
              onPress={() => onChange(code)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={reasons[code]}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Icon name={selected ? "radiobox-marked" : "radiobox-blank"} color={colors.ink} />
              <View style={styles.optionLabel}>
                <Text>{reasons[code]}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Input
        variant="multiline"
        label={noteRequired ? "Note (required)" : "Note (optional)"}
        value={note}
        onChangeText={onNoteChange}
        maxLength={REASON_NOTE_MAX_LENGTH}
        error={noteError}
      />
    </View>
  );
}
