import { ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { deleteUnverifiedAccounts } from "../../src/jobs/deleteUnverifiedAccounts.js";
import { User } from "../../src/modules/users/user.model.js";
import { expectError } from "../helpers/admin.js";
import { API, PASSWORD, lastSentCode, login, registerAndVerify } from "../helpers/auth.js";

vi.mock("../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

const NOW = new Date("2026-10-02T06:30:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;
const daysLater = (days) => new Date(NOW.getTime() + days * DAY_MS);

let app;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  app = createApp();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const register = (email) =>
  request(app).post(`${API}/auth/register`).send({ email, password: PASSWORD }).expect(200);
const exists = async (email) => Boolean(await User.exists({ email }));

describe("deleteUnverifiedAccounts", () => {
  it("deletes accounts unverified for more than 7 days and keeps everyone else", async () => {
    await register("stale@example.com");
    await registerAndVerify(app, "verified@example.com");
    vi.setSystemTime(daysLater(2));
    await register("recent@example.com");

    expect(await deleteUnverifiedAccounts(daysLater(8))).toEqual({ deleted: 1 });

    expect(await exists("stale@example.com")).toBe(false);
    expect(await exists("verified@example.com")).toBe(true);
    expect(await exists("recent@example.com")).toBe(true);
  });

  it("restarts the wait when the account registers again", async () => {
    await register("asha@example.com");
    vi.setSystemTime(daysLater(6));
    await register("asha@example.com");

    expect(await deleteUnverifiedAccounts(daysLater(8))).toEqual({ deleted: 0 });
    expect(await exists("asha@example.com")).toBe(true);
  });

  it("keeps an old account whose owner has just been sent a live code", async () => {
    await register("asha@example.com");
    vi.setSystemTime(daysLater(8));
    expectError(await login(app, "asha@example.com"), 403, ErrorCodes.EMAIL_NOT_VERIFIED);

    expect(await deleteUnverifiedAccounts(daysLater(8))).toEqual({ deleted: 0 });
  });

  it("answers INVALID_OR_EXPIRED_CODE when the account is deleted while its code is checked", async () => {
    await register("asha@example.com");
    const original = User.findByIdAndUpdate;
    vi.spyOn(User, "findByIdAndUpdate").mockImplementationOnce(function (id, ...rest) {
      const query = original.call(this, id, ...rest);
      const exec = query.exec.bind(query);
      query.exec = async () => {
        await User.deleteOne({ _id: id });
        return exec();
      };
      return query;
    });

    const res = await request(app)
      .post(`${API}/auth/verify-email`)
      .send({ email: "asha@example.com", code: lastSentCode() });

    expectError(res, 400, ErrorCodes.INVALID_OR_EXPIRED_CODE);
  });
});
