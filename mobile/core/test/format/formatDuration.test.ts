import { describe, expect, it } from "vitest";
import { formatCountdown, formatWaiting } from "../../src/format/formatDuration";

const now = new Date("2026-09-28T12:00:00+05:30").getTime();
const minutes = (count: number) => count * 60 * 1000;

describe("formatWaiting", () => {
  it.each([
    [0, "Just now"],
    [minutes(0.9), "Just now"],
    [minutes(12), "12 min"],
    [minutes(60), "1 h"],
    [minutes(65), "1 h 5 min"],
    [minutes(24 * 60), "1 day"],
    [minutes(3 * 24 * 60 + 5), "3 days"],
  ])("%i ms ago → %s", (ago, expected) => {
    expect(formatWaiting(now - ago, now)).toBe(expected);
  });

  it("treats a time in the future as just now", () => {
    expect(formatWaiting(now + minutes(2), now)).toBe("Just now");
  });
});

describe("formatCountdown", () => {
  it.each([
    [minutes(65), "1 h 5 min left", "1 hour 5 minutes left", false],
    [minutes(121), "2 h 1 min left", "2 hours 1 minute left", false],
    [minutes(60), "1 h left", "1 hour left", false],
    [minutes(25), "25 min left", "25 minutes left", false],
    [minutes(10), "10 min left", "10 minutes left", false],
    [minutes(9.5), "9 min left", "9 minutes left", true],
    [minutes(1), "1 min left", "1 minute left", true],
    [minutes(0.5), "Less than 1 min left", "Less than 1 minute left", true],
  ])("%i ms left → %s", (left, text, spoken, urgent) => {
    expect(formatCountdown(now + left, now)).toEqual({ text, spoken, urgent, expired: false });
  });

  it("says time's up at and after the expiry", () => {
    expect(formatCountdown(now, now)).toEqual({
      text: "Time's up",
      spoken: "Time's up",
      urgent: true,
      expired: true,
    });
    expect(formatCountdown(now - minutes(5), now).expired).toBe(true);
  });
});
