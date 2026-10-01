import { INDIAN_PHONE_PREFIX } from "@medstore/shared";
import { z } from "zod";

// Spaces and dashes are removed before `pattern` is applied; its capture group is the 10-digit
// number, stored as +91XXXXXXXXXX. The length bound only stops oversized input before normalising.
export const indianPhone = (pattern, message) =>
  z
    .string()
    .max(20, message)
    .transform((value, ctx) => {
      const match = pattern.exec(value.replace(/[\s-]/g, ""));
      if (!match) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return `${INDIAN_PHONE_PREFIX}${match[1]}`;
    });
