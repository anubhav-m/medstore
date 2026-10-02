import { CASH_COLLECTED_MAX_PAISE } from "@medstore/shared";
import { describe, expect, it } from "vitest";
import { amountText } from "../../src/ui/internal/amountText";

describe("amountText", () => {
  it("formats ₹0 and the largest possible bill", () => {
    expect(amountText(0)).toEqual({ text: "₹0.00", spoken: "0 rupees" });
    expect(amountText(CASH_COLLECTED_MAX_PAISE)).toEqual({
      text: "₹4,99,50,01,000.00",
      spoken: "499 crore 50 lakh 1 thousand rupees",
    });
  });

  it.each([Number.NaN, 12.5, Number.POSITIVE_INFINITY, undefined as unknown as number])(
    "shows a dash instead of crashing for %s",
    (value) => {
      expect(amountText(value)).toEqual({ text: "—", spoken: "Amount not available" });
    },
  );
});
