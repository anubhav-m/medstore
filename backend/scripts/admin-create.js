import { AdminRole } from "@medstore/shared";
import { createAdmin } from "../src/modules/admins/admin.service.js";
import { adminName, adminPassword, adminUsername } from "../src/modules/admins/admin.validation.js";
import { askNewPassword, askValid, write } from "./lib/prompt.js";
import { runAdminScript } from "./lib/runAdminScript.js";

// OWNER only for now: staff need store codes, which arrive with the stores feature.
await runAdminScript(async () => {
  const admin = await createAdmin({
    username: await askValid("Username: ", adminUsername),
    name: await askValid("Full name: ", adminName),
    password: await askNewPassword(adminPassword),
    role: AdminRole.OWNER,
  });
  write(`Created OWNER "${admin.username}". They must change this password at first sign-in.\n`);
});
