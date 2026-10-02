import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { TopAppBar, type AppBarAction } from "./TopAppBar";

interface ScreenProps {
  /** scroll: content scrolls; list: the child is a FlatList that owns scrolling; form: inputs + keyboard. */
  variant?: "scroll" | "list" | "form";
  title: string;
  /** Shown when there is history. System Back always works too. */
  onBack?: () => void;
  trailingAction?: AppBarAction;
  /** The bottom action bar: holds the screen's one primary button, above the keyboard. */
  actionBar?: ReactNode;
  children: ReactNode;
}

const useStyles = createStyles(({ colors, spacing, sizes, borderWidths }) => ({
  root: { flex: 1, backgroundColor: colors.ground },
  body: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    gap: spacing.sectionGap,
    padding: spacing.screenPadding,
    width: "100%",
    maxWidth: sizes.contentMaxWidth,
    alignSelf: "center",
  },
  list: { flex: 1, width: "100%", maxWidth: sizes.contentMaxWidth, alignSelf: "center" },
  actionBar: {
    gap: spacing.touchGap,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: spacing.stackGap,
    borderTopWidth: borderWidths.divider,
    borderTopColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  actionBarInner: {
    width: "100%",
    maxWidth: sizes.contentMaxWidth,
    alignSelf: "center",
    gap: spacing.touchGap,
  },
}));

/** The frame of every route: app bar, content on the cotton ground, optional bottom action bar. */
export function Screen({
  variant = "scroll",
  title,
  onBack,
  trailingAction,
  actionBar,
  children,
}: ScreenProps) {
  const styles = useStyles();
  const { spacing } = useDesign();
  const insets = useSafeAreaInsets();
  const bottomInset = { paddingBottom: insets.bottom + spacing.stackGap };
  const isForm = variant === "form";
  const sideInsets = { paddingLeft: insets.left, paddingRight: insets.right };

  const content =
    variant === "list" ? (
      <View style={[styles.list, !actionBar && { paddingBottom: insets.bottom }]}>{children}</View>
    ) : (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, !actionBar && bottomInset]}
        keyboardShouldPersistTaps={isForm ? "handled" : "never"}
        keyboardDismissMode={isForm ? "on-drag" : "none"}
      >
        {children}
      </ScrollView>
    );

  return (
    <View style={[styles.root, sideInsets]}>
      <TopAppBar title={title} onBack={onBack} trailingAction={trailingAction} />
      <KeyboardAvoidingView
        style={styles.body}
        behavior="padding"
        enabled={isForm || Boolean(actionBar)}
      >
        {content}
        {actionBar ? (
          <View style={[styles.actionBar, bottomInset]}>
            <View style={styles.actionBarInner}>{actionBar}</View>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
