import { disableAdmin } from "../src/modules/admins/admin.service.js";
import { adminUsername } from "../src/modules/admins/admin.validation.js";
import { askValid, write } from "./lib/prompt.js";
import { ScriptError, runAdminScript } from "./lib/runAdminScript.js";

await runAdminScript(async () => {
  const username = await askValid("Username: ", adminUsername);
  const admin = await disableAdmin(username);
  if (!admin) throw new ScriptError(`No admin with the username "${username}".`);
  write(`Disabled "${admin.username}" and signed out all their sessions.\n`);
});
