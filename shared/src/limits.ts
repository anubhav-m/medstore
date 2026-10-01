export const MAX_ORDER_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];
// Signed upload URLs issued per customer; the day is the IST calendar day.
export const UPLOAD_URLS_PER_HOUR = 20;
export const UPLOAD_URLS_PER_IST_DAY = 30;
export const MAX_BILL_ITEMS = 50;
export const BILL_ITEM_NAME_MIN_LENGTH = 2;
export const BILL_ITEM_NAME_MAX_LENGTH = 100;
export const BILL_ITEM_MAX_QUANTITY = 999;
export const BILL_UNIT_PRICE_MAX_PAISE = 10_000_000;
// Admin order search (`q`) and item-name suggestions.
export const SEARCH_QUERY_MAX_LENGTH = 50;
export const MAX_ITEM_SUGGESTIONS = 10;
export const MAX_OPEN_ORDERS = 3;
export const CUSTOMER_NOTE_MAX_LENGTH = 500;
export const PATIENT_NAME_MIN_LENGTH = 2;
export const PATIENT_NAME_MAX_LENGTH = 100;
export const REASON_NOTE_MAX_LENGTH = 300;
// Prescription photos are viewed through signed URLs valid for at most this long.
export const SIGNED_VIEW_URL_TTL_SECONDS = 600;
// Push tokens per customer or admin account (one per device); the oldest is dropped beyond it.
export const MAX_PUSH_TOKENS_PER_ACCOUNT = 10;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const EMAIL_MAX_LENGTH = 254;
export const CUSTOMER_PASSWORD_MIN_LENGTH = 8;
export const CUSTOMER_PASSWORD_MAX_LENGTH = 128;
export const OTP_CODE_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const CODE_RESEND_COOLDOWN_SECONDS = 60;
export const CODE_SENDS_PER_EMAIL_PER_HOUR = 5;

export const ADMIN_USERNAME_MIN_LENGTH = 3;
export const ADMIN_USERNAME_MAX_LENGTH = 30;
export const ADMIN_USERNAME_PATTERN = /^[a-z0-9._]+$/;
export const ADMIN_NAME_MIN_LENGTH = 2;
export const ADMIN_NAME_MAX_LENGTH = 80;
// Longer than customers': admins can see every customer's health data.
export const ADMIN_PASSWORD_MIN_LENGTH = 12;
export const ADMIN_PASSWORD_MAX_LENGTH = 128;

export const CUSTOMER_NAME_MIN_LENGTH = 2;
export const CUSTOMER_NAME_MAX_LENGTH = 80;
// Applied after removing spaces and dashes; the capture group is the 10-digit number, stored as
// `+91XXXXXXXXXX`.
export const INDIAN_MOBILE_INPUT_PATTERN = /^(?:\+91|0)?([6-9]\d{9})$/;
export const INDIAN_PHONE_PREFIX = "+91";
// Earliest accepted date of birth (inclusive); it must also be before today in IST.
export const DOB_MIN = "1900-01-01";

export const MAX_ADDRESSES = 10;
export const ADDRESS_LABEL_MAX_LENGTH = 30;
export const ADDRESS_LINE_MAX_LENGTH = 120;
export const ADDRESS_LANDMARK_MAX_LENGTH = 120;
export const ADDRESS_CITY_MAX_LENGTH = 60;
export const PINCODE_PATTERN = /^[1-9]\d{5}$/;
// Address pins outside this box are rejected.
export const INDIA_BOUNDS = { minLat: 6.4, maxLat: 37.6, minLng: 68.1, maxLng: 97.5 } as const;

export const STORE_CODE_PATTERN = /^[A-Z0-9]{2,6}$/;
export const STORE_NAME_MIN_LENGTH = 2;
export const STORE_NAME_MAX_LENGTH = 80;
// Mobiles and landlines (with STD code) are both 10 digits. Applied after removing spaces and
// dashes; the capture group is stored as `+91XXXXXXXXXX`.
export const STORE_PHONE_INPUT_PATTERN = /^(?:\+91|0)?([1-9]\d{9})$/;
export const DELIVERY_RADIUS_MIN_KM = 0.5;
export const DELIVERY_RADIUS_MAX_KM = 50;
// Store hours are minutes after midnight IST, 0–1440, opening < closing.
export const MINUTES_PER_DAY = 1440;
export const DELIVERY_FEE_MAX_PAISE = 100_000;
