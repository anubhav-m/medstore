import request from "supertest";
import { vi } from "vitest";
import { sendCodeEmail } from "../../src/services/email.js";

// Test files using these helpers mock services/email.js with vi.mock.
export const API = "/api/v1";
export const PASSWORD = "correct horse battery";

export const lastSentCode = (purpose) =>
  vi
    .mocked(sendCodeEmail)
    .mock.calls.map(([message]) => message)
    .filter((message) => !purpose || message.purpose === purpose)
    .at(-1)?.code;

export const advanceTime = (ms) => vi.setSystemTime(Date.now() + ms);

export const registerAndVerify = async (app, email, password = PASSWORD) => {
  await request(app).post(`${API}/auth/register`).send({ email, password }).expect(200);
  const res = await request(app)
    .post(`${API}/auth/verify-email`)
    .send({ email, code: lastSentCode("VERIFY_EMAIL") })
    .expect(200);
  return res.body.data;
};

export const login = (app, email, password = PASSWORD) =>
  request(app).post(`${API}/auth/login`).send({ email, password });
