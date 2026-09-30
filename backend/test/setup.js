import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, inject } from "vitest";

// One database per worker so test files running in parallel never share data.
beforeAll(async () => {
  await mongoose.connect(inject("mongoUri"), { dbName: `test-${process.env.VITEST_POOL_ID}` });
});

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
});
