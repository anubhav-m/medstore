import { toInstant } from "./ist";

const MINUTE_MS = 60 * 1000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
/** Under this many minutes a bill countdown turns rust (DESIGN.md). */
const URGENT_MINUTES = 10;

function wholeMinutesBetween(from: Date | string | number, to: Date | string | number): number {
  return Math.floor((toInstant(to) - toInstant(from)) / MINUTE_MS);
}

/** How long an order has waited (admin): "Just now", "12 min", "1 h 5 min", "2 days". */
export function formatWaiting(
  since: Date | string | number,
  now: Date | number = Date.now(),
): string {
  const minutes = Math.max(0, wholeMinutesBetween(since, now));
  if (minutes < 1) return "Just now";
  if (minutes < MINUTES_PER_HOUR) return `${minutes} min`;
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const rest = minutes % MINUTES_PER_HOUR;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  return days === 1 ? "1 day" : `${days} days`;
}

export interface Countdown {
  text: string;
  /** The same for TalkBack, with whole words: "1 hour 5 minutes left". */
  spoken: string;
  /** Under 10 minutes left, or already over: shown in rust with the timer icon. */
  urgent: boolean;
  expired: boolean;
}

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

/** Time left on a bill: "1 h 5 min left", "25 min left", "Less than 1 min left", "Time's up". */
export function formatCountdown(
  until: Date | string | number,
  now: Date | number = Date.now(),
): Countdown {
  const remainingMs = toInstant(until) - toInstant(now);
  if (remainingMs <= 0) {
    return { text: "Time's up", spoken: "Time's up", urgent: true, expired: true };
  }
  const minutes = Math.floor(remainingMs / MINUTE_MS);
  const urgent = minutes < URGENT_MINUTES;
  if (minutes < 1) {
    return {
      text: "Less than 1 min left",
      spoken: "Less than 1 minute left",
      urgent,
      expired: false,
    };
  }
  if (minutes < MINUTES_PER_HOUR) {
    return {
      text: `${minutes} min left`,
      spoken: `${plural(minutes, "minute")} left`,
      urgent,
      expired: false,
    };
  }
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  const text = rest === 0 ? `${hours} h left` : `${hours} h ${rest} min left`;
  const spokenHours = plural(hours, "hour");
  const spoken =
    rest === 0 ? `${spokenHours} left` : `${spokenHours} ${plural(rest, "minute")} left`;
  return { text, spoken, urgent, expired: false };
}
