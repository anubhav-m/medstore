import { OrderStatus } from "@medstore/shared";
import { describe, expect, it } from "vitest";
import { orderStatusDisplay, statusLook } from "../../src/ui/status/orderStatusDisplay";

describe("statusLook", () => {
  it("shows customers turmeric when they have to confirm the bill", () => {
    expect(statusLook(OrderStatus.AWAITING_CONFIRMATION, "customer")).toEqual({
      family: "haldi",
      label: "Confirm your bill",
    });
  });

  it("shows staff slate while they wait on the customer", () => {
    expect(statusLook(OrderStatus.AWAITING_CONFIRMATION, "admin")).toEqual({
      family: "slate",
      label: "Awaiting customer",
    });
  });

  it("never shows staff turmeric", () => {
    for (const status of Object.values(OrderStatus)) {
      expect(statusLook(status, "admin").family).not.toBe("haldi");
    }
  });

  it("falls back to neutral grey for a status this build doesn't know", () => {
    const unknown = "ON_HOLD" as OrderStatus;
    expect(statusLook(unknown, "customer")).toEqual({
      family: "grey",
      label: "Status not available",
    });
    expect(statusLook(unknown, "admin")).toEqual({ family: "grey", label: "Unknown status" });
  });

  it("gives turmeric to no customer status except the bill to confirm", () => {
    const haldi = Object.values(OrderStatus).filter(
      (status) => orderStatusDisplay[status].family === "haldi",
    );
    expect(haldi).toEqual([OrderStatus.AWAITING_CONFIRMATION]);
  });
});
