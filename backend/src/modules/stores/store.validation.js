import {
  ADDRESS_CITY_MAX_LENGTH,
  ADDRESS_LINE_MAX_LENGTH,
  DELIVERY_FEE_MAX_PAISE,
  DELIVERY_RADIUS_MAX_KM,
  DELIVERY_RADIUS_MIN_KM,
  INDIA_BOUNDS,
  MINUTES_PER_DAY,
  PINCODE_PATTERN,
  STORE_CODE_PATTERN,
  STORE_NAME_MAX_LENGTH,
  STORE_NAME_MIN_LENGTH,
  STORE_PHONE_INPUT_PATTERN,
} from "@medstore/shared";
import { z } from "zod";
import { idParamsSchema, objectId } from "../../utils/idParams.js";
import { indianPhone } from "../../utils/phone.js";

const OUTSIDE_INDIA = "Choose a location in India";

const text = (min, max) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? "Required" : `Use at least ${min} characters`)
    .max(max, `Use at most ${max} characters`);

// Also used by the admin CLI scripts. Stored uppercase.
export const storeCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(STORE_CODE_PATTERN, "Use 2–6 letters or digits");

const minutes = z
  .number()
  .int("Use whole minutes")
  .min(0, "Use minutes after midnight (0–1440)")
  .max(MINUTES_PER_DAY, "Use minutes after midnight (0–1440)");

const storeFields = z.strictObject({
  name: text(STORE_NAME_MIN_LENGTH, STORE_NAME_MAX_LENGTH),
  // Replaced as a whole on update, so leaving out line2 clears it.
  address: z.strictObject({
    line1: text(1, ADDRESS_LINE_MAX_LENGTH),
    line2: text(1, ADDRESS_LINE_MAX_LENGTH).optional(),
    city: text(1, ADDRESS_CITY_MAX_LENGTH),
    pincode: z.string().trim().regex(PINCODE_PATTERN, "Enter a valid 6-digit pincode"),
  }),
  phone: indianPhone(STORE_PHONE_INPUT_PATTERN, "Enter a 10-digit phone number"),
  lat: z.number().min(INDIA_BOUNDS.minLat, OUTSIDE_INDIA).max(INDIA_BOUNDS.maxLat, OUTSIDE_INDIA),
  lng: z.number().min(INDIA_BOUNDS.minLng, OUTSIDE_INDIA).max(INDIA_BOUNDS.maxLng, OUTSIDE_INDIA),
  deliveryRadiusKm: z
    .number()
    .min(DELIVERY_RADIUS_MIN_KM, `Use at least ${DELIVERY_RADIUS_MIN_KM} km`)
    .max(DELIVERY_RADIUS_MAX_KM, `Use at most ${DELIVERY_RADIUS_MAX_KM} km`)
    .refine((km) => Math.round(km * 10) / 10 === km, "Use at most one decimal"),
  openingMinutes: minutes,
  closingMinutes: minutes,
  deliveryFeePaise: z
    .number()
    .int("Use whole paise")
    .min(0, "Can't be negative")
    .max(DELIVERY_FEE_MAX_PAISE, `Use at most ${DELIVERY_FEE_MAX_PAISE} paise`),
  isAcceptingOrders: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

// Hours never span midnight. 24-hour stores (0–1440) are future work (root 3.3).
const closesAfterOpening = (body) =>
  body.openingMinutes === undefined ||
  body.closingMinutes === undefined ||
  body.openingMinutes < body.closingMinutes;

const notAllDay = (body) => !(body.openingMinutes === 0 && body.closingMinutes === MINUTES_PER_DAY);

const together = (body, a, b) => (body[a] === undefined) === (body[b] === undefined);

export const createStoreSchema = {
  body: storeFields
    .extend({ code: storeCode })
    .refine(closesAfterOpening, {
      message: "Closing time must be after opening time",
      path: ["closingMinutes"],
    })
    .refine(notAllDay, {
      message: "24-hour stores aren't supported yet",
      path: ["closingMinutes"],
    }),
};

// `code` is not a field here, so the strict schema rejects it: it can never change.
export const updateStoreSchema = {
  params: idParamsSchema,
  body: storeFields
    .partial()
    .refine((body) => together(body, "lat", "lng"), {
      message: "Send lat and lng together",
      path: ["lng"],
    })
    .refine((body) => together(body, "openingMinutes", "closingMinutes"), {
      message: "Send openingMinutes and closingMinutes together",
      path: ["closingMinutes"],
    })
    .refine(closesAfterOpening, {
      message: "Closing time must be after opening time",
      path: ["closingMinutes"],
    })
    .refine(notAllDay, {
      message: "24-hour stores aren't supported yet",
      path: ["closingMinutes"],
    })
    .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" }),
};

export const listCustomerStoresSchema = {
  query: z.strictObject({ addressId: objectId }),
};
