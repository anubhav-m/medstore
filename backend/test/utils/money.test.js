import { describe, expect, it } from "vitest";
import { formatRupees } from "../../src/utils/money.js";

describe("formatRupees", () => {
  it.each([
    [0, "₹0"],
    [5, "₹0.05"],
    [10500, "₹105"],
    [123450, "₹1,234.50"],
    [12345678901, "₹12,34,56,789.01"],
  ])("formats %i paise as %s", (paise, text) => {
    expect(formatRupees(paise)).toBe(text);
  });
});
