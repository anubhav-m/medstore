const STORED_PHONE_PATTERN = /^\+91(\d{5})(\d{5})$/;

/** "+919876543210" (as stored) → "+91 98765 43210". Anything else is returned unchanged. */
export function formatPhone(phone: string): string {
  const match = STORED_PHONE_PATTERN.exec(phone);
  return match ? `+91 ${match[1]} ${match[2]}` : phone;
}

/** Up to 10 typed digits → "98765 43210", for the phone input while typing. */
export function formatPhoneInput(digits: string): string {
  return digits.length > 5 ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}
