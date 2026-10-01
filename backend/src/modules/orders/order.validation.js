import {
  CUSTOMER_NOTE_MAX_LENGTH,
  CustomerCancelReason,
  MAX_ORDER_IMAGES,
  OrderListScope,
  PATIENT_NAME_MAX_LENGTH,
  PATIENT_NAME_MIN_LENGTH,
  REASON_NOTE_MAX_LENGTH,
} from "@medstore/shared";
import { z } from "zod";
import { idParamsSchema, objectId } from "../../utils/idParams.js";
import { paginationQuery } from "../../utils/pagination.js";

export const text = (min, max) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? "Required" : `Use at least ${min} characters`)
    .max(max, `Use at most ${max} characters`);

// Server-issued paths are ~65 characters; their exact shape is creation check 5 (INVALID_UPLOAD).
const IMAGE_PATH_MAX_LENGTH = 100;

// Headers aren't strict (clients send many); only this one is read. Stored lowercase, so a retry
// matches whatever case the client used.
const idempotencyHeaders = z.object({
  "idempotency-key": z
    .uuid({ error: "Send a UUID in the Idempotency-Key header" })
    .transform((key) => key.toLowerCase()),
});

const customerNote = text(1, CUSTOMER_NOTE_MAX_LENGTH).optional();

// Strict: status, totals, items, orderNumber, userId and the like are rejected.
export const createOrderSchema = {
  headers: idempotencyHeaders,
  body: z.strictObject({
    storeId: objectId,
    addressId: objectId,
    imagePaths: z
      .array(z.string().max(IMAGE_PATH_MAX_LENGTH, "Invalid photo"))
      .min(1, "Add at least one photo")
      .max(MAX_ORDER_IMAGES, `Add at most ${MAX_ORDER_IMAGES} photos`)
      .refine((paths) => new Set(paths).size === paths.length, "Each photo can be added once"),
    patientName: text(PATIENT_NAME_MIN_LENGTH, PATIENT_NAME_MAX_LENGTH).optional(),
    note: customerNote,
  }),
};

export const reorderSchema = {
  params: idParamsSchema,
  headers: idempotencyHeaders,
  body: z.strictObject({ note: customerNote }),
};

export const listOrdersSchema = {
  query: z.strictObject({
    scope: z.enum(OrderListScope, "Use active or past").optional(),
    ...paginationQuery,
  }),
};

export const orderIdSchema = { params: idParamsSchema };

export const confirmOrderSchema = {
  params: idParamsSchema,
  body: z.strictObject({
    billVersion: z.number().int("Invalid bill version").min(1, "Invalid bill version"),
  }),
};

export const cancelOrderSchema = {
  params: idParamsSchema,
  body: z
    .strictObject({
      reasonCode: z.enum(CustomerCancelReason, "Choose a reason from the list").optional(),
      note: text(1, REASON_NOTE_MAX_LENGTH).optional(),
    })
    .refine((body) => body.note === undefined || body.reasonCode !== undefined, {
      message: "Choose a reason to add a note",
      path: ["reasonCode"],
    })
    .refine((body) => body.reasonCode !== CustomerCancelReason.OTHER || body.note !== undefined, {
      message: "Tell us the reason",
      path: ["note"],
    }),
};
