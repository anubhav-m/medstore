import { ErrorCodes, MAX_ITEM_SUGGESTIONS, OrderStatus } from "@medstore/shared";
import mongoose from "mongoose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { expectError } from "../../helpers/admin.js";
import { onboardedCustomer } from "../../helpers/customer.js";
import { NOW, ensureOrderIndexes, mockStorageOk, seedOrder } from "../../helpers/order.js";
import { createTestStore, signInOwner } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
}));

const MINUTE_MS = 60_000;

let app;
let customer;
let store;
let owner;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
  owner = await signInOwner(app);
});
afterEach(() => {
  vi.useRealTimers();
});

const item = (name) => ({
  name,
  nameKey: name.toLowerCase(),
  quantity: 1,
  unitPricePaise: 100,
  lineTotalPaise: 100,
});

// A billed order at `atStore` holding `names`, created `minutes` after NOW.
const billed = async (names, { atStore = store, minutes = 0 } = {}) => {
  vi.setSystemTime(NOW.getTime() + minutes * MINUTE_MS);
  await seedOrder({
    userId: customer.user.id,
    storeId: atStore.id,
    status: OrderStatus.CONFIRMED,
    items: names.map(item),
  });
  vi.setSystemTime(NOW);
};

const suggest = (q, storeId = store.id) =>
  owner.get(`/item-suggestions?storeId=${storeId}&q=${encodeURIComponent(q)}`);

describe("GET /admin/item-suggestions", () => {
  it("returns distinct names billed at the store, by case-insensitive prefix, sorted", async () => {
    await billed(["Paracetamol 650", "Pantoprazole 40", "Cetirizine"]);
    await billed(["paracetamol 650", "Paracetamol 500"], { minutes: 1 });
    const other = await createTestStore({ code: "ST02", name: "Second Store" });
    await billed(["Paracetamol Syrup"], { atStore: other });

    const res = await suggest("PARA");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Suggestions loaded");
    // The most recent spelling of each name is shown.
    expect(res.body.data.suggestions).toEqual(["Paracetamol 500", "paracetamol 650"]);
  });

  it("matches a single character", async () => {
    await billed(["Cetirizine", "Paracetamol 500"]);
    expect((await suggest("c")).body.data.suggestions).toEqual(["Cetirizine"]);
  });

  it(`returns at most ${MAX_ITEM_SUGGESTIONS}`, async () => {
    await billed(
      Array.from({ length: 15 }, (_, index) => `Vitamin ${String(index).padStart(2, "0")}`),
    );
    const res = await suggest("vit");
    expect(res.body.data.suggestions).toHaveLength(MAX_ITEM_SUGGESTIONS);
    expect(res.body.data.suggestions[0]).toBe("Vitamin 00");
  });

  it("returns nothing when no name matches", async () => {
    await billed(["Cetirizine"]);
    expect((await suggest("xyz")).body.data.suggestions).toEqual([]);
  });

  it.each([".*", "(a+)+$", "[", "c.t"])("treats %s as literal text", async (q) => {
    await billed(["Cetirizine", "C.T. Scan Kit"]);
    const res = await suggest(q);
    expect(res.status).toBe(200);
    expect(res.body.data.suggestions).toEqual(q === "c.t" ? ["C.T. Scan Kit"] : []);
  });

  it.each([
    ["no q", `storeId=${new mongoose.Types.ObjectId()}`],
    ["an empty q", `storeId=${new mongoose.Types.ObjectId()}&q=`],
    ["a 51-character q", `storeId=${new mongoose.Types.ObjectId()}&q=${"a".repeat(51)}`],
    ["no storeId", "q=para"],
    ["a malformed storeId", "storeId=nope&q=para"],
  ])("rejects %s with 400 VALIDATION_ERROR", async (_case, query) => {
    expectError(await owner.get(`/item-suggestions?${query}`), 400, ErrorCodes.VALIDATION_ERROR);
  });

  it("returns 404 STORE_NOT_FOUND for a store that doesn't exist", async () => {
    expectError(
      await suggest("para", new mongoose.Types.ObjectId()),
      404,
      ErrorCodes.STORE_NOT_FOUND,
    );
  });
});
