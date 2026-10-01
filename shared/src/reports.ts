import type { OrderStatus } from "./orderStatus.js";
import type { StoreSummary } from "./stores.js";

/** GET /admin/reports/daily (owner only). `date`: an IST date, `YYYY-MM-DD`, not in the future. */
export interface DailyReportQuery {
  storeId: string;
  date: string;
}

/** A delivered order whose collected cash differs from its total. */
export interface CashMismatch {
  orderId: string;
  orderNumber: string;
  /** ISO 8601 */
  deliveredAt: string;
  expectedCashPaise: number;
  collectedCashPaise: number;
  /** collected − expected */
  differencePaise: number;
}

/** One store, one IST calendar day (IST midnight to midnight). Money is integer paise. */
export interface DailyReport {
  store: StoreSummary;
  date: string;
  /** Orders created that day, counted by their current status; every status is present. */
  created: {
    total: number;
    byStatus: Record<OrderStatus, number>;
  };
  /** Orders whose `deliveredAt` falls on that day, whenever they were created. */
  delivered: {
    count: number;
    /** Sum of `totalPaise` */
    expectedCashPaise: number;
    /** Sum of `cashCollectedPaise` */
    collectedCashPaise: number;
    /** collected − expected */
    differencePaise: number;
  };
  /** All delivered orders where collected ≠ expected; `cashMismatches` holds the first of them. */
  cashMismatchCount: number;
  /** Oldest delivery first, at most `MAX_REPORT_CASH_MISMATCHES`. */
  cashMismatches: CashMismatch[];
}

/** `data` of GET /admin/reports/daily. */
export interface DailyReportResponse {
  report: DailyReport;
}
