import { StyleSheet } from "react-native";
import type { AppKind } from "./density";
import { useDesign } from "./DesignProvider";
import type { Tokens } from "./tokens";

type NamedStyles<T> = StyleSheet.NamedStyles<T>;

/**
 * Builds a component's StyleSheet from the tokens, once per app, so no component holds a raw
 * colour, size or font name. Returns a hook that picks the sheet for the current app.
 */
export function createStyles<T extends NamedStyles<T>>(factory: (tokens: Tokens) => T) {
  const cache = new Map<AppKind, T>();
  return function useStyles(): T {
    const tokens = useDesign();
    let sheet = cache.get(tokens.app);
    if (!sheet) {
      sheet = StyleSheet.create(factory(tokens));
      cache.set(tokens.app, sheet);
    }
    return sheet;
  };
}
