import { useEffect, useState } from "react";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { durations, easings } from "../../theme/motion";

/** The dialog grows from this scale as it enters. */
const ENTER_FROM_SCALE = 0.95;

/**
 * Keeps the Modal mounted while the dialog animates out, and drives the scrim and card animations.
 * With "Remove animations" on, both changes are instant.
 */
export function useDialogPresence(visible: boolean) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const [rendered, setRendered] = useState(visible);
  // Mount as soon as the dialog is asked for; unmounting waits for the exit animation below.
  if (visible && !rendered) setRendered(true);

  useEffect(() => {
    if (visible) {
      progress.set(
        withTiming(1, {
          duration: reduceMotion ? 0 : durations.emphasized,
          easing: easings.emphasizedDecelerate,
        }),
      );
      return undefined;
    }
    const exitDuration = reduceMotion ? 0 : durations.exit;
    progress.set(withTiming(0, { duration: exitDuration, easing: easings.accelerate }));
    const unmount = setTimeout(() => setRendered(false), exitDuration);
    return () => clearTimeout(unmount);
  }, [visible, reduceMotion, progress]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scale: ENTER_FROM_SCALE + (1 - ENTER_FROM_SCALE) * progress.get() }],
  }));

  return { rendered, scrimStyle, cardStyle };
}
