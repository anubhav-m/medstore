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

const MINUTE_MS = 60_000;

// IST is a fixed UTC+05:30 with no DST, so an IST wall-clock time maps to one instant.
export const istDayStart = (now) => new Date(`${istDateString(now)}T00:00:00.000+05:30`);

// Whole minutes since IST midnight (0–1439).
export const istMinutesOfDay = (now) => Math.floor((now - istDayStart(now)) / MINUTE_MS);

export const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * MINUTE_MS);

const IST_TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

// e.g. "6:30 pm": the IST wall-clock time of `date`, for notification texts.
export const istTimeString = (date) => IST_TIME.format(date);
