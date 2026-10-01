const GROUPED = new Intl.NumberFormat("en-IN");

// Display only: "₹1,234" or "₹1,234.50" from integer paise, keeping the paise part in integer
// arithmetic (root 3.4).
export const formatRupees = (paise) => {
  const rupees = GROUPED.format(Math.floor(paise / 100));
  const rest = paise % 100;
  return `₹${rupees}${rest === 0 ? "" : `.${String(rest).padStart(2, "0")}`}`;
};
