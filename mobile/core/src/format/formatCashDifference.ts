import { formatCurrency, formatCurrencySpoken } from "./formatCurrency";

export interface CashDifference {
  /** "Matches", "+₹50.00 extra" or "−₹50.00 short". */
  text: string;
  /** The same for TalkBack: "50 rupees short". */
  spoken: string;
  /** match is shown in green; extra and short in rust with the warning icon. */
  kind: "match" | "extra" | "short";
}

/** A daily report's collected − expected cash, in integer paise, as the report shows it. */
export function formatCashDifference(differencePaise: number): CashDifference {
  if (differencePaise === 0) return { text: "Matches", spoken: "Matches", kind: "match" };
  if (differencePaise > 0) {
    return {
      text: `+${formatCurrency(differencePaise)} extra`,
      spoken: `${formatCurrencySpoken(differencePaise)} extra`,
      kind: "extra",
    };
  }
  return {
    text: `${formatCurrency(differencePaise)} short`,
    spoken: `${formatCurrencySpoken(-differencePaise)} short`,
    kind: "short",
  };
}
