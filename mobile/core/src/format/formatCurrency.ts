const MINUS = "−";
const PAISE_PER_RUPEE = 100;

function assertPaise(paise: number): void {
  if (!Number.isSafeInteger(paise)) {
    throw new RangeError("Money must be an integer number of paise.");
  }
}

/** Indian grouping: the last three digits, then pairs (1,23,45,678). Works on the digit string. */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const lastThree = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const pairs: string[] = [];
  for (let end = rest.length; end > 0; end -= 2) {
    pairs.unshift(rest.slice(Math.max(0, end - 2), end));
  }
  return `${pairs.join(",")},${lastThree}`;
}

function splitPaise(paise: number): { negative: boolean; rupees: string; paise: number } {
  assertPaise(paise);
  const absolute = Math.abs(paise);
  return {
    negative: paise < 0,
    rupees: String(Math.trunc(absolute / PAISE_PER_RUPEE)),
    paise: absolute % PAISE_PER_RUPEE,
  };
}

/**
 * Paise → "₹1,23,456.50". Always two decimals so no amount is ambiguous; negatives use a real
 * minus sign ("−₹20.00"). Integer maths only, so the output never depends on the device's Intl data.
 */
export function formatCurrency(paise: number): string {
  const parts = splitPaise(paise);
  const paiseDigits = String(parts.paise).padStart(2, "0");
  return `${parts.negative ? MINUS : ""}₹${groupIndian(parts.rupees)}.${paiseDigits}`;
}

const INDIAN_UNITS: readonly (readonly [number, string])[] = [
  [10_000_000, "crore"],
  [100_000, "lakh"],
  [1_000, "thousand"],
];

/** 123456 → "1 lakh 23 thousand 456": the way the amount is said aloud in India. */
function spokenIndianNumber(value: number): string {
  if (value === 0) return "0";
  const words: string[] = [];
  let rest = value;
  for (const [size, name] of INDIAN_UNITS) {
    const count = Math.floor(rest / size);
    if (count > 0) words.push(`${count} ${name}`);
    rest %= size;
  }
  if (rest > 0) words.push(String(rest));
  return words.join(" ");
}

/**
 * Paise → "1 lakh 23 thousand 456 rupees 50 paise", the accessibilityLabel for an amount. Each part
 * is a plain number, so TalkBack reads it rather than the commas.
 */
export function formatCurrencySpoken(paise: number): string {
  const parts = splitPaise(paise);
  const sign = parts.negative ? "minus " : "";
  const amount = spokenIndianNumber(Number(parts.rupees));
  const rupees = `${amount} ${parts.rupees === "1" ? "rupee" : "rupees"}`;
  return parts.paise === 0 ? `${sign}${rupees}` : `${sign}${rupees} ${parts.paise} paise`;
}
