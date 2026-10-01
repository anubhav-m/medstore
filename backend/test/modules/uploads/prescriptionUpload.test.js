import { ErrorCodes, MAX_IMAGE_BYTES } from "@medstore/shared";
import mongoose from "mongoose";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Upload } from "../../../src/modules/uploads/upload.model.js";
import { User } from "../../../src/modules/users/user.model.js";
import { createSignedUploadUrl } from "../../../src/services/storage.js";
import { AppError } from "../../../src/utils/AppError.js";
import { expectError, signInAdmin } from "../../helpers/admin.js";
import { API, advanceTime } from "../../helpers/auth.js";
import { onboardedCustomer, signedUpCustomer } from "../../helpers/customer.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("../../../src/services/storage.js", () => ({ createSignedUploadUrl: vi.fn() }));

const NOW = new Date("2026-10-02T06:30:00Z"); // 12:00 IST; the IST day began at 18:30Z on the 1st
const HOUR_MS = 60 * 60 * 1000;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const JPEG = { contentType: "image/jpeg", sizeBytes: 250_000 };

const signedUrlFor = (path) =>
  `https://test-project.supabase.co/storage/v1/object/upload/sign/prescriptions/${path}?token=tok`;

let app;
let customer;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(createSignedUploadUrl).mockImplementation(async (path) => ({
    path,
    signedUrl: signedUrlFor(path),
    token: "tok",
  }));
  app = createApp();
  customer = await onboardedCustomer(app, "asha@example.com");
});
afterEach(() => {
  vi.useRealTimers();
});

const requestUrl = (body = JPEG, api = customer.api) =>
  api.post("/uploads/prescriptions").send(body);

// Written straight to the collection so createdAt can be set.
const seedUploads = (count, createdAt, userId = customer.user.id) =>
  Upload.collection.insertMany(
    Array.from({ length: count }, (_, index) => ({
      userId: new mongoose.Types.ObjectId(userId),
      path: `${userId}/seed-${createdAt.getTime()}-${index}.jpg`,
      contentType: "image/jpeg",
      sizeBytes: 1000,
      createdAt,
      updatedAt: createdAt,
    })),
  );

const uploadCount = () => Upload.countDocuments({ userId: customer.user.id });

describe("POST /uploads/prescriptions", () => {
  it("issues a signed upload URL for a server-built path and records it", async () => {
    const res = await requestUrl();

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Upload URL created");
    const { path } = res.body.data;
    expect(path).toMatch(new RegExp(`^${customer.user.id}/${UUID}\\.jpg$`));
    expect(res.body.data).toEqual({ path, signedUrl: signedUrlFor(path), token: "tok" });
    expect(createSignedUploadUrl).toHaveBeenCalledExactlyOnceWith(path);

    const stored = await Upload.findOne({ path }).lean();
    expect(stored).toMatchObject({ contentType: "image/jpeg", sizeBytes: 250_000 });
    expect(String(stored.userId)).toBe(customer.user.id);
  });

  it("gives PNG uploads a .png path", async () => {
    const res = await requestUrl({ contentType: "image/png", sizeBytes: 1000 });
    expect(res.body.data.path).toMatch(new RegExp(`^${customer.user.id}/${UUID}\\.png$`));
  });

  it("gives every request a new path under the caller's own user id", async () => {
    const other = await onboardedCustomer(app, "other@example.com");
    const first = (await requestUrl()).body.data.path;
    const second = (await requestUrl()).body.data.path;
    const others = (await requestUrl(JPEG, other.api)).body.data.path;

    expect(first).not.toBe(second);
    expect(first.startsWith(`${customer.user.id}/`)).toBe(true);
    expect(second.startsWith(`${customer.user.id}/`)).toBe(true);
    expect(others.startsWith(`${other.user.id}/`)).toBe(true);
  });

  it.each([1, MAX_IMAGE_BYTES])("accepts a size of %i bytes", async (sizeBytes) => {
    expect((await requestUrl({ ...JPEG, sizeBytes })).status).toBe(200);
  });

  it.each([
    ["a GIF", { ...JPEG, contentType: "image/gif" }],
    ["image/jpg (not a real MIME type)", { ...JPEG, contentType: "image/jpg" }],
    ["a text file", { ...JPEG, contentType: "text/plain" }],
    ["an upper-case type", { ...JPEG, contentType: "IMAGE/JPEG" }],
    ["a missing type", { sizeBytes: 1000 }],
    ["zero bytes", { ...JPEG, sizeBytes: 0 }],
    ["one byte over 5 MB", { ...JPEG, sizeBytes: MAX_IMAGE_BYTES + 1 }],
    ["a negative size", { ...JPEG, sizeBytes: -1 }],
    ["a fractional size", { ...JPEG, sizeBytes: 1.5 }],
    ["a size as a string", { ...JPEG, sizeBytes: "1000" }],
    ["a missing size", { contentType: "image/jpeg" }],
  ])("rejects %s with 400 VALIDATION_ERROR and issues nothing", async (_case, body) => {
    expectError(await requestUrl(body), 400, ErrorCodes.VALIDATION_ERROR);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
    expect(await uploadCount()).toBe(0);
  });

  it.each([
    ["path", "someone-else/x.jpg"],
    ["fileName", "prescription.jpg"],
    ["folder", "../other-user"],
    ["userId", "64b000000000000000000000"],
  ])("rejects a client-supplied %s", async (field, value) => {
    const res = await requestUrl({ ...JPEG, [field]: value });

    expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
    expect(res.body.errors).toEqual([{ field, message: "This field is not allowed" }]);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("returns 403 ACCOUNT_BLOCKED for a blocked customer and issues nothing", async () => {
    await User.updateOne({ _id: customer.user.id }, { $set: { isBlocked: true } });

    expectError(await requestUrl(), 403, ErrorCodes.ACCOUNT_BLOCKED);
    expect(createSignedUploadUrl).not.toHaveBeenCalled();
    expect(await uploadCount()).toBe(0);
  });

  it("returns 403 ONBOARDING_REQUIRED before onboarding", async () => {
    const api = await signedUpCustomer(app, "new@example.com");
    expectError(await requestUrl(JPEG, api), 403, ErrorCodes.ONBOARDING_REQUIRED);
  });

  it("requires a customer token: none or an admin's → 401 INVALID_TOKEN", async () => {
    const path = `${API}/uploads/prescriptions`;
    expectError(await request(app).post(path).send(JPEG), 401, ErrorCodes.INVALID_TOKEN);

    const { accessToken } = await signInAdmin(app);
    const res = await request(app)
      .post(path)
      .set("Authorization", `Bearer ${accessToken}`)
      .send(JPEG);
    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
  });

  it("returns 503 SERVICE_UNAVAILABLE when signing fails, without counting the attempt", async () => {
    vi.mocked(createSignedUploadUrl).mockRejectedValueOnce(
      new AppError("Uploads are unavailable", 503, ErrorCodes.SERVICE_UNAVAILABLE),
    );

    expectError(await requestUrl(), 503, ErrorCodes.SERVICE_UNAVAILABLE);
    expect(await uploadCount()).toBe(0);
  });
});

describe("upload URL limits", () => {
  it("allows 20 an hour, then returns 429 UPLOAD_LIMIT_REACHED", async () => {
    for (let index = 0; index < 20; index += 1) {
      expect((await requestUrl()).status).toBe(200);
    }
    const res = await requestUrl();

    expectError(res, 429, ErrorCodes.UPLOAD_LIMIT_REACHED);
    expect(res.body.message).toBe("You can upload up to 20 photos an hour");
    expect(createSignedUploadUrl).toHaveBeenCalledTimes(20);
    expect(await uploadCount()).toBe(20);
  });

  it("allows uploads again once the earlier ones are more than an hour old", async () => {
    await seedUploads(20, new Date(NOW.getTime() - HOUR_MS + 60_000));
    expectError(await requestUrl(), 429, ErrorCodes.UPLOAD_LIMIT_REACHED);

    advanceTime(60_001);
    expect((await requestUrl()).status).toBe(200);
  });

  it("allows 30 per IST day, counting from IST midnight (not UTC)", async () => {
    // 20:00Z on the 1st is 01:30 IST on the 2nd: the same IST day, but the previous UTC day.
    await seedUploads(30, new Date("2026-10-01T20:00:00Z"));
    const res = await requestUrl();

    expectError(res, 429, ErrorCodes.UPLOAD_LIMIT_REACHED);
    expect(res.body.message).toBe("You can upload up to 30 photos a day");
  });

  it("doesn't count uploads from before IST midnight", async () => {
    await seedUploads(30, new Date("2026-10-01T18:29:59Z")); // 23:59:59 IST on the 1st
    expect((await requestUrl()).status).toBe(200);
  });

  it("starts a new day at IST midnight", async () => {
    // Signed in shortly before midnight, so the access token is still valid after it.
    vi.setSystemTime(new Date("2026-10-02T18:25:00Z")); // 23:55 IST on the 2nd
    const night = await onboardedCustomer(app, "night@example.com");
    await seedUploads(30, new Date("2026-10-02T05:00:00Z"), night.user.id);
    expectError(await requestUrl(JPEG, night.api), 429, ErrorCodes.UPLOAD_LIMIT_REACHED);

    vi.setSystemTime(new Date("2026-10-02T18:30:00Z")); // 00:00 IST on the 3rd
    expect((await requestUrl(JPEG, night.api)).status).toBe(200);
  });

  it("counts each customer separately", async () => {
    await seedUploads(20, NOW);
    const other = await onboardedCustomer(app, "other@example.com");
    expect((await requestUrl(JPEG, other.api)).status).toBe(200);
  });

  it("lets only one of three simultaneous requests through at 19 in the last hour", async () => {
    await seedUploads(19, NOW);
    const results = await Promise.all([requestUrl(), requestUrl(), requestUrl()]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 429, 429]);
    expect(await uploadCount()).toBe(20);
  });
});
