import express, { Router } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { recordRoutePattern } from "../../src/middleware/requestLogger.js";

// Mirrors the real mounting (/api/v1 → /addresses → /:id). The final handler runs after every
// router has been left, like the request logger does, and reports what it would log.
const buildApp = () => {
  const addresses = Router();
  addresses.get("/:id", (req, res) => res.json({ ok: true, route: req.routePattern }));
  addresses.delete("/:id", () => {
    throw new Error("rejected inside the route");
  });

  const guarded = Router();
  guarded.use(() => {
    throw new Error("rejected before any route matched");
  });
  guarded.get("/", (_req, res) => res.json({ ok: true }));

  const api = Router();
  api.use("/addresses", addresses);
  api.use("/guarded", guarded);

  const app = express();
  app.use(recordRoutePattern);
  app.use("/api/v1", api);
  app.use((req, res) => res.status(404).json({ route: req.routePattern ?? null }));
  app.use((_error, req, res, _next) =>
    res.status(400).json({ baseUrl: req.baseUrl, route: req.routePattern ?? null }),
  );
  return app;
};

describe("recordRoutePattern", () => {
  it("records the full pattern of a matched route", async () => {
    const res = await request(buildApp()).get("/api/v1/addresses/abc123");
    expect(res.body.route).toBe("/api/v1/addresses/:id");
  });

  it("keeps the full pattern after a failed request has left the routers", async () => {
    const res = await request(buildApp()).delete("/api/v1/addresses/abc123");

    expect(res.status).toBe(400);
    // Express has already reset baseUrl; the recorded pattern survives.
    expect(res.body).toEqual({ baseUrl: "", route: "/api/v1/addresses/:id" });
  });

  it("records nothing when no route matched", async () => {
    expect((await request(buildApp()).get("/api/v1/nowhere")).body.route).toBeNull();
    expect((await request(buildApp()).get("/api/v1/guarded")).body.route).toBeNull();
  });

  it("never records the raw URL or query string", async () => {
    const res = await request(buildApp()).get("/api/v1/addresses/9876543210?q=9876543210");
    expect(res.body.route).toBe("/api/v1/addresses/:id");
  });
});
