import { useEffect } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * Has TalkBack read a message when a view appears and whenever the message changes. Android live
 * regions only announce changes to views that already exist, so a newly shown banner, error state
 * or field error would otherwise be silent. No message, no announcement.
 */
export function useAnnounce(message: string | undefined): void {
  useEffect(() => {
    if (message) AccessibilityInfo.announceForAccessibility(message);
  }, [message]);
}
