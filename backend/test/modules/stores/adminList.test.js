import { AdminRole, ErrorCodes } from "@medstore/shared";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../src/app.js";
import { setAdminStores } from "../../../src/modules/admins/admin.service.js";
import { ADMIN_API, expectError, getAdminMe, signInAdmin } from "../../helpers/admin.js";
import { registerAndVerify } from "../../helpers/auth.js";
import { createTestStore, signInOwner, signInStaff } from "../../helpers/store.js";

vi.mock("../../../src/services/email.js", () => ({ sendCodeEmail: vi.fn() }));

let app;
beforeEach(async () => {
  app = createApp();
  await createTestStore({ code: "ST02", name: "Second" });
  await createTestStore({ code: "AB01", name: "Closed Down", isActive: false });
  await createTestStore({ code: "ST01", name: "First" });
});

const codes = (res) => res.body.data.stores.map((store) => store.code);

describe("GET /admin/stores", () => {
  it("shows the owner every store, including inactive ones, by code", async () => {
    const owner = await signInOwner(app);
    const res = await owner.get("/stores");

    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Stores loaded");
    expect(codes(res)).toEqual(["AB01", "ST01", "ST02"]);
    expect(res.body.data.stores[0]).toMatchObject({ code: "AB01", isActive: false });
  });

  it("shows staff only their stores", async () => {
    const staff = await signInStaff(app, ["ST02", "AB01"]);
    expect(codes(await staff.get("/stores"))).toEqual(["AB01", "ST02"]);
  });

  it("applies a change of a staff member's stores to their next request", async () => {
    const staff = await signInStaff(app, ["ST02"]);
    await setAdminStores("staff.one", ["ST01"]);
    expect(codes(await staff.get("/stores"))).toEqual(["ST01"]);
  });

  it("returns 401 INVALID_TOKEN for no token or a customer token", async () => {
    expectError(await request(app).get(`${ADMIN_API}/stores`), 401, ErrorCodes.INVALID_TOKEN);

    const { accessToken } = await registerAndVerify(app, "asha@example.com");
    const res = await request(app)
      .get(`${ADMIN_API}/stores`)
      .set("Authorization", `Bearer ${accessToken}`);
    expectError(res, 401, ErrorCodes.INVALID_TOKEN);
  });
});

describe("GET /admin/me stores", () => {
  const summaries = (res) => res.body.data.stores.map(({ code, name }) => ({ code, name }));

  it("lists every store for the owner as { id, code, name }", async () => {
    const session = await signInAdmin(app);
    const res = await getAdminMe(app, session.accessToken);

    expect(Object.keys(res.body.data.stores[0]).sort()).toEqual(["code", "id", "name"]);
    expect(summaries(res)).toEqual([
      { code: "AB01", name: "Closed Down" },
      { code: "ST01", name: "First" },
      { code: "ST02", name: "Second" },
    ]);
  });

  it("lists only their stores for staff", async () => {
    const session = await signInAdmin(app, {
      username: "staff.one",
      role: AdminRole.STAFF,
      storeCodes: ["ST02"],
    });
    const res = await getAdminMe(app, session.accessToken);

    expect(summaries(res)).toEqual([{ code: "ST02", name: "Second" }]);
    expect(res.body.data.admin.storeIds).toEqual([res.body.data.stores[0].id]);
  });
});
