import { z } from "zod";

export const objectId = z.string().regex(/^[0-9a-f]{24}$/i, "Invalid id");

// For routes with a single `:id` path param (an ObjectId).
export const idParamsSchema = z.strictObject({ id: objectId });
