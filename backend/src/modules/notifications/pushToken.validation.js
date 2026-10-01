import { z } from "zod";
import { isPushToken } from "../../services/push.js";

// Expo tokens are about 41 characters; the bound only stops oversized input.
export const pushToken = z
  .string()
  .trim()
  .max(200)
  .refine(isPushToken, "Enter a valid Expo push token");

export const pushTokenRequestSchema = { body: z.strictObject({ token: pushToken }) };
