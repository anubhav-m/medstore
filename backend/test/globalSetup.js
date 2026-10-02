import { MongoMemoryReplSet } from "mongodb-memory-server";

export default async function setup(project) {
  // mongod's TTL monitor deletes by the real clock, but tests freeze Date (often in the past), so it
  // would delete codes and tokens the test still treats as live. Expiry is checked in code anyway.
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ args: ["--setParameter", "ttlMonitorEnabled=false"] }],
  });
  project.provide("mongoUri", replSet.getUri());

  return async () => {
    await replSet.stop();
  };
}
