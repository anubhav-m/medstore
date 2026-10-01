import { setAdminStores } from "../src/modules/admins/admin.service.js";
import { adminUsername } from "../src/modules/admins/admin.validation.js";
import { askStoreCodes } from "./lib/askStoreCodes.js";
import { askValid, write } from "./lib/prompt.js";
import { ScriptError, runAdminScript } from "./lib/runAdminScript.js";

// Owners always act on every store, so only staff have stores to set.
await runAdminScript(async () => {
  const username = await askValid("Username: ", adminUsername);
  const storeCodes = await askStoreCodes();
  const admin = await setAdminStores(username, storeCodes);
  if (!admin) throw new ScriptError(`No staff member with the username "${username}".`);
  write(
    `"${admin.username}" now works at ${storeCodes.join(", ")}. This applies from their next request.\n`,
  );
});
