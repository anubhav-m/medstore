import { MINUTES_PER_DAY } from "@medstore/shared";
import { addMinutes, istDayStart, istMinutesOfDay } from "../../utils/time.js";

const isWithinHours = (store, now) => {
  const minutes = istMinutesOfDay(now);
  return store.openingMinutes <= minutes && minutes < store.closingMinutes;
};

// The only definition of "open" (root 3.3).
export const isStoreOpen = (store, now) =>
  store.isActive && store.isAcceptingOrders && isWithinHours(store, now);

// Set only when the store is closed because of its hours; null when it is open, paused or
// inactive. Hours never span midnight, so the next opening is today's or tomorrow's.
export const nextOpensAt = (store, now) => {
  if (!store.isActive || !store.isAcceptingOrders || isWithinHours(store, now)) return null;
  const opensTodayAt = addMinutes(istDayStart(now), store.openingMinutes);
  return istMinutesOfDay(now) < store.openingMinutes
    ? opensTodayAt
    : addMinutes(opensTodayAt, MINUTES_PER_DAY);
};
