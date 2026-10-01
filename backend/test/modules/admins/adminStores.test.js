import { AdminRole, ErrorCodes } from "@medstore/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { Admin } from "../../../src/modules/admins/admin.model.js";
import {
  createAdmin,
  listAdmins,
  setAdminStores,
} from "../../../src/modules/admins/admin.service.js";
import { adminRole, storeCodesInput } from "../../../src/modules/admins/admin.validation.js";
import { ADMIN_PASSWORD, createTestAdmin } from "../../helpers/admin.js";
import { createTestStore } from "../../helpers/store.js";

const STAFF = {
  username: "staff.one",
  name: "Staff One",
  password: ADMIN_PASSWORD,
  role: AdminRole.STAFF,
};

let st01;
let st02;
beforeEach(async () => {
  st01 = await createTestStore({ code: "ST01" });
  st02 = await createTestStore({ code: "ST02", isActive: false });
});

const storedStoreIds = async (username) =>
  (await Admin.findOne({ username }).lean()).storeIds.map(String);

describe("createAdmin with stores", () => {
  it("creates staff with the stores their codes name, including inactive ones", async () => {
    const admin = await createAdmin({ ...STAFF, storeCodes: ["ST02", "ST01"] });
    expect(admin).toMatchObject({ role: AdminRole.STAFF, storeIds: [st02.id, st01.id] });
  });

  it("refuses unknown codes with 404 STORE_NOT_FOUND naming them, creating nothing", async () => {
    await expect(
      createAdmin({ ...STAFF, storeCodes: ["ST01", "XX9", "YY9"] }),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: ErrorCodes.STORE_NOT_FOUND,
      message: "No store with the code XX9, YY9",
    });
    expect(await Admin.countDocuments()).toBe(0);
  });

  it("refuses staff without stores and owners with stores (400 VALIDATION_ERROR)", async () => {
    const invalid = { statusCode: 400, code: ErrorCodes.VALIDATION_ERROR };
    await expect(createAdmin({ ...STAFF, storeCodes: [] })).rejects.toMatchObject(invalid);
    await expect(
      createAdmin({ ...STAFF, role: AdminRole.OWNER, storeCodes: ["ST01"] }),
    ).rejects.toMatchObject(invalid);
    expect(await Admin.countDocuments()).toBe(0);
  });
});

describe("setAdminStores", () => {
  it("replaces a staff member's stores", async () => {
    await createTestAdmin({ username: "staff.one", role: AdminRole.STAFF, storeCodes: ["ST01"] });
    const admin = await setAdminStores("staff.one", ["ST02"]);

    expect(admin.storeIds).toEqual([st02.id]);
    expect(await storedStoreIds("staff.one")).toEqual([st02.id]);
  });

  it("refuses unknown codes and changes nothing", async () => {
    await createTestAdmin({ username: "staff.one", role: AdminRole.STAFF, storeCodes: ["ST01"] });
    await expect(setAdminStores("staff.one", ["ST02", "NOPE"])).rejects.toMatchObject({
      code: ErrorCodes.STORE_NOT_FOUND,
    });
    expect(await storedStoreIds("staff.one")).toEqual([st01.id]);
  });

  it("returns null for an owner, leaving them without stores", async () => {
    await createTestAdmin({ username: "owner.one" });
    expect(await setAdminStores("owner.one", ["ST01"])).toBeNull();
    expect(await storedStoreIds("owner.one")).toEqual([]);
  });

  it("returns null for an unknown username", async () => {
    expect(await setAdminStores("nobody", ["ST01"])).toBeNull();
  });
});

describe("listAdmins", () => {
  it("includes each admin's store codes", async () => {
    await createTestAdmin({ username: "owner.one" });
    await createTestAdmin({
      username: "staff.one",
      role: AdminRole.STAFF,
      storeCodes: ["ST02", "ST01"],
    });

    const admins = await listAdmins();
    expect(admins.map(({ username, storeCodes }) => ({ username, storeCodes }))).toEqual([
      { username: "owner.one", storeCodes: [] },
      { username: "staff.one", storeCodes: ["ST02", "ST01"] },
    ]);
  });
});

describe("CLI input schemas", () => {
  it("storeCodesInput uppercases, trims and removes duplicates", () => {
    expect(storeCodesInput.parse(" st01, ST02 ,,st01 ")).toEqual(["ST01", "ST02"]);
  });

  it.each(["", " , ", "ST-1", "ST01, A"])("storeCodesInput rejects %j", (value) => {
    expect(storeCodesInput.safeParse(value).success).toBe(false);
  });

  it("adminRole accepts either case and rejects anything else", () => {
    expect(adminRole.parse(" staff ")).toBe(AdminRole.STAFF);
    expect(adminRole.parse("OWNER")).toBe(AdminRole.OWNER);
    expect(adminRole.safeParse("manager").success).toBe(false);
  });
});
