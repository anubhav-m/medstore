import { z } from "zod";

// For routes with a single `:id` path param (an ObjectId).
export const idParamsSchema = z.strictObject({ id: z.string().regex(/^[0-9a-f]{24}$/i) });
