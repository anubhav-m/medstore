import { ErrorCodes } from "@medstore/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { User } from "../../../src/modules/users/user.model.js";
import { expectError } from "../../helpers/admin.js";
import { signedUpCustomer } from "../../helpers/customer.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const EMAIL = "asha@example.com";

let app;
let api;
beforeEach(async () => {
  app = createApp();
  api = await signedUpCustomer(app, EMAIL);
});
afterEach(() => {
  vi.useRealTimers();
});

const patchMe = (body) => api.patch("/me").send(body);

const expectValidationError = (res, field) => {
  expectError(res, 400, ErrorCodes.VALIDATION_ERROR);
  if (field) expect(res.body.errors.map((error) => error.field)).toContain(field);
};

describe("PATCH /me", () => {
  it("updates name, phone, date of birth and gender, before onboarding too", async () => {
    const res = await patchMe({
      name: "  Asha Rao  ",
      phone: "9876543210",
      dob: "1990-05-17",
      gender: "FEMALE",
    });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "Profile updated" });
    expect(res.body.data.user).toMatchObject({
      name: "Asha Rao",
      phone: "+919876543210",
      dob: "1990-05-17",
      gender: "FEMALE",
      onboardingCompleted: false,
    });
    const stored = await User.findOne({ email: EMAIL }).lean();
    expect(stored.dob.toISOString()).toBe("1990-05-17T00:00:00.000Z");
  });

  it("changes only the fields sent", async () => {
    await patchMe({ name: "Asha Rao", gender: "FEMALE" });
    const res = await patchMe({ phone: "9123456789" });

    expect(res.body.data.user).toMatchObject({
      name: "Asha Rao",
      gender: "FEMALE",
      phone: "+919123456789",
    });
  });

  it("clears date of birth and gender with null", async () => {
    await patchMe({ dob: "1990-05-17", gender: "OTHER" });
    const res = await patchMe({ dob: null, gender: null });

    expect(res.status).toBe(200);
    expect(res.body.data.user).toMatchObject({ dob: null, gender: null });
  });

  it.each([
    "9876543210",
    "+919876543210",
    "09876543210",
    "98765 43210",
    "+91 98765 43210",
    "+91-98765-43210",
    "098765-43210",
    " 9876543210 ",
  ])("normalises the phone %j to +919876543210", async (phone) => {
    const res = await patchMe({ phone });
    expect(res.status).toBe(200);
    expect(res.body.data.user.phone).toBe("+919876543210");
  });

  it.each([
    "5876543210",
    "987654321",
    "98765432101",
    "919876543210",
    "+929876543210",
    "+91 5876543210",
    "00987654321",
    "98765abcde",
    "+91(98765)43210",
    "",
    "9".repeat(25),
  ])("rejects the phone %j", async (phone) => {
    expectValidationError(await patchMe({ phone }), "phone");
  });

  it("rejects a non-string phone", async () => {
    expectValidationError(await patchMe({ phone: 9876543210 }), "phone");
  });

  it.each([
    ["one character", "A"],
    ["blank after trimming", "   "],
    ["81 characters", "A".repeat(81)],
  ])("rejects a name of %s", async (_case, name) => {
    expectValidationError(await patchMe({ name }), "name");
  });

  it("accepts an 80-character name", async () => {
    const res = await patchMe({ name: "A".repeat(80) });
    expect(res.status).toBe(200);
  });

  describe("date of birth", () => {
    // 20:00 UTC on 1 Oct is 01:30 IST on 2 Oct, so "today" is 2 Oct in IST.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-01T20:00:00.000Z"));
    });

    it("accepts yesterday in IST and 1900-01-01", async () => {
      expect((await patchMe({ dob: "2026-10-01" })).status).toBe(200);
      expect((await patchMe({ dob: "1900-01-01" })).status).toBe(200);
    });

    it.each([
      ["today in IST", "2026-10-02"],
      ["in the future", "2030-01-01"],
      ["before 1900", "1899-12-31"],
      ["not a real date", "2023-02-29"],
      ["in another format", "17/05/1990"],
      ["a timestamp", "1990-05-17T00:00:00Z"],
    ])("rejects a date %s", async (_case, dob) => {
      expectValidationError(await patchMe({ dob }), "dob");
    });
  });

  it.each(["PREFER_NOT_TO_SAY", "female", "X"])("rejects the gender %j", async (gender) => {
    expectValidationError(await patchMe({ gender }), "gender");
  });

  it("rejects an empty body", async () => {
    expectValidationError(await patchMe({}));
  });

  it.each([
    { email: "other@example.com" },
    { emailVerified: false },
    { isBlocked: true },
    { onboardingCompleted: true },
    { consentVersion: "x" },
    { consentAcceptedAt: "2026-01-01T00:00:00.000Z" },
    { passwordHash: "x" },
  ])("rejects the protected field %o and changes nothing", async (extra) => {
    const before = await User.findOne({ email: EMAIL }).lean();
    expectValidationError(await patchMe({ name: "Asha Rao", ...extra }));
    expect(await User.findOne({ email: EMAIL }).lean()).toEqual(before);
  });

  it("rejects a NoSQL operator as a value", async () => {
    expectValidationError(await patchMe({ name: { $ne: null } }), "name");
  });
});
