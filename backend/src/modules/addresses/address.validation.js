import {
  ADDRESS_CITY_MAX_LENGTH,
  ADDRESS_LABEL_MAX_LENGTH,
  ADDRESS_LANDMARK_MAX_LENGTH,
  ADDRESS_LINE_MAX_LENGTH,
  INDIA_BOUNDS,
  PINCODE_PATTERN,
} from "@medstore/shared";
import { z } from "zod";
import { idParamsSchema } from "../../utils/idParams.js";

const OUTSIDE_INDIA = "Choose a location in India";

const text = (max) =>
  z.string().trim().min(1, "Required").max(max, `Use at most ${max} characters`);

const optionalLine2 = text(ADDRESS_LINE_MAX_LENGTH).optional();
const optionalLandmark = text(ADDRESS_LANDMARK_MAX_LENGTH).optional();

// Also the first address in onboarding.
export const addressInput = z.strictObject({
  label: text(ADDRESS_LABEL_MAX_LENGTH),
  line1: text(ADDRESS_LINE_MAX_LENGTH),
  line2: optionalLine2,
  landmark: optionalLandmark,
  city: text(ADDRESS_CITY_MAX_LENGTH),
  pincode: z.string().trim().regex(PINCODE_PATTERN, "Enter a valid 6-digit pincode"),
  lat: z.number().min(INDIA_BOUNDS.minLat, OUTSIDE_INDIA).max(INDIA_BOUNDS.maxLat, OUTSIDE_INDIA),
  lng: z.number().min(INDIA_BOUNDS.minLng, OUTSIDE_INDIA).max(INDIA_BOUNDS.maxLng, OUTSIDE_INDIA),
});

export const createAddressSchema = {
  body: addressInput.extend({ isDefault: z.boolean().optional() }),
};

export const updateAddressSchema = {
  params: idParamsSchema,
  body: addressInput
    .partial()
    .extend({
      line2: optionalLine2.nullable(),
      landmark: optionalLandmark.nullable(),
      // The default can only be moved to another address, never unset.
      isDefault: z.literal(true).optional(),
    })
    .refine((body) => (body.lat === undefined) === (body.lng === undefined), {
      message: "Send lat and lng together",
      path: ["lng"],
    })
    .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" }),
};

export const deleteAddressSchema = { params: idParamsSchema };
