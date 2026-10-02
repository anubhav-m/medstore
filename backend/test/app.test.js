import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("app baseline", () => {
  it("returns 404 ROUTE_NOT_FOUND in the fixed failure shape", async () => {
    const res = await request(createApp()).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: "Route not found",
      code: "ROUTE_NOT_FOUND",
    });
  });

  it("returns 400 INVALID_JSON for a malformed body", async () => {
    const res = await request(createApp())
      .post("/health")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "INVALID_JSON" });
  });

  it("returns 413 PAYLOAD_TOO_LARGE for a body over 100 kb", async () => {
    const res = await request(createApp())
      .post("/health")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ data: "x".repeat(101 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ success: false, code: "PAYLOAD_TOO_LARGE" });
  });

  it("sends Helmet security headers and hides x-powered-by", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBeDefined();
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("generates its own request id and ignores a client-supplied one", async () => {
    const res = await request(createApp()).get("/health").set("X-Request-Id", "injected");
    expect(res.headers["x-request-id"]).toMatch(UUID);
  });

  it("returns 429 TOO_MANY_REQUESTS once the global limit is exceeded", async () => {
    const app = createApp({ rateLimits: { global: { windowMs: 60_000, limit: 2 } } });
    await request(app).get("/does-not-exist").expect(404);
    await request(app).get("/does-not-exist").expect(404);
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, code: "TOO_MANY_REQUESTS" });
  });

  it("never rate-limits the health check", async () => {
    const app = createApp({ rateLimits: { global: { windowMs: 60_000, limit: 1 } } });
    for (let call = 0; call < 3; call += 1) await request(app).get("/health").expect(200);
  });

  it.each([
    ["an unsupported charset", { "Content-Type": "application/json; charset=latin1" }],
    ["an unsupported encoding", { "Content-Type": "application/json", "Content-Encoding": "zip" }],
  ])("returns 400 INVALID_JSON for a body with %s", async (_case, headers) => {
    const res = await request(createApp()).post("/api/v1/auth/login").set(headers).send("{}");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "INVALID_JSON" });
  });

  it("returns 400 INVALID_ID for a path param that isn't valid percent-encoding", async () => {
    const res = await request(createApp()).get("/api/v1/orders/%E0%A4%A");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "Invalid id", code: "INVALID_ID" });
  });

  it("reports healthy when the database is connected", async () => {
    const res = await request(createApp()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "OK",
      data: { status: "ok", db: "connected" },
    });
  });
});
