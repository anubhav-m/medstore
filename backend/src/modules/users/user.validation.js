import {
  CUSTOMER_NAME_MAX_LENGTH,
  CUSTOMER_PASSWORD_MAX_LENGTH,
  CUSTOMER_NAME_MIN_LENGTH,
  DOB_MIN,
  Gender,
  INDIAN_MOBILE_INPUT_PATTERN,
} from "@medstore/shared";
import { z } from "zod";
import { indianPhone } from "../../utils/phone.js";
import { istDateString } from "../../utils/time.js";
import { addressInput } from "../addresses/address.validation.js";

const PHONE_INVALID = "Enter a 10-digit mobile number";

const name = z
  .string()
  .trim()
  .min(CUSTOMER_NAME_MIN_LENGTH, `Use at least ${CUSTOMER_NAME_MIN_LENGTH} characters`)
  .max(CUSTOMER_NAME_MAX_LENGTH, `Use at most ${CUSTOMER_NAME_MAX_LENGTH} characters`);

// Accepts 9876543210, +919876543210 or 09876543210, with spaces or dashes.
const phone = indianPhone(INDIAN_MOBILE_INPUT_PATTERN, PHONE_INVALID);

// YYYY-MM-DD strings compare correctly as text. Stored as UTC midnight of that date.
const dob = z.iso
  .date("Enter the date as YYYY-MM-DD")
  .refine(
    (value) => value >= DOB_MIN && value < istDateString(new Date()),
    "Enter a valid date of birth",
  )
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const updateMeSchema = {
  body: z
    .strictObject({
      name: name.optional(),
      phone: phone.optional(),
      dob: dob.nullable().optional(),
      gender: z.enum(Gender).nullable().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" }),
};

export const onboardingSchema = {
  body: z.strictObject({
    name,
    phone,
    address: addressInput,
    consentAccepted: z.literal(true, { error: "Accept the terms and privacy policy to continue" }),
  }),
};

// Exactly one way to re-authenticate. The password is bounded only, like at login.
export const deleteAccountSchema = {
  body: z
    .strictObject({
      password: z.string().min(1).max(CUSTOMER_PASSWORD_MAX_LENGTH).optional(),
      googleIdToken: z.string().min(1).max(4096).optional(),
    })
    .refine((body) => (body.password === undefined) !== (body.googleIdToken === undefined), {
      message: "Confirm with your password or Google account",
    }),
};
