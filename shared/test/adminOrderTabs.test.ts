import { describe, expect, it } from "vitest";
import { ADMIN_ORDER_TABS, AdminOrderTab, OrderStatus } from "../src/index.js";

describe("ADMIN_ORDER_TABS", () => {
  it("puts every status in exactly one tab", () => {
    const listed = ADMIN_ORDER_TABS.flatMap((tab) => tab.statuses);
    expect([...listed].sort()).toEqual(Object.values(OrderStatus).sort());
  });

  it("defines every tab once", () => {
    expect(ADMIN_ORDER_TABS.map((tab) => tab.tab)).toEqual(Object.values(AdminOrderTab));
  });
});
