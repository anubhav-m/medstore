import { describe, expect, it } from "vitest";
import { istDayStart, istMinutesOfDay } from "../../src/utils/time.js";

const at = (iso) => new Date(iso);

describe("IST helpers", () => {
  it("istDayStart is IST midnight, which is 18:30 UTC the day before", () => {
    expect(istDayStart(at("2026-10-02T18:29:59.999Z")).toISOString()).toBe(
      "2026-10-01T18:30:00.000Z",
    );
    expect(istDayStart(at("2026-10-02T18:30:00.000Z")).toISOString()).toBe(
      "2026-10-02T18:30:00.000Z",
    );
  });

  it.each([
    ["2026-10-02T18:29:59Z", 1439],
    ["2026-10-02T18:30:00Z", 0],
    ["2026-10-02T04:29:59Z", 599],
    ["2026-10-02T04:30:00Z", 600],
  ])("istMinutesOfDay(%s) is %i whole minutes after IST midnight", (iso, minutes) => {
    expect(istMinutesOfDay(at(iso))).toBe(minutes);
  });
});
