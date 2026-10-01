import { BLOCK_REASON_MAX_LENGTH } from "@medstore/shared";
import { z } from "zod";
import { idParamsSchema } from "../../utils/idParams.js";
import { text } from "../orders/order.validation.js";

export const blockCustomerSchema = {
  params: idParamsSchema,
  body: z
    .strictObject({
      isBlocked: z.boolean("Choose true or false"),
      reason: text(1, BLOCK_REASON_MAX_LENGTH).optional(),
    })
    .refine((body) => body.isBlocked || body.reason === undefined, {
      message: "A reason can only be given when blocking",
      path: ["reason"],
    }),
};
