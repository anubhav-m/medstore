import { ErrorCodes } from "@medstore/shared";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { deleteUnusedUploads } from "../../src/jobs/deleteUnusedUploads.js";
import { Order } from "../../src/modules/orders/order.model.js";
import { Upload } from "../../src/modules/uploads/upload.model.js";
import { removeObjects, verifyImageObject } from "../../src/services/storage.js";
import { AppError } from "../../src/utils/AppError.js";
import { expectError } from "../helpers/admin.js";
import { onboardedCustomer } from "../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  issueUpload,
  mockStorageOk,
  placeOrder,
  seedOrder,
} from "../helpers/order.js";
import { createTestStore } from "../helpers/store.js";

vi.mock("../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
  removeObjects: vi.fn(),
}));

const HOUR_MS = 60 * 60 * 1000;
const hoursLater = (hours) => new Date(NOW.getTime() + hours * HOUR_MS);
const storageDown = () =>
  new AppError("Prescription photos are unavailable", 503, ErrorCodes.SERVICE_UNAVAILABLE);

let app;
let customer;
let store;
beforeAll(ensureOrderIndexes);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
  store = await createTestStore();
});
afterEach(() => {
  vi.useRealTimers();
});

const order = (imagePaths) =>
  placeOrder(customer.api, { storeId: store.id, addressId: customer.address.id, imagePaths });
const recordOf = (path) => Upload.findOne({ path }).lean();

describe("deleteUnusedUploads", () => {
  it("deletes uploads unattached for more than 24 hours, objects and records", async () => {
    const unused = await issueUpload(customer.user.id);
    const attached = await issueUpload(customer.user.id);
    await order([attached]).expect(200);
    vi.setSystemTime(hoursLater(2));
    const recent = await issueUpload(customer.user.id);

    expect(await deleteUnusedUploads(hoursLater(25))).toEqual({ deleted: 1 });

    expect(removeObjects).toHaveBeenCalledExactlyOnceWith([unused]);
    expect(await recordOf(unused)).toBeNull();
    expect(await recordOf(attached)).not.toBeNull();
    expect(await recordOf(recent)).not.toBeNull();
  });

  it("keeps an upload exactly 24 hours old until it is older", async () => {
    await issueUpload(customer.user.id);
    expect(await deleteUnusedUploads(hoursLater(23))).toEqual({ deleted: 0 });
    expect(removeObjects).not.toHaveBeenCalled();
  });

  it("never deletes an image an order references, and marks its record attached", async () => {
    const path = await issueUpload(customer.user.id);
    await seedOrder({ userId: customer.user.id, storeId: store.id, images: [{ path }] });

    expect(await deleteUnusedUploads(hoursLater(25))).toEqual({ deleted: 0 });

    expect(removeObjects).not.toHaveBeenCalled();
    expect((await recordOf(path)).attachedAt).toEqual(hoursLater(25));
  });

  it("puts the records back when storage fails, so the next run retries", async () => {
    const path = await issueUpload(customer.user.id);
    const before = await recordOf(path);
    vi.mocked(removeObjects).mockRejectedValueOnce(storageDown());

    await expect(deleteUnusedUploads(hoursLater(25))).rejects.toMatchObject({
      code: ErrorCodes.SERVICE_UNAVAILABLE,
    });
    expect(await recordOf(path)).toEqual(before);

    expect(await deleteUnusedUploads(hoursLater(26))).toEqual({ deleted: 1 });
    expect(await recordOf(path)).toBeNull();
  });

  it("makes an order placed while its photo is deleted fail with INVALID_UPLOAD, creating nothing", async () => {
    const path = await issueUpload(customer.user.id);
    vi.mocked(verifyImageObject).mockImplementationOnce(async () => {
      expect(await deleteUnusedUploads(hoursLater(25))).toEqual({ deleted: 1 });
      return true;
    });

    expectError(await order([path]), 422, ErrorCodes.INVALID_UPLOAD);
    expect(await Order.countDocuments()).toBe(0);
  });
});
