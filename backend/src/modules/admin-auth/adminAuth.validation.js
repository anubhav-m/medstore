import { ADMIN_PASSWORD_MAX_LENGTH, ADMIN_USERNAME_MAX_LENGTH } from "@medstore/shared";
import { z } from "zod";
import { adminPassword } from "../admins/admin.validation.js";

export { logoutSchema, refreshSchema } from "../auth/auth.validation.js";

// Login doesn't enforce the creation rules beyond a bound, so the error never hints at what a
// valid username or password looks like.
export const loginSchema = {
  body: z.strictObject({
    username: z.string().trim().toLowerCase().min(1).max(ADMIN_USERNAME_MAX_LENGTH),
    password: z.string().min(1).max(ADMIN_PASSWORD_MAX_LENGTH),
  }),
};

// The current password must be correct for the change to succeed, so comparing the strings is
// the same as comparing against the stored hash.
export const changePasswordSchema = {
  body: z
    .strictObject({
      currentPassword: z.string().min(1).max(ADMIN_PASSWORD_MAX_LENGTH),
      newPassword: adminPassword,
    })
    .refine((body) => body.newPassword !== body.currentPassword, {
      path: ["newPassword"],
      message: "Choose a password different from your current one",
    }),
};
