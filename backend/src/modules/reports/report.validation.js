import { z } from "zod";
import { objectId } from "../../utils/idParams.js";
import { istDateString } from "../../utils/time.js";

// YYYY-MM-DD strings compare correctly as text; today (IST) is the latest date with orders.
export const dailyReportSchema = {
  query: z.strictObject({
    storeId: objectId,
    date: z.iso
      .date("Enter the date as YYYY-MM-DD")
      .refine((value) => value <= istDateString(new Date()), "The date can't be in the future"),
  }),
};
