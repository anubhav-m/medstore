import { useWindowDimensions } from "react-native";
import { STACKED_FONT_SCALE } from "./sizes";

/** True when the phone's font size is large enough that label/value and button rows must stack. */
export function useStackedLayout(): boolean {
  return useWindowDimensions().fontScale >= STACKED_FONT_SCALE;
}
