// schemas: { body?, params?, query?, headers? } — each a Zod schema. A ZodError goes to the
// error handler as 400 VALIDATION_ERROR.
export const validate = (schemas) => (req, _res, next) => {
  try {
    req.validated = {};
    for (const [part, schema] of Object.entries(schemas)) {
      req.validated[part] = schema.parse(req[part]);
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
