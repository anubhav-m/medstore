import { Easing } from "react-native-reanimated";

export const durations = {
  fast: 120,
  standard: 220,
  emphasized: 320,
  exit: 160,
} as const;

// Material 3 curves.
export const easings = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  emphasizedDecelerate: Easing.bezier(0.05, 0.7, 0.1, 1),
  accelerate: Easing.bezier(0.3, 0, 0.8, 0.15),
} as const;

/** How far the old mark shrinks and the new one overshoots when a status changes. */
export const markMotion = {
  exitScale: 0.9,
  enterScale: 1.08,
} as const;

/** Loader timing: quiet for fast loads, honest for slow ones. */
export const loaderDelays = {
  showLabelAfterMs: 400,
  slowConnectionAfterMs: 10_000,
} as const;
