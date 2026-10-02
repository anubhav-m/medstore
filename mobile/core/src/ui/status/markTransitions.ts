import { Keyframe, ReduceMotion } from "react-native-reanimated";
import { durations, easings, markMotion } from "../../theme/motion";

// ReduceMotion.System: with "Remove animations" on, the mark swaps instantly.

/** The new mark lands: 0.9 → 1.08 → 1 over the standard duration. */
export const markEntering = new Keyframe({
  0: { opacity: 0, transform: [{ scale: markMotion.exitScale }] },
  60: { opacity: 1, transform: [{ scale: markMotion.enterScale }], easing: easings.standard },
  100: { opacity: 1, transform: [{ scale: 1 }], easing: easings.standard },
})
  .duration(durations.standard)
  .reduceMotion(ReduceMotion.System);

/** The old mark shrinks to 0.9 and fades over the fast duration. */
export const markExiting = new Keyframe({
  0: { opacity: 1, transform: [{ scale: 1 }] },
  100: { opacity: 0, transform: [{ scale: markMotion.exitScale }], easing: easings.standard },
})
  .duration(durations.fast)
  .reduceMotion(ReduceMotion.System);
