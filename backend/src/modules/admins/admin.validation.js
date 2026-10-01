import {
  ADMIN_NAME_MAX_LENGTH,
  ADMIN_NAME_MIN_LENGTH,
  ADMIN_PASSWORD_MAX_LENGTH,
  ADMIN_PASSWORD_MIN_LENGTH,
  ADMIN_USERNAME_MAX_LENGTH,
  ADMIN_USERNAME_MIN_LENGTH,
  ADMIN_USERNAME_PATTERN,
} from "@medstore/shared";
import { z } from "zod";

// Field schemas shared by the admin-auth routes and the CLI scripts.

export const adminUsername = z
  .string()
  .trim()
  .toLowerCase()
  .min(ADMIN_USERNAME_MIN_LENGTH, `Use at least ${ADMIN_USERNAME_MIN_LENGTH} characters`)
  .max(ADMIN_USERNAME_MAX_LENGTH, `Use at most ${ADMIN_USERNAME_MAX_LENGTH} characters`)
  .regex(ADMIN_USERNAME_PATTERN, "Use only lowercase letters, digits, . and _");

export const adminName = z
  .string()
  .trim()
  .min(ADMIN_NAME_MIN_LENGTH, `Use at least ${ADMIN_NAME_MIN_LENGTH} characters`)
  .max(ADMIN_NAME_MAX_LENGTH, `Use at most ${ADMIN_NAME_MAX_LENGTH} characters`);

// Passwords are never trimmed: spaces are valid characters.
export const adminPassword = z
  .string()
  .min(ADMIN_PASSWORD_MIN_LENGTH, `Use at least ${ADMIN_PASSWORD_MIN_LENGTH} characters`)
  .max(ADMIN_PASSWORD_MAX_LENGTH, `Use at most ${ADMIN_PASSWORD_MAX_LENGTH} characters`);
