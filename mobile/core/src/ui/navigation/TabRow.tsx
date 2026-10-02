import { Pressable, ScrollView, View } from "react-native";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { Text } from "../Text";
import { useRevealSelected } from "./useRevealSelected";

export interface TabItem<Key extends string> {
  key: Key;
  label: string;
  /** Shown beside the label in tabular figures. */
  count?: number;
}

interface TabRowProps<Key extends string> {
  items: readonly TabItem<Key>[];
  selected: Key;
  onSelect: (key: Key) => void;
}

const useStyles = createStyles(({ colors, spacing, sizes, borderWidths }) => ({
  row: {
    borderBottomWidth: borderWidths.divider,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  content: { paddingHorizontal: spacing.screenPadding, gap: spacing.touchGap },
  tab: {
    minHeight: sizes.touchTarget,
    justifyContent: "center",
    paddingHorizontal: spacing.inlineGap,
    borderBottomWidth: borderWidths.tabIndicator,
    borderBottomColor: colors.transparent,
  },
  selected: { borderBottomColor: colors.ink },
  pressed: { backgroundColor: colors.sunken },
  label: { flexDirection: "row", alignItems: "baseline", gap: spacing.fieldGap },
}));

/**
 * The admin order tabs: a horizontally scrolling row that never squeezes or truncates a tab. The
 * selected tab has an ink underline and ink label, and is scrolled into view when it is off screen.
 * Presentational only.
 */
/** Tracking the scroll position only decides whether a tab is in view; it needn't be per-frame. */
const SCROLL_EVENT_THROTTLE_MS = 100;

export function TabRow<Key extends string>({ items, selected, onSelect }: TabRowProps<Key>) {
  const styles = useStyles();
  const { spacing } = useDesign();
  const { scrollRef, onRowLayout, onScroll, onTabLayout } = useRevealSelected(
    selected,
    spacing.screenPadding,
  );
  return (
    <View style={styles.row}>
      <ScrollView
        ref={scrollRef}
        onLayout={onRowLayout}
        onScroll={onScroll}
        scrollEventThrottle={SCROLL_EVENT_THROTTLE_MS}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
        accessibilityRole="tablist"
      >
        {items.map((item) => {
          const active = item.key === selected;
          const spoken = item.count === undefined ? item.label : `${item.label}, ${item.count}`;
          return (
            <Pressable
              key={item.key}
              onLayout={onTabLayout(item.key)}
              onPress={() => onSelect(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={spoken}
              style={({ pressed }) => [
                styles.tab,
                active && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.label}>
                <Text variant="label" color={active ? "ink" : "secondary"}>
                  {item.label}
                </Text>
                {item.count === undefined ? null : (
                  <Text variant="label" tabular color={active ? "ink" : "secondary"}>
                    {String(item.count)}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
