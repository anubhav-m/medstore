import { timingSafeEqual } from "node:crypto";
import { ErrorCodes, OtpPurpose } from "@medstore/shared";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { CodeSend } from "../../../src/modules/auth/codeSend.model.js";
import { OtpCode } from "../../../src/modules/auth/otpCode.model.js";
import { sendCodeEmail } from "../../../src/services/email.js";
import { API, PASSWORD, advanceTime, lastSentCode } from "../../helpers/auth.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const EMAIL = "asha@example.com";
const UNLIMITED = { windowMs: 60_000, limit: 1000 };

let app;
beforeEach(() => {
  app = createApp({ rateLimits: { authIp: UNLIMITED, codeCheck: UNLIMITED } });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const post = (path, body) => request(app).post(`${API}/auth/${path}`).send(body);
const statuses = (responses) => responses.map((res) => res.status).sort();
const simultaneously = (count, call) => Promise.all(Array.from({ length: count }, call));

// Holds every OtpCode.findOne until `count` are waiting, so simultaneous guesses have all read
// the code before any of them writes.
const holdCodeReadsUntil = (count) => {
  const original = OtpCode.findOne;
  let arrived = 0;
  let releaseAll;
  const allArrived = new Promise((resolve) => {
    releaseAll = resolve;
  });
  vi.spyOn(OtpCode, "findOne").mockImplementation(function (...args) {
    const query = original.apply(this, args);
    const exec = query.exec.bind(query);
    query.exec = async () => {
      arrived += 1;
      if (arrived === count) releaseAll();
      await allArrived;
      return exec();
    };
    return query;
  });
};

describe("per-email code-send limits under simultaneous requests", () => {
  it("lets one of 10 simultaneous resend-code requests through the cooldown", async () => {
    const responses = await simultaneously(10, () =>
      post("resend-code", { email: EMAIL, purpose: OtpPurpose.RESET_PASSWORD }),
    );

    expect(statuses(responses)).toEqual([200, ...Array(9).fill(429)]);
    expect(await CodeSend.countDocuments({ email: EMAIL })).toBe(1);
  });

  it("emails a known account once for 10 simultaneous forgot-password requests", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    await post("register", { email: EMAIL, password: PASSWORD }).expect(200);
    advanceTime(61_000);
    vi.mocked(sendCodeEmail).mockClear();

    await simultaneously(10, () => post("forgot-password", { email: EMAIL }));

    expect(sendCodeEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps the hourly cap when the last free sends race across purposes", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    for (let sent = 0; sent < 4; sent += 1) {
      await post("resend-code", { email: EMAIL, purpose: OtpPurpose.VERIFY_EMAIL }).expect(200);
      advanceTime(61_000);
    }

    const responses = await Promise.all(
      Object.values(OtpPurpose).flatMap((purpose) =>
        Array.from({ length: 3 }, () => post("resend-code", { email: EMAIL, purpose })),
      ),
    );

    expect(statuses(responses)).toEqual([200, ...Array(5).fill(429)]);
    expect(await CodeSend.countDocuments({ email: EMAIL })).toBe(5);
  });
});

describe("attempts per code under simultaneous guesses", () => {
  it("compares a code at most 5 times however many guesses arrive at once", async () => {
    await post("register", { email: EMAIL, password: PASSWORD }).expect(200);
    const code = lastSentCode();
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    holdCodeReadsUntil(10);
    vi.mocked(timingSafeEqual).mockClear();

    const responses = await simultaneously(10, () =>
      post("verify-email", { email: EMAIL, code: wrong }),
    );

    expect(timingSafeEqual).toHaveBeenCalledTimes(5);
    expect(responses.filter((res) => res.body.code === ErrorCodes.TOO_MANY_ATTEMPTS)).toHaveLength(
      1,
    );
    expect(await OtpCode.countDocuments()).toBe(0);
    expect((await post("verify-email", { email: EMAIL, code })).status).toBe(400);
  });

  it("still accepts the right code as the 5th attempt", async () => {
    await post("register", { email: EMAIL, password: PASSWORD }).expect(200);
    const code = lastSentCode();
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, "0");
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await post("verify-email", { email: EMAIL, code: wrong }).expect(400);
    }

    await post("verify-email", { email: EMAIL, code }).expect(200);
  });
});
