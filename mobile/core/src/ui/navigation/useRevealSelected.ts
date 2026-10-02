import { useCallback, useEffect, useRef } from "react";
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from "react-native";
import { useReducedMotion } from "react-native-reanimated";

interface Span {
  x: number;
  width: number;
}

/**
 * Keeps the selected tab of a horizontal tab row on screen. At large font sizes the row is much
 * wider than the phone, and a tab chosen off screen (or selected when the screen opens) would
 * otherwise be invisible. The row only scrolls when the tab isn't already fully in view.
 */
export function useRevealSelected<Key extends string>(selected: Key, edgePadding: number) {
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const tabs = useRef(new Map<Key, Span>());
  const view = useRef<Span>({ x: 0, width: 0 });

  const reveal = useCallback(
    (key: Key, animated: boolean) => {
      const tab = tabs.current.get(key);
      const { x: scrollX, width } = view.current;
      if (!tab || width === 0) return;
      if (tab.x - edgePadding < scrollX) {
        scrollRef.current?.scrollTo({ x: Math.max(0, tab.x - edgePadding), animated });
      } else if (tab.x + tab.width + edgePadding > scrollX + width) {
        scrollRef.current?.scrollTo({ x: tab.x + tab.width + edgePadding - width, animated });
      }
    },
    [edgePadding],
  );

  useEffect(() => {
    reveal(selected, !reduceMotion);
  }, [selected, reduceMotion, reveal]);

  return {
    scrollRef,
    onRowLayout: (event: LayoutChangeEvent) => {
      view.current = { ...view.current, width: event.nativeEvent.layout.width };
      reveal(selected, false);
    },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      view.current = { ...view.current, x: event.nativeEvent.contentOffset.x };
    },
    onTabLayout: (key: Key) => (event: LayoutChangeEvent) => {
      const { x, width } = event.nativeEvent.layout;
      tabs.current.set(key, { x, width });
      if (key === selected) reveal(key, false);
    },
  };
}
