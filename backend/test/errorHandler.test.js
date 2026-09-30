import express from "express";
import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { AppError } from "../src/utils/AppError.js";

const respondWith = async (error) => {
  const app = express();
  app.get("/boom", () => {
    throw error;
  });
  app.use(errorHandler);
  return request(app).get("/boom");
};

const shaped = (props) => Object.assign(new Error("shaped error"), props);

const catchError = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected fn to throw");
};

const Thing = mongoose.model(
  "ErrorHandlerTestThing",
  new mongoose.Schema({ email: { type: String, required: true }, age: Number }),
);

describe("errorHandler classifier", () => {
  it("passes AppError through with its own status, code and field errors", async () => {
    const errors = [{ field: "phone", message: "Enter a 10-digit mobile number" }];
    const res = await respondWith(new AppError("Closed", 409, "STORE_CLOSED", errors));
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: "Closed", code: "STORE_CLOSED", errors });
  });

  it("maps a ZodError to 400 VALIDATION_ERROR with per-field errors", async () => {
    const error = catchError(() => z.object({ phone: z.string() }).parse({ phone: 1 }));
    const res = await respondWith(error);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.errors).toEqual([{ field: "phone", message: expect.any(String) }]);
  });

  it("maps a Mongoose ValidationError to 400 VALIDATION_ERROR without echoing values", async () => {
    let error;
    try {
      await new Thing({ age: "not-a-number" }).validate();
    } catch (validationError) {
      error = validationError;
    }
    const res = await respondWith(error);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: "email", message: expect.any(String) },
        { field: "age", message: "Invalid value" },
      ]),
    );
    expect(JSON.stringify(res.body)).not.toContain("not-a-number");
  });

  it("maps a Mongoose CastError to 400 INVALID_ID", async () => {
    const res = await respondWith(new mongoose.Error.CastError("ObjectId", "abc", "_id"));
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: "INVALID_ID" });
    expect(JSON.stringify(res.body)).not.toContain("abc");
  });

  it("maps duplicate key 11000 to 409 DUPLICATE_RESOURCE naming the field, not the value", async () => {
    const error = shaped({
      name: "MongoServerError",
      code: 11000,
      keyPattern: { email: 1 },
      keyValue: { email: "someone@example.com" },
      message: "E11000 duplicate key error dup key: { email: someone@example.com }",
    });
    const res = await respondWith(error);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("DUPLICATE_RESOURCE");
    expect(res.body.errors).toEqual([{ field: "email", message: "Already exists" }]);
    expect(JSON.stringify(res.body)).not.toContain("someone@example.com");
  });

  it("maps a body-parser parse failure to 400 INVALID_JSON", async () => {
    const res = await respondWith(shaped({ type: "entity.parse.failed", status: 400 }));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_JSON");
  });

  it("maps a body-parser size failure to 413 PAYLOAD_TOO_LARGE", async () => {
    const res = await respondWith(shaped({ type: "entity.too.large", status: 413 }));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("maps TokenExpiredError to 401 TOKEN_EXPIRED", async () => {
    const res = await respondWith(shaped({ name: "TokenExpiredError" }));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("TOKEN_EXPIRED");
  });

  it.each(["JsonWebTokenError", "NotBeforeError"])("maps %s to 401 INVALID_TOKEN", async (name) => {
    const res = await respondWith(shaped({ name }));
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_TOKEN");
  });

  it("maps a rate-limit AppError to 429 TOO_MANY_REQUESTS", async () => {
    const res = await respondWith(new AppError("Too many", 429, "TOO_MANY_REQUESTS"));
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("TOO_MANY_REQUESTS");
  });

  it("maps a Mongoose server-selection error to 503 SERVICE_UNAVAILABLE", async () => {
    const error = new mongoose.Error.MongooseServerSelectionError("connect ECONNREFUSED");
    const res = await respondWith(error);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SERVICE_UNAVAILABLE");
  });

  it.each([
    "MongoServerSelectionError",
    "MongoNetworkError",
    "MongoNetworkTimeoutError",
    "MongoNotConnectedError",
  ])("maps %s to 503 SERVICE_UNAVAILABLE", async (name) => {
    const res = await respondWith(shaped({ name }));
    expect(res.status).toBe(503);
    expect(res.body.code).toBe("SERVICE_UNAVAILABLE");
  });

  it("maps anything else to 500 with a generic message and no internals", async () => {
    const error = new TypeError("secret internal detail at /srv/app/db.js");
    const res = await respondWith(error);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      success: false,
      message: "Something went wrong. Please try again.",
      code: "INTERNAL_SERVER_ERROR",
    });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("secret internal detail");
    expect(raw).not.toContain("TypeError");
    expect(raw).not.toContain("stack");
  });

  it("delegates to next when headers were already sent", () => {
    const error = new Error("late");
    const res = { headersSent: true, status: vi.fn() };
    const next = vi.fn();
    errorHandler(error, {}, res, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(res.status).not.toHaveBeenCalled();
  });
});
