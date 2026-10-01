import { AdminRole } from "@medstore/shared";
import { describe, expect, it } from "vitest";
import { getStoreScope } from "../../../src/modules/stores/storeScope.js";
import { createTestStore } from "../../helpers/store.js";

const ids = (values) => values.map(String).sort();

describe("getStoreScope", () => {
  it("gives an owner every store, including inactive ones", async () => {
    const a = await createTestStore({ code: "ST01" });
    const b = await createTestStore({ code: "ST02", isActive: false });

    const scope = await getStoreScope({ role: AdminRole.OWNER, storeIds: [] });
    expect(ids(scope)).toEqual(ids([a.id, b.id]));
  });

  it("gives staff exactly their stores", async () => {
    const a = await createTestStore({ code: "ST01" });
    await createTestStore({ code: "ST02" });

    const scope = await getStoreScope({ role: AdminRole.STAFF, storeIds: [a.id] });
    expect(ids(scope)).toEqual([a.id]);
  });
});
