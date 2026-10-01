import { listAdmins } from "../src/modules/admins/admin.service.js";
import { write } from "./lib/prompt.js";
import { runAdminScript } from "./lib/runAdminScript.js";

// Store codes join the columns with the stores feature.
await runAdminScript(async () => {
  const admins = await listAdmins();
  if (admins.length === 0) {
    write("No admins yet. Create the first one with npm run admin:create.\n");
    return;
  }
  for (const admin of admins) {
    const status = admin.isActive ? "active" : "disabled";
    write(`${admin.username}\t${admin.role}\t${status}\t${admin.name}\n`);
  }
});
