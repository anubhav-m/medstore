import request from "supertest";
import { expect } from "vitest";
import { API, registerAndVerify } from "./auth.js";

// Test files using these helpers mock services/email.js with vi.mock.

export const ADDRESS = {
  label: "Home",
  line1: "Flat 4B, Sea View",
  line2: "Hill Road, Bandra",
  landmark: "Near the park",
  city: "Mumbai",
  pincode: "400050",
  lat: 19.07,
  lng: 72.87,
};

export const ONBOARDING = {
  name: "Asha Rao",
  phone: "9876543210",
  address: ADDRESS,
  consentAccepted: true,
};

// Requests as the customer holding `token`, e.g. api.get("/me").
const customerApi = (app, token) => {
  const call = (method) => (path) =>
    request(app)[method](`${API}${path}`).set("Authorization", `Bearer ${token}`);
  return { get: call("get"), post: call("post"), patch: call("patch"), delete: call("delete") };
};

export const signedUpCustomer = async (app, email) => {
  const { accessToken } = await registerAndVerify(app, email);
  return customerApi(app, accessToken);
};

// Returns the API client plus the first (default) address created by onboarding.
export const onboardedCustomer = async (app, email) => {
  const api = await signedUpCustomer(app, email);
  const res = await api.post("/me/onboarding").send(ONBOARDING);
  expect(res.status).toBe(200);
  return { api, user: res.body.data.user, address: res.body.data.address };
};
