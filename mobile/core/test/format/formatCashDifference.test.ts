import { describe, expect, it } from "vitest";
import { formatCashDifference } from "../../src/format/formatCashDifference";

describe("formatCashDifference", () => {
  it("says Matches when collected equals expected", () => {
    expect(formatCashDifference(0)).toEqual({ text: "Matches", spoken: "Matches", kind: "match" });
  });

  it("shows extra cash with a plus sign", () => {
    expect(formatCashDifference(5000)).toEqual({
      text: "+₹50.00 extra",
      spoken: "50 rupees extra",
      kind: "extra",
    });
  });

  it("shows a shortfall with a real minus sign", () => {
    expect(formatCashDifference(-12345650)).toEqual({
      text: "−₹1,23,456.50 short",
      spoken: "1 lakh 23 thousand 456 rupees 50 paise short",
      kind: "short",
    });
  });
});
