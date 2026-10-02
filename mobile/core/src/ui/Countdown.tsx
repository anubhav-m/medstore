import { View } from "react-native";
import { formatCountdown } from "../format/formatDuration";
import { createStyles } from "../theme/createStyles";
import { useDesign } from "../theme/DesignProvider";
import { Icon } from "./Icon";
import { useMinuteClock } from "./internal/useMinuteClock";
import { Text } from "./Text";

interface CountdownProps {
  /** billExpiresAt from the server. */
  until: Date | string | number;
}

const useStyles = createStyles(({ spacing }) => ({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.fieldGap },
}));

/**
 * Time left to confirm a bill: "25 min left". Under 10 minutes it turns rust and gains the timer
 * icon, so urgency isn't carried by colour alone; at zero it reads "Time's up".
 */
export function Countdown({ until }: CountdownProps) {
  const styles = useStyles();
  const { familyColors } = useDesign();
  const clock = useMinuteClock();
  // No expiry from the server: show nothing rather than "NaN min left" or a crash.
  if (Number.isNaN(new Date(until).getTime())) return null;
  const countdown = formatCountdown(until, clock);
  return (
    <View style={styles.row} accessible accessibilityLabel={countdown.spoken}>
      {countdown.urgent ? <Icon name="timer-sand" color={familyColors.rust.solid} /> : null}
      <Text tabular color={countdown.urgent ? "rust" : "ink"}>
        {countdown.text}
      </Text>
    </View>
  );
}
