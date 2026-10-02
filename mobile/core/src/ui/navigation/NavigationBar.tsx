import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { Icon, type IconName } from "../Icon";
import { Text } from "../Text";

export interface NavigationItem<Key extends string> {
  key: Key;
  label: string;
  icon: IconName;
}

interface NavigationBarProps<Key extends string> {
  /** Three or four destinations. */
  items: readonly NavigationItem<Key>[];
  selected: Key;
  onSelect: (key: Key) => void;
}

const useStyles = createStyles(({ colors, spacing, space, sizes, radii, borderWidths }) => ({
  bar: {
    flexDirection: "row",
    gap: spacing.touchGap,
    minHeight: sizes.navigationBarHeight,
    paddingHorizontal: spacing.fieldGap,
    borderTopWidth: borderWidths.divider,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.xxs,
    minHeight: sizes.touchTarget,
    paddingVertical: spacing.fieldGap,
  },
  indicator: {
    width: sizes.navigationIndicatorWidth,
    height: sizes.navigationIndicatorHeight,
    borderRadius: radii.mark,
    borderWidth: borderWidths.control,
    borderColor: colors.transparent,
    alignItems: "center",
    justifyContent: "center",
  },
  // Ink outline on sunken plus the ink label: turmeric is kept for "your move" only.
  indicatorActive: { backgroundColor: colors.sunken, borderColor: colors.ink },
  indicatorPressed: { backgroundColor: colors.sunken },
}));

/** Material bottom navigation bar, presentational only: the app shell wires it to Expo Router. */
export function NavigationBar<Key extends string>({
  items,
  selected,
  onSelect,
}: NavigationBarProps<Key>) {
  const styles = useStyles();
  const { colors } = useDesign();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      {items.map((item) => {
        const active = item.key === selected;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={item.label}
            style={styles.item}
          >
            {({ pressed }) => (
              <>
                <View
                  style={[
                    styles.indicator,
                    active && styles.indicatorActive,
                    pressed && !active && styles.indicatorPressed,
                  ]}
                >
                  <Icon name={item.icon} color={active ? colors.ink : colors.inkSecondary} />
                </View>
                <Text
                  variant="label"
                  align="center"
                  color={active ? "ink" : "secondary"}
                  fitOneLine
                >
                  {item.label}
                </Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
