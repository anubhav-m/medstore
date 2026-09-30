import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

vi.mock("../src/config/db.js", () => ({ isDbConnected: () => false }));

describe("GET /health", () => {
  it("returns 503 SERVICE_UNAVAILABLE when the database is not connected", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, code: "SERVICE_UNAVAILABLE" });
  });
});
