import { useEffect, useRef, type RefObject } from "react";
import { AccessibilityInfo, type View } from "react-native";

/** After the dialog has closed, moves TalkBack focus back to the control that opened it. */
export function useReturnFocus(rendered: boolean, target: RefObject<View | null> | undefined) {
  const wasShown = useRef(false);
  useEffect(() => {
    if (rendered) {
      wasShown.current = true;
      return;
    }
    const opener = target?.current;
    if (wasShown.current && opener) AccessibilityInfo.sendAccessibilityEvent(opener, "focus");
    wasShown.current = false;
  }, [rendered, target]);
}
