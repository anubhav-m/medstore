import { describe, expect, it } from "vitest";
import { formatDateTime } from "../../src/format/formatDateTime";

// 2026-09-28 is a Monday. IST = UTC + 5:30.
const now = new Date("2026-09-28T12:00:00+05:30");

describe("formatDateTime", () => {
  it.each([
    ["2026-09-28T16:30:00+05:30", "4:30 PM"],
    ["2026-09-28T00:05:00+05:30", "12:05 AM"],
    ["2026-09-28T12:00:00+05:30", "12:00 PM"],
    ["2026-09-28T09:07:59+05:30", "9:07 AM"],
  ])("time: %s → %s", (value, expected) => {
    expect(formatDateTime(value, "time", now)).toBe(expected);
  });

  it("uses IST whatever the input's offset", () => {
    expect(formatDateTime("2026-09-28T11:00:00Z", "time", now)).toBe("4:30 PM");
  });

  it.each([
    ["2026-09-28T16:30:00+05:30", "Today, 4:30 PM"],
    ["2026-09-27T09:05:00+05:30", "Yesterday, 9:05 AM"],
    ["2026-09-21T16:30:00+05:30", "Mon 21 Sep, 4:30 PM"],
    ["2025-09-28T16:30:00+05:30", "28 Sep 2025, 4:30 PM"],
  ])("dateTime: %s → %s", (value, expected) => {
    expect(formatDateTime(value, "dateTime", now)).toBe(expected);
  });

  it("decides Today by the IST calendar day, not UTC", () => {
    // 00:15 IST on the 28th is still the 27th in UTC.
    expect(formatDateTime("2026-09-27T18:45:00Z", "dateTime", now)).toBe("Today, 12:15 AM");
    // 23:50 IST on the 27th.
    expect(formatDateTime("2026-09-27T18:20:00Z", "dateTime", now)).toBe("Yesterday, 11:50 PM");
  });

  it.each([
    ["2026-09-28T10:00:00+05:30", "Mon 28 Sep"],
    ["2025-12-31T23:59:00+05:30", "31 Dec 2025"],
  ])("date: %s → %s", (value, expected) => {
    expect(formatDateTime(value, "date", now)).toBe(expected);
  });

  it("refuses an invalid date", () => {
    expect(() => formatDateTime("not a date", "time", now)).toThrow(RangeError);
  });
});
