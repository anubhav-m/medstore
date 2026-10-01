const IST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// `YYYY-MM-DD` of `now` in IST.
export const istDateString = (now) => {
  const parts = Object.fromEntries(
    IST_DATE.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};
