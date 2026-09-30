import { randomUUID } from "node:crypto";

// Always generated here — an incoming X-Request-Id is ignored so clients can't inject log values.
export const requestId = (req, res, next) => {
  req.id = randomUUID();
  res.set("X-Request-Id", req.id);
  next();
};
