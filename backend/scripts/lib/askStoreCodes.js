import { ErrorCodes } from "@medstore/shared";
import { storeCodesInput } from "../../src/modules/admins/admin.validation.js";
import { resolveStoreCodes } from "../../src/modules/stores/store.service.js";
import { askValid, write } from "./prompt.js";

// Re-asks until every code names an existing store, so nobody types a password twice only to
// have the codes rejected. The services check the codes again when writing.
export const askStoreCodes = async () => {
  while (true) {
    const codes = await askValid(
      "Store codes, comma-separated (e.g. ST01, ST02): ",
      storeCodesInput,
    );
    try {
      await resolveStoreCodes(codes);
      return codes;
    } catch (error) {
      if (error?.code !== ErrorCodes.STORE_NOT_FOUND) throw error;
      write(`  ${error.message}\n`);
    }
  }
};
