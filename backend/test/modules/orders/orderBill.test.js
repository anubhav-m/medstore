import { describe, expect, it } from "vitest";
import { billExpiresAt, computeBill } from "../../../src/modules/orders/orderBill.js";

// 10:00–22:00 IST; the timeout is 60 minutes (vitest.config.js).
const store = { openingMinutes: 600, closingMinutes: 1320 };
const ist = (time) => new Date(`2026-10-02T${time}+05:30`);

describe("computeBill", () => {
  it("computes line totals, subtotal and total in paise", () => {
    const bill = computeBill({
      items: [
        { name: "Paracetamol 500", quantity: 3, unitPricePaise: 3333 },
        { name: "ORS Sachet", quantity: 1, unitPricePaise: 2000 },
      ],
      deliveryFeePaise: 2500,
      discountPaise: 999,
    });

    expect(bill).toEqual({
      items: [
        {
          name: "Paracetamol 500",
          nameKey: "paracetamol 500",
          quantity: 3,
          unitPricePaise: 3333,
          lineTotalPaise: 9999,
        },
        {
          name: "ORS Sachet",
          nameKey: "ors sachet",
          quantity: 1,
          unitPricePaise: 2000,
          lineTotalPaise: 2000,
        },
      ],
      subtotalPaise: 11999,
      deliveryFeePaise: 2500,
      discountPaise: 999,
      totalPaise: 13500,
    });
  });

  it("stays exact at the largest allowed bill", () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      name: `Item ${index}`,
      quantity: 999,
      unitPricePaise: 10_000_000,
    }));
    const bill = computeBill({ items, deliveryFeePaise: 100_000, discountPaise: 0 });
    expect(bill.totalPaise).toBe(499_500_100_000);
    expect(Number.isSafeInteger(bill.totalPaise)).toBe(true);
  });
});

describe("billExpiresAt", () => {
  it.each([
    ["well before closing", "12:00:00", "13:00:00"],
    ["exactly 60 minutes before closing", "21:00:00", "22:00:00"],
    ["less than 60 minutes before closing (capped)", "21:30:00", "22:00:00"],
    ["one minute before closing (capped)", "21:59:00", "22:00:00"],
    ["at closing (not capped)", "22:00:00", "23:00:00"],
    ["after closing (not capped)", "22:30:00", "23:30:00"],
    ["before opening", "08:00:00", "09:00:00"],
  ])("sent %s", (_case, sent, expires) => {
    expect(billExpiresAt(store, ist(sent))).toEqual(ist(expires));
  });
});
