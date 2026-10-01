import { ErrorCodes } from "@medstore/shared";
import { AppError } from "../utils/AppError.js";

// schemas: { params?, body?, query?, headers? } — each a Zod schema. A ZodError goes to the
// error handler as 400 VALIDATION_ERROR. Path params are always ids, so a malformed one is
// 400 INVALID_ID instead.
export const validate = (schemas) => (req, _res, next) => {
  try {
    req.validated = {};
    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        if (part === "params") throw new AppError("Invalid id", 400, ErrorCodes.INVALID_ID);
        throw result.error;
      }
      req.validated[part] = result.data;
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
