// India has one time zone and no daylight saving, so IST is a fixed offset from UTC. Using it
// directly keeps the result independent of the phone's time-zone setting and Intl data.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface IstParts {
  year: number;
  /** 0–11 */
  month: number;
  day: number;
  /** 0 = Sunday */
  weekday: number;
  hour: number;
  minute: number;
  /** Days since the epoch in IST; equal numbers mean the same IST calendar day. */
  dayNumber: number;
}

export function toInstant(value: Date | string | number): number {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  if (Number.isNaN(ms)) {
    throw new RangeError("Not a valid date.");
  }
  return ms;
}

export function istParts(value: Date | string | number): IstParts {
  const shifted = new Date(toInstant(value) + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    dayNumber: Math.floor(shifted.getTime() / DAY_MS),
  };
}
