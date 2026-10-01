import { AdminRole } from "@medstore/shared";
import { listAdmins } from "../src/modules/admins/admin.service.js";
import { write } from "./lib/prompt.js";
import { runAdminScript } from "./lib/runAdminScript.js";

await runAdminScript(async () => {
  const admins = await listAdmins();
  if (admins.length === 0) {
    write("No admins yet. Create the first one with npm run admin:create.\n");
    return;
  }
  for (const admin of admins) {
    const status = admin.isActive ? "active" : "disabled";
    const stores = admin.role === AdminRole.OWNER ? "all stores" : admin.storeCodes.join(",");
    write(`${admin.username}\t${admin.role}\t${stores}\t${status}\t${admin.name}\n`);
  }
});
