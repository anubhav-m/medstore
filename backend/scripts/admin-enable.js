import { enableAdmin } from "../src/modules/admins/admin.service.js";
import { adminUsername } from "../src/modules/admins/admin.validation.js";
import { askValid, write } from "./lib/prompt.js";
import { ScriptError, runAdminScript } from "./lib/runAdminScript.js";

await runAdminScript(async () => {
  const username = await askValid("Username: ", adminUsername);
  const admin = await enableAdmin(username);
  if (!admin) throw new ScriptError(`No admin with the username "${username}".`);
  write(`Enabled "${admin.username}". They can sign in with their current password.\n`);
});
