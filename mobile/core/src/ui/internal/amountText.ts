import { formatCurrency, formatCurrencySpoken } from "../../format/formatCurrency";

const MISSING = { text: "—", spoken: "Amount not available" } as const;

/**
 * The text and spoken label for an amount. A value that isn't whole paise (missing from the response,
 * a float) shows a dash rather than a wrong or crashing amount: one bad field never takes down the
 * whole screen.
 */
export function amountText(paise: number): { text: string; spoken: string } {
  if (!Number.isSafeInteger(paise)) return MISSING;
  return { text: formatCurrency(paise), spoken: formatCurrencySpoken(paise) };
}
