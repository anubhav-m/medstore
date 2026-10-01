import { AdminRole } from "@medstore/shared";
import { createAdmin } from "../src/modules/admins/admin.service.js";
import {
  adminName,
  adminPassword,
  adminRole,
  adminUsername,
} from "../src/modules/admins/admin.validation.js";
import { askStoreCodes } from "./lib/askStoreCodes.js";
import { askNewPassword, askValid, write } from "./lib/prompt.js";
import { runAdminScript } from "./lib/runAdminScript.js";

await runAdminScript(async () => {
  const username = await askValid("Username: ", adminUsername);
  const name = await askValid("Full name: ", adminName);
  const role = await askValid("Role (OWNER or STAFF): ", adminRole);
  const storeCodes = role === AdminRole.STAFF ? await askStoreCodes() : [];
  const admin = await createAdmin({
    username,
    name,
    password: await askNewPassword(adminPassword),
    role,
    storeCodes,
  });
  const stores = storeCodes.length > 0 ? ` for ${storeCodes.join(", ")}` : "";
  write(
    `Created ${admin.role} "${admin.username}"${stores}. They must change this password at first sign-in.\n`,
  );
});
