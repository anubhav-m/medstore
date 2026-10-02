import { describe, expect, it } from "vitest";
import { inputVariants, normalisePhoneDigits } from "../../src/ui/input/inputVariants";

describe("normalisePhoneDigits", () => {
  it.each([
    ["9876543210", "9876543210"],
    ["98765 43210", "9876543210"],
    ["98765-43210", "9876543210"],
    ["+91 98765 43210", "9876543210"],
    ["+919876543210", "9876543210"],
    ["09876543210", "9876543210"],
    ["98765432109", "9876543210"],
    ["987", "987"],
  ])("%s → %s", (typed, digits) => {
    expect(normalisePhoneDigits(typed)).toBe(digits);
  });
});

describe("input sanitisers", () => {
  const rupees = inputVariants.money.sanitise;
  const code = inputVariants.code.sanitise;

  it.each([
    ["45", "45"],
    ["45.5", "45.5"],
    ["45.509", "45.50"],
    ["4.5.6", "4.56"],
    ["₹1,250", "1250"],
  ])("money keeps %s as %s", (typed, kept) => {
    expect(rupees?.(typed)).toBe(kept);
  });

  it("keeps at most six code digits", () => {
    expect(code?.("12a3 4567")).toBe("123456");
  });
});
