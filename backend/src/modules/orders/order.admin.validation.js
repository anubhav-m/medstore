import {
  AdminOrderTab,
  BILL_ITEM_MAX_QUANTITY,
  BILL_ITEM_NAME_MAX_LENGTH,
  BILL_ITEM_NAME_MIN_LENGTH,
  BILL_UNIT_PRICE_MAX_PAISE,
  DELIVERY_FEE_MAX_PAISE,
  DeliveryFailedReason,
  MAX_BILL_ITEMS,
  REASON_NOTE_MAX_LENGTH,
  RejectReason,
  SEARCH_QUERY_MAX_LENGTH,
  StaffCancelReason,
} from "@medstore/shared";
import { z } from "zod";
import { idParamsSchema, objectId } from "../../utils/idParams.js";
import { paginationQuery } from "../../utils/pagination.js";
import { subtotalOf } from "./orderBill.js";
import { text } from "./order.validation.js";

// Money and quantities are JSON integers: strings, decimals and unsafe integers are rejected.
const wholeNumber = (min) =>
  z.number("Enter a number").int("Use a whole number").min(min, `Use ${min} or more`);

const bounded = (min, max) => wholeNumber(min).max(max, `Use at most ${max}`);

const searchText = text(1, SEARCH_QUERY_MAX_LENGTH);

export const listOrdersSchema = {
  query: z.strictObject({
    storeId: objectId.optional(),
    tab: z.enum(AdminOrderTab, "Choose a tab from the list").optional(),
    q: searchText.optional(),
    ...paginationQuery,
  }),
};

export const orderCountsSchema = {
  query: z.strictObject({ storeId: objectId.optional() }),
};

export const itemSuggestionsSchema = {
  query: z.strictObject({ storeId: objectId, q: searchText }),
};

// Pack and dispatch take no input; an empty JSON object is accepted too.
export const noInputActionSchema = {
  params: idParamsSchema,
  body: z.strictObject({}).optional(),
};

// Every enum here has OTHER, which needs a note.
const reasonSchema = (reasons) => ({
  params: idParamsSchema,
  body: z
    .strictObject({
      reasonCode: z.enum(reasons, "Choose a reason from the list"),
      note: text(1, REASON_NOTE_MAX_LENGTH).optional(),
    })
    .refine((body) => body.reasonCode !== reasons.OTHER || body.note !== undefined, {
      message: "Tell us the reason",
      path: ["note"],
    }),
});

export const rejectSchema = reasonSchema(RejectReason);
export const staffCancelSchema = reasonSchema(StaffCancelReason);
export const failDeliverySchema = reasonSchema(DeliveryFailedReason);

const billItem = z.strictObject({
  name: text(BILL_ITEM_NAME_MIN_LENGTH, BILL_ITEM_NAME_MAX_LENGTH),
  quantity: bounded(1, BILL_ITEM_MAX_QUANTITY),
  unitPricePaise: bounded(1, BILL_UNIT_PRICE_MAX_PAISE),
});

// Strict: lineTotalPaise, subtotalPaise, totalPaise and billVersion are rejected — the server
// computes them.
export const sendBillSchema = {
  params: idParamsSchema,
  body: z
    .strictObject({
      expectedBillVersion: wholeNumber(0),
      items: z
        .array(billItem)
        .min(1, "Add at least one item")
        .max(MAX_BILL_ITEMS, `Add at most ${MAX_BILL_ITEMS} items`),
      deliveryFeePaise: bounded(0, DELIVERY_FEE_MAX_PAISE).optional(),
      discountPaise: wholeNumber(0).optional(),
    })
    .refine(
      (body) => body.discountPaise === undefined || body.discountPaise <= subtotalOf(body.items),
      { message: "The discount can't be more than the subtotal", path: ["discountPaise"] },
    ),
};

export const deliverSchema = {
  params: idParamsSchema,
  body: z.strictObject({ cashCollectedPaise: wholeNumber(0) }),
};
