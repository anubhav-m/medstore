import { describe, expect, it } from "vitest";
import { isStoreOpen, nextOpensAt } from "../../../src/modules/stores/storeHours.js";

// 10:00–22:00 IST is 04:30–16:30 UTC.
const STORE = {
  isActive: true,
  isAcceptingOrders: true,
  openingMinutes: 600,
  closingMinutes: 1320,
};

const at = (iso) => new Date(iso);

describe("isStoreOpen", () => {
  it.each([
    ["2026-10-02T04:29:59Z", false],
    ["2026-10-02T04:30:00Z", true],
    ["2026-10-02T16:29:59Z", true],
    ["2026-10-02T16:30:00Z", false],
  ])("a 10:00–22:00 store at %s UTC is open: %s", (iso, open) => {
    expect(isStoreOpen(STORE, at(iso))).toBe(open);
  });

  it("is closed within hours when paused or inactive", () => {
    const now = at("2026-10-02T08:00:00Z");
    expect(isStoreOpen({ ...STORE, isAcceptingOrders: false }, now)).toBe(false);
    expect(isStoreOpen({ ...STORE, isActive: false }, now)).toBe(false);
  });

  it("keeps a store closing at midnight (1440) open until 23:59:59 IST", () => {
    const store = { ...STORE, closingMinutes: 1440 };
    expect(isStoreOpen(store, at("2026-10-02T18:29:59Z"))).toBe(true);
    expect(isStoreOpen(store, at("2026-10-02T18:30:00Z"))).toBe(false);
  });

  it("opens a store opening at 0 at IST midnight", () => {
    const store = { ...STORE, openingMinutes: 0 };
    expect(isStoreOpen(store, at("2026-10-02T18:29:59Z"))).toBe(false);
    expect(isStoreOpen(store, at("2026-10-02T18:30:00Z"))).toBe(true);
  });
});

describe("nextOpensAt", () => {
  it.each([
    ["before opening: today", "2026-10-02T03:00:00Z", "2026-10-02T04:30:00.000Z"],
    ["one second before opening", "2026-10-02T04:29:59Z", "2026-10-02T04:30:00.000Z"],
    ["at closing: tomorrow", "2026-10-02T16:30:00Z", "2026-10-03T04:30:00.000Z"],
    ["at 23:59:59 IST: tomorrow", "2026-10-02T18:29:59Z", "2026-10-03T04:30:00.000Z"],
    // 18:45 UTC on the 2nd is 00:15 IST on the 3rd, so the store opens later that same IST day.
    ["after the IST date change", "2026-10-02T18:45:00Z", "2026-10-03T04:30:00.000Z"],
  ])("%s", (_case, iso, expected) => {
    expect(nextOpensAt(STORE, at(iso)).toISOString()).toBe(expected);
  });

  it("is null while open", () => {
    expect(nextOpensAt(STORE, at("2026-10-02T04:30:00Z"))).toBeNull();
    expect(nextOpensAt(STORE, at("2026-10-02T16:29:59Z"))).toBeNull();
  });

  it("is null when paused or inactive, even outside hours", () => {
    const now = at("2026-10-02T03:00:00Z");
    expect(nextOpensAt({ ...STORE, isAcceptingOrders: false }, now)).toBeNull();
    expect(nextOpensAt({ ...STORE, isActive: false }, now)).toBeNull();
  });
});
