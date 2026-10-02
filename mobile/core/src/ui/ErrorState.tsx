import { View } from "react-native";
import { createStyles } from "../theme/createStyles";
import { Button } from "./Button";
import { StateDisc } from "./internal/StateDisc";
import { useAnnounce } from "./internal/useAnnounce";
import { Text } from "./Text";

interface ErrorStateProps {
  /** screen: centred in place of the content; section: inside a card when part of a screen failed. */
  variant?: "screen" | "section";
  /** network shows the cloud-off icon; other shows the alert icon. */
  kind?: "network" | "other";
  /** "Couldn't load your orders". */
  title: string;
  /** From getErrorMessage — never a code. */
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

const useStyles = createStyles(({ spacing }) => ({
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.stackGap,
    padding: spacing.screenPadding,
  },
  section: { alignItems: "center", gap: spacing.stackGap, paddingVertical: spacing.platePadding },
  text: { alignSelf: "stretch", gap: spacing.fieldGap },
  // Centres the content-width Retry button under the centred text.
  action: { alignSelf: "center", maxWidth: "100%" },
}));

export function ErrorState({
  variant = "screen",
  kind = "other",
  title,
  message,
  onRetry,
  retrying = false,
}: ErrorStateProps) {
  const styles = useStyles();
  // "Retrying" while it runs, then the error again if the retry failed too, so a second failure
  // isn't silent.
  useAnnounce(retrying ? "Retrying" : `${title}. ${message}`);
  return (
    <View style={variant === "screen" ? styles.screen : styles.section}>
      <StateDisc icon={kind === "network" ? "cloud-off-outline" : "alert-circle-outline"} />
      <View style={styles.text}>
        <Text variant="title" align="center">
          {title}
        </Text>
        <Text color="secondary" align="center">
          {message}
        </Text>
      </View>
      {/* No icon: a refresh glyph would look like the spinner it turns into while retrying. */}
      <View style={styles.action}>
        <Button
          variant="secondary"
          label="Retry"
          loadingLabel="Retrying…"
          onPress={onRetry}
          loading={retrying}
          fullWidth={false}
        />
      </View>
    </View>
  );
}
