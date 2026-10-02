import type { ReactNode, RefObject } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { createStyles } from "../../theme/createStyles";
import { useDesign } from "../../theme/DesignProvider";
import { Banner } from "../Banner";
import { Text } from "../Text";
import { DialogActions } from "./DialogActions";
import { useDialogPresence } from "./useDialogPresence";
import { useReturnFocus } from "./useReturnFocus";

interface ConfirmDialogProps {
  visible: boolean;
  /** destructive: the confirm button is the danger variant (Reject, Cancel order, Delete account). */
  variant?: "default" | "destructive";
  /** A question: "Reject this order?" */
  title: string;
  /** What happens next: "The customer gets a notification with the reason." */
  message: string;
  /** A verb: "Reject order". */
  confirmLabel: string;
  loadingLabel?: string;
  /** What staying means: "Keep order", "Go back". */
  dismissLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  /** While the request runs, the dialog can't be dismissed. */
  loading?: boolean;
  /** From getErrorMessage; the dialog stays open with its input intact. */
  error?: string;
  /** Disabled until a required reason (and note) is given. */
  confirmDisabled?: boolean;
  /** Extra content, e.g. a ReasonPicker for the with-reason variant. */
  children?: ReactNode;
  /** The button that opened the dialog: TalkBack focus returns to it when the dialog closes. */
  returnFocusTo?: RefObject<View | null>;
}

const useStyles = createStyles(({ colors, spacing, radii, elevation, sizes }) => ({
  overlay: { flex: 1, justifyContent: "center", padding: spacing.screenPadding },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  card: {
    width: "100%",
    maxWidth: sizes.dialogMaxWidth,
    maxHeight: "100%",
    alignSelf: "center",
    gap: spacing.stackGap,
    padding: spacing.dialogPadding,
    borderRadius: radii.dialog,
    backgroundColor: colors.surface,
    elevation: elevation.dialog,
  },
  // At the largest font size the body shrinks and scrolls; the error and actions stay in view.
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: spacing.stackGap },
}));

/** For decisions that must interrupt. Android Back and the scrim dismiss it unless it is loading. */
export function ConfirmDialog({
  visible,
  variant = "default",
  title,
  message,
  confirmLabel,
  loadingLabel,
  dismissLabel,
  onConfirm,
  onDismiss,
  loading = false,
  error,
  confirmDisabled = false,
  children,
  returnFocusTo,
}: ConfirmDialogProps) {
  const styles = useStyles();
  const { spacing } = useDesign();
  const insets = useSafeAreaInsets();
  const { rendered, scrimStyle, cardStyle } = useDialogPresence(visible);
  useReturnFocus(rendered, returnFocusTo);
  const dismiss = () => {
    if (!loading) onDismiss();
  };

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={dismiss}
    >
      <View
        style={[
          styles.overlay,
          {
            paddingTop: spacing.screenPadding + insets.top,
            paddingBottom: spacing.screenPadding + insets.bottom,
          },
        ]}
      >
        <Animated.View style={[styles.scrim, scrimStyle]}>
          {/* Touch only: TalkBack users have the dismiss button and Back, not a second copy of it. */}
          <Pressable
            style={styles.scrim}
            onPress={dismiss}
            accessible={false}
            importantForAccessibility="no"
          />
        </Animated.View>
        <Animated.View style={[styles.card, cardStyle]} accessibilityViewIsModal>
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text variant="title">{title}</Text>
            <Text color="secondary">{message}</Text>
            {children}
          </ScrollView>
          {/* Outside the scroll, so a long reason list never hides the error. */}
          {error ? <Banner variant="danger" title={error} /> : null}
          <DialogActions
            destructive={variant === "destructive"}
            confirmLabel={confirmLabel}
            loadingLabel={loadingLabel}
            dismissLabel={dismissLabel}
            onConfirm={onConfirm}
            onDismiss={dismiss}
            loading={loading}
            confirmDisabled={confirmDisabled}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}
