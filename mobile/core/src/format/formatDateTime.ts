import { istParts, type IstParts } from "./ist";

export type DateTimeStyle = "time" | "dateTime" | "date";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatTime({ hour, minute }: IstParts): string {
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

function formatDate(parts: IstParts, now: IstParts): string {
  const dayMonth = `${parts.day} ${MONTHS[parts.month]}`;
  return parts.year === now.year
    ? `${WEEKDAYS[parts.weekday]} ${dayMonth}`
    : `${dayMonth} ${parts.year}`;
}

function relativeDay(parts: IstParts, now: IstParts): string {
  if (parts.dayNumber === now.dayNumber) return "Today";
  if (parts.dayNumber === now.dayNumber - 1) return "Yesterday";
  return formatDate(parts, now);
}

/**
 * Formats an instant in IST, whatever the phone's time zone. 12-hour clock, never seconds.
 * - time: "4:30 PM"
 * - dateTime: "Today, 4:30 PM", "Yesterday, 9:05 AM", "Mon 28 Sep, 4:30 PM", "28 Sep 2025, 4:30 PM"
 * - date: "Mon 28 Sep", "28 Sep 2025"
 * `now` decides Today/Yesterday and whether the year is shown.
 */
export function formatDateTime(
  value: Date | string | number,
  style: DateTimeStyle,
  now: Date | number = Date.now(),
): string {
  const parts = istParts(value);
  const today = istParts(now);
  switch (style) {
    case "time":
      return formatTime(parts);
    case "date":
      return formatDate(parts, today);
    case "dateTime":
      return `${relativeDay(parts, today)}, ${formatTime(parts)}`;
  }
}
