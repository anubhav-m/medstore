import { CONSENT_VERSION, ErrorCodes } from "@medstore/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Address } from "../../../src/modules/addresses/address.model.js";
import { User } from "../../../src/modules/users/user.model.js";
import { expectError } from "../../helpers/admin.js";
import { ADDRESS, ONBOARDING, signedUpCustomer } from "../../helpers/customer.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const EMAIL = "asha@example.com";

let app;
let api;
beforeEach(async () => {
  app = createApp();
  api = await signedUpCustomer(app, EMAIL);
});
afterEach(() => {
  vi.restoreAllMocks();
});

const onboard = (body = ONBOARDING) => api.post("/me/onboarding").send(body);

describe("POST /me/onboarding", () => {
  it("saves the profile, consent and the first address as the default", async () => {
    const before = Date.now();
    const res = await onboard({ ...ONBOARDING, name: "  Asha Rao ", phone: "+91 98765-43210" });

    expect(res.status).toBe(200);
    const { user, address } = res.body.data;
    expect(user).toMatchObject({
      email: EMAIL,
      onboardingCompleted: true,
      name: "Asha Rao",
      phone: "+919876543210",
      consentVersion: CONSENT_VERSION,
    });
    expect(Date.parse(user.consentAcceptedAt)).toBeGreaterThanOrEqual(before);
    expect(address).toMatchObject({ ...ADDRESS, isDefault: true });

    const stored = await Address.findById(address.id).lean();
    expect(String(stored.userId)).toBe(user.id);
    expect(stored.location).toEqual({ type: "Point", coordinates: [72.87, 19.07] });
  });

  it("returns null for the optional address fields that weren't sent", async () => {
    const address = { ...ADDRESS };
    delete address.line2;
    delete address.landmark;
    const res = await onboard({ ...ONBOARDING, address });

    expect(res.status).toBe(200);
    expect(res.body.data.address).toMatchObject({ line2: null, landmark: null });
  });

  it("refuses a second call with ONBOARDING_ALREADY_COMPLETED", async () => {
    await onboard();
    const res = await onboard({ ...ONBOARDING, name: "Someone Else" });

    expectError(res, 409, ErrorCodes.ONBOARDING_ALREADY_COMPLETED);
    expect((await User.findOne({ email: EMAIL }).lean()).name).toBe("Asha Rao");
    expect(await Address.countDocuments()).toBe(1);
  });

  it("lets exactly one of two simultaneous calls succeed", async () => {
    const results = await Promise.all([onboard(), onboard()]);

    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await Address.countDocuments()).toBe(1);
  });

  it("is atomic: if the address insert fails, nothing is saved", async () => {
    vi.spyOn(Address, "create").mockRejectedValueOnce(new Error("insert failed"));

    expectError(await onboard(), 500, ErrorCodes.INTERNAL_SERVER_ERROR);
    const user = await User.findOne({ email: EMAIL }).lean();
    expect(user).toMatchObject({
      onboardingCompleted: false,
      name: null,
      phone: null,
      consentAcceptedAt: null,
      consentVersion: null,
    });
    expect(await Address.countDocuments()).toBe(0);

    expect((await onboard()).status).toBe(200);
  });

  it.each([
    ["consent false", { consentAccepted: false }],
    ["consent as a string", { consentAccepted: "true" }],
    ["a short name", { name: "A" }],
    ["an invalid phone", { phone: "12345" }],
    ["an address outside India", { address: { ...ADDRESS, lat: 51.5, lng: -0.12 } }],
    ["an address with lat and lng swapped", { address: { ...ADDRESS, lat: 72.87, lng: 19.07 } }],
    ["an address without line1", { address: { ...ADDRESS, line1: " " } }],
    ["an extra field", { isBlocked: false }],
    ["an extra address field", { address: { ...ADDRESS, userId: "x" } }],
    ["a date of birth", { dob: "1990-01-01" }],
  ])("rejects %s with VALIDATION_ERROR", async (_case, change) => {
    expectError(await onboard({ ...ONBOARDING, ...change }), 400, ErrorCodes.VALIDATION_ERROR);
    expect((await User.findOne({ email: EMAIL }).lean()).onboardingCompleted).toBe(false);
  });

  it("rejects a missing consent flag", async () => {
    const body = { ...ONBOARDING };
    delete body.consentAccepted;
    expectError(await onboard(body), 400, ErrorCodes.VALIDATION_ERROR);
  });
});
