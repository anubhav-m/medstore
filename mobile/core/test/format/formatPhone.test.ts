import { describe, expect, it } from "vitest";
import { formatPhone, formatPhoneInput } from "../../src/format/formatPhone";
import { splitOrderNumber, spokenOrderNumber } from "../../src/format/orderNumber";

describe("formatPhone", () => {
  it("groups a stored number five and five", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("returns anything unexpected unchanged", () => {
    expect(formatPhone("9876543210")).toBe("9876543210");
  });
});

describe("formatPhoneInput", () => {
  it.each([
    ["", ""],
    ["98765", "98765"],
    ["987654", "98765 4"],
    ["9876543210", "98765 43210"],
  ])("%s → %s", (digits, expected) => {
    expect(formatPhoneInput(digits)).toBe(expected);
  });
});

describe("order numbers", () => {
  it("splits the store code from the sequence, keeping leading zeros", () => {
    expect(splitOrderNumber("ST01-000042")).toEqual({ storeCode: "ST01", sequence: "000042" });
    expect(splitOrderNumber("bad")).toBeNull();
  });

  it("spells the number out for TalkBack", () => {
    expect(spokenOrderNumber("ST01-000042")).toBe("Order S T 0 1, 0 0 0 0 4 2");
  });
});
