import { resetAdminPassword } from "../src/modules/admins/admin.service.js";
import { adminPassword, adminUsername } from "../src/modules/admins/admin.validation.js";
import { askNewPassword, askValid, write } from "./lib/prompt.js";
import { ScriptError, runAdminScript } from "./lib/runAdminScript.js";

await runAdminScript(async () => {
  const username = await askValid("Username: ", adminUsername);
  const admin = await resetAdminPassword(username, await askNewPassword(adminPassword));
  if (!admin) throw new ScriptError(`No admin with the username "${username}".`);
  write(
    `Password reset for "${admin.username}". All their sessions were signed out, and they must change the password at next sign-in.\n`,
  );
});
