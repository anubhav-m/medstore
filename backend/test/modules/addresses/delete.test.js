import { ErrorCodes } from "@medstore/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { Address } from "../../../src/modules/addresses/address.model.js";
import { expectError } from "../../helpers/admin.js";
import { ADDRESS, onboardedCustomer } from "../../helpers/customer.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

let api;
let home;
beforeEach(async () => {
  ({ api, address: home } = await onboardedCustomer(createApp(), "asha@example.com"));
});

const add = async (label) =>
  (await api.post("/addresses").send({ ...ADDRESS, label })).body.data.address;
const remove = (id) => api.delete(`/addresses/${id}`);
const defaultIds = async () =>
  (await Address.find({ isDefault: true }).lean()).map((address) => String(address._id));

describe("DELETE /addresses/:id", () => {
  it("deletes a non-default address and leaves the default alone", async () => {
    const work = await add("Work");
    const res = await remove(work.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: "Address deleted" });
    expect(await Address.exists({ _id: work.id })).toBeNull();
    expect(await defaultIds()).toEqual([home.id]);
  });

  it("promotes the most recently created remaining address when the default is deleted", async () => {
    await add("Older");
    const newest = await add("Newest");
    // Editing an older address must not make it "most recent".
    await api.patch(`/addresses/${home.id}`).send({ label: "Home edited" });

    expect((await remove(home.id)).status).toBe(200);
    expect(await defaultIds()).toEqual([newest.id]);
  });

  it("allows deleting the last address; the next one added becomes the default", async () => {
    expect((await remove(home.id)).status).toBe(200);
    expect(await Address.countDocuments()).toBe(0);

    const next = await add("New home");
    expect(next.isDefault).toBe(true);
  });

  it("returns ADDRESS_NOT_FOUND for an address already deleted", async () => {
    const work = await add("Work");
    await remove(work.id);
    expectError(await remove(work.id), 404, ErrorCodes.ADDRESS_NOT_FOUND);
  });
});
