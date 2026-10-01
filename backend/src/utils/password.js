import { randomBytes } from "node:crypto";
import { hash, verify } from "argon2";

// Unknown accounts and accounts without a password are verified against this, so the
// response time doesn't reveal which emails exist.
const DUMMY_HASH = await hash(randomBytes(32).toString("hex"));

// argon2's default type is argon2id.
export const hashPassword = (password) => hash(password);

export const verifyPassword = async (passwordHash, password) => {
  const matches = await verify(passwordHash ?? DUMMY_HASH, password);
  return Boolean(passwordHash) && matches;
};
