import type { TextInputProps } from "react-native";
import { formatPhoneInput } from "../../format/formatPhone";

export type InputVariant =
  "text" | "multiline" | "phone" | "password" | "code" | "money" | "search";

const PHONE_DIGITS = 10;
const CODE_DIGITS = 6;
const COUNTRY_CODE = "91";

/** Typed or pasted text → at most 10 digits. Accepts +91 or 0 in front, spaces and dashes. */
export function normalisePhoneDigits(text: string): string {
  let digits = text.replace(/\D/g, "");
  if (digits.length > PHONE_DIGITS && digits.startsWith(COUNTRY_CODE))
    digits = digits.slice(COUNTRY_CODE.length);
  if (digits.length > PHONE_DIGITS && digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, PHONE_DIGITS);
}

/** Rupees as typed: digits and one point, at most two decimals. Paise come from parsing this string. */
function sanitiseRupees(text: string): string {
  const [whole = "", ...rest] = text.replace(/[^\d.]/g, "").split(".");
  return rest.length === 0 ? whole : `${whole}.${rest.join("").slice(0, 2)}`;
}

interface VariantBehaviour {
  native: Partial<TextInputProps>;
  /** Shown before the text: "+91" for phone, "₹" for money. */
  prefix?: string;
  /** The value as stored → the text the field shows. */
  display?: (value: string) => string;
  /** The text typed → the value passed to onChangeText. */
  sanitise?: (text: string) => string;
}

export const inputVariants: Record<InputVariant, VariantBehaviour> = {
  text: { native: {} },
  multiline: { native: { multiline: true, textAlignVertical: "top" } },
  phone: {
    native: {
      keyboardType: "phone-pad",
      autoComplete: "tel-national",
      textContentType: "telephoneNumber",
    },
    prefix: "+91",
    display: formatPhoneInput,
    sanitise: normalisePhoneDigits,
  },
  password: { native: { secureTextEntry: true, autoCapitalize: "none", autoCorrect: false } },
  code: {
    native: {
      keyboardType: "number-pad",
      autoComplete: "email-otp",
      textContentType: "oneTimeCode",
      maxLength: CODE_DIGITS,
    },
    sanitise: (text) => text.replace(/\D/g, "").slice(0, CODE_DIGITS),
  },
  money: {
    native: { keyboardType: "decimal-pad", textAlign: "right" },
    prefix: "₹",
    sanitise: sanitiseRupees,
  },
  search: { native: { returnKeyType: "search", autoCorrect: false, autoCapitalize: "none" } },
};
