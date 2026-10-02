import { useEffect, useState } from "react";
import { AppState } from "react-native";

const MINUTE_MS = 60 * 1000;

/**
 * The current time, refreshed once a minute (countdowns never tick by the second) and as soon as
 * the app comes back to the foreground, so a phone left in a pocket never shows a stale "25 min
 * left" for a bill that has since expired.
 */
export function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return now;
}
