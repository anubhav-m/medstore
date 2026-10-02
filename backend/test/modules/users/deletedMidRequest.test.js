import { ErrorCodes } from "@medstore/shared";
import mongoose from "mongoose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Address } from "../../../src/modules/addresses/address.model.js";
import { createAddress } from "../../../src/modules/addresses/address.service.js";
import { Order } from "../../../src/modules/orders/order.model.js";
import { createOrder } from "../../../src/modules/orders/orderPlacement.service.js";
import { Upload } from "../../../src/modules/uploads/upload.model.js";
import { createPrescriptionUploadUrl } from "../../../src/modules/uploads/upload.service.js";
import { verifyImageObject } from "../../../src/services/storage.js";
import { expectError } from "../../helpers/admin.js";
import { PASSWORD } from "../../helpers/auth.js";
import { ADDRESS, onboardedCustomer } from "../../helpers/customer.js";
import {
  NOW,
  ensureOrderIndexes,
  issueUpload,
  mockStorageOk,
  placeOrder,
} from "../../helpers/order.js";
import { createTestStore } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({
  verifyImageObject: vi.fn(),
  createSignedViewUrls: vi.fn(),
  createSignedUploadUrl: vi.fn(),
}));

// An account deleted after a request was authenticated must get INVALID_TOKEN, and nothing may
// be written for it.

let app;
beforeAll(ensureOrderIndexes);
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mockStorageOk();
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
});

const expectInvalidToken = (promise) =>
  expect(promise).rejects.toMatchObject({ statusCode: 401, code: ErrorCodes.INVALID_TOKEN });

describe("an account deleted mid-request", () => {
  it("gets no order when it is deleted while the order's photos are checked", async () => {
    const { api, user, address } = await onboardedCustomer(app, "asha@example.com");
    const store = await createTestStore();
    const path = await issueUpload(user.id);
    vi.mocked(verifyImageObject).mockImplementationOnce(async () => {
      await api.delete("/me").send({ password: PASSWORD }).expect(200);
      return true;
    });

    const res = await placeOrder(api, {
      storeId: store.id,
      addressId: address.id,
      imagePaths: [path],
    });

    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
    expect(await Order.countDocuments({ userId: user.id })).toBe(0);
  });

  it("gets INVALID_TOKEN when ordering after it is gone", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    await expectInvalidToken(
      createOrder(userId, crypto.randomUUID(), {
        storeId: new mongoose.Types.ObjectId().toString(),
        addressId: new mongoose.Types.ObjectId().toString(),
        imagePaths: [],
      }),
    );
  });

  it("gets no upload URL", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    await expectInvalidToken(
      createPrescriptionUploadUrl(userId, { contentType: "image/jpeg", sizeBytes: 1000 }),
    );
    expect(await Upload.countDocuments({ userId })).toBe(0);
  });

  it("gets no address", async () => {
    const userId = new mongoose.Types.ObjectId().toString();

    await expectInvalidToken(createAddress(userId, ADDRESS));
    expect(await Address.countDocuments({ userId })).toBe(0);
  });
});
