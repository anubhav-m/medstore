export const MAX_ORDER_IMAGES = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;
export const MAX_BILL_ITEMS = 50;
export const MAX_OPEN_ORDERS = 3;
export const CUSTOMER_NOTE_MAX_LENGTH = 500;
export const PATIENT_NAME_MIN_LENGTH = 2;
export const PATIENT_NAME_MAX_LENGTH = 100;

export const EMAIL_MAX_LENGTH = 254;
export const CUSTOMER_PASSWORD_MIN_LENGTH = 8;
export const CUSTOMER_PASSWORD_MAX_LENGTH = 128;
export const OTP_CODE_LENGTH = 6;
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
export const CODE_RESEND_COOLDOWN_SECONDS = 60;
export const CODE_SENDS_PER_EMAIL_PER_HOUR = 5;
