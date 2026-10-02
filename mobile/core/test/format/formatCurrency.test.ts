import { describe, expect, it } from "vitest";
import { formatCurrency, formatCurrencySpoken } from "../../src/format/formatCurrency";

describe("formatCurrency", () => {
  it.each([
    [0, "₹0.00"],
    [5, "₹0.05"],
    [100, "₹1.00"],
    [45050, "₹450.50"],
    [99999, "₹999.99"],
    [100000, "₹1,000.00"],
    [12345650, "₹1,23,456.50"],
    [1234567800, "₹1,23,45,678.00"],
    [499500100000, "₹4,99,50,01,000.00"],
  ])("formats %i paise as %s", (paise, expected) => {
    expect(formatCurrency(paise)).toBe(expected);
  });

  it("puts a real minus sign before the rupee sign", () => {
    expect(formatCurrency(-2000)).toBe("−₹20.00");
  });

  it.each([1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53])("refuses %s", (value) => {
    expect(() => formatCurrency(value)).toThrow(RangeError);
  });
});

describe("formatCurrencySpoken", () => {
  it.each([
    [0, "0 rupees"],
    [100, "1 rupee"],
    [125000, "1 thousand 250 rupees"],
    [12345650, "1 lakh 23 thousand 456 rupees 50 paise"],
    [10000000, "1 lakh rupees"],
    [1234567800, "1 crore 23 lakh 45 thousand 678 rupees"],
    [499500100000, "499 crore 50 lakh 1 thousand rupees"],
    [5, "0 rupees 5 paise"],
    [-2000, "minus 20 rupees"],
  ])("reads %i paise as %s", (paise, expected) => {
    expect(formatCurrencySpoken(paise)).toBe(expected);
  });
});
