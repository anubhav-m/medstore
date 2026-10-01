import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@medstore/shared";
import { z } from "zod";

// Spread into a strict query schema; query values arrive as strings.
export const paginationQuery = {
  page: z.coerce.number().int("Use a whole number").min(1, "Use 1 or more").default(1),
  limit: z.coerce
    .number()
    .int("Use a whole number")
    .min(1, "Use 1 or more")
    .max(MAX_PAGE_SIZE, `Use at most ${MAX_PAGE_SIZE}`)
    .default(DEFAULT_PAGE_SIZE),
};

export const skipFor = ({ page, limit }) => (page - 1) * limit;

export const paginationMeta = ({ page, limit }, total) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
});
