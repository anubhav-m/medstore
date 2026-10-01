import { ErrorCodes } from "@medstore/shared";
import mongoose from "mongoose";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Address } from "../../../src/modules/addresses/address.model.js";
import { expectError } from "../../helpers/admin.js";
import { API } from "../../helpers/auth.js";
import { ADDRESS, onboardedCustomer, signedUpCustomer } from "../../helpers/customer.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

let app;
beforeEach(() => {
  app = createApp();
});

const unknownId = () => new mongoose.Types.ObjectId().toString();

describe("address routes: access", () => {
  it("return ONBOARDING_REQUIRED before onboarding, while /me still works", async () => {
    const api = await signedUpCustomer(app, "new@example.com");
    const id = unknownId();

    expectError(await api.get("/addresses"), 403, ErrorCodes.ONBOARDING_REQUIRED);
    expectError(await api.post("/addresses").send(ADDRESS), 403, ErrorCodes.ONBOARDING_REQUIRED);
    expectError(
      await api.patch(`/addresses/${id}`).send({ label: "Work" }),
      403,
      ErrorCodes.ONBOARDING_REQUIRED,
    );
    expectError(await api.delete(`/addresses/${id}`), 403, ErrorCodes.ONBOARDING_REQUIRED);
    expect(await Address.countDocuments()).toBe(0);

    expect((await api.get("/me")).status).toBe(200);
    expect((await api.patch("/me").send({ name: "New Person" })).status).toBe(200);
  });

  it("require a customer access token", async () => {
    expectError(await request(app).get(`${API}/addresses`), 401, ErrorCodes.INVALID_TOKEN);
    expectError(
      await request(app).post(`${API}/addresses`).send(ADDRESS),
      401,
      ErrorCodes.INVALID_TOKEN,
    );
  });

  describe("another customer's address", () => {
    let customerA;
    let addressOfB;
    beforeEach(async () => {
      customerA = await onboardedCustomer(app, "a@example.com");
      ({ address: addressOfB } = await onboardedCustomer(app, "b@example.com"));
    });

    it("is never listed", async () => {
      const res = await customerA.api.get("/addresses");
      expect(res.body.data.addresses.map((address) => address.id)).toEqual([customerA.address.id]);
    });

    it("can't be edited: ADDRESS_NOT_FOUND and unchanged", async () => {
      const res = await customerA.api
        .patch(`/addresses/${addressOfB.id}`)
        .send({ label: "Hijacked", isDefault: true });

      expectError(res, 404, ErrorCodes.ADDRESS_NOT_FOUND);
      const stored = await Address.findById(addressOfB.id).lean();
      expect(stored).toMatchObject({ label: ADDRESS.label, isDefault: true });
      // A's own default was not unset by the rolled-back transaction.
      expect((await Address.findById(customerA.address.id).lean()).isDefault).toBe(true);
    });

    it("can't be deleted: ADDRESS_NOT_FOUND and still there", async () => {
      expectError(
        await customerA.api.delete(`/addresses/${addressOfB.id}`),
        404,
        ErrorCodes.ADDRESS_NOT_FOUND,
      );
      expect(await Address.exists({ _id: addressOfB.id })).toBeTruthy();
    });
  });

  describe("ids", () => {
    let api;
    beforeEach(async () => {
      ({ api } = await onboardedCustomer(app, "a@example.com"));
    });

    it.each(["not-an-id", "123", "zzzzzzzzzzzzzzzzzzzzzzzz"])(
      "reject the malformed id %j with INVALID_ID",
      async (id) => {
        expectError(
          await api.patch(`/addresses/${id}`).send({ label: "Work" }),
          400,
          ErrorCodes.INVALID_ID,
        );
        expectError(await api.delete(`/addresses/${id}`), 400, ErrorCodes.INVALID_ID);
      },
    );

    it("return ADDRESS_NOT_FOUND for a well-formed unknown id", async () => {
      const id = unknownId();
      expectError(
        await api.patch(`/addresses/${id}`).send({ label: "Work" }),
        404,
        ErrorCodes.ADDRESS_NOT_FOUND,
      );
      expectError(await api.delete(`/addresses/${id}`), 404, ErrorCodes.ADDRESS_NOT_FOUND);
    });
  });
});
