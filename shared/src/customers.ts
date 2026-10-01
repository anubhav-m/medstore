/**
 * PATCH /admin/customers/:id/block (owner only). `reason` (1–300 chars) only when blocking;
 * unblocking clears the reason and the other block fields.
 */
export interface BlockCustomerRequest {
  isBlocked: boolean;
  reason?: string;
}

/** A customer's block state, without any other customer data. */
export interface CustomerBlockState {
  id: string;
  isBlocked: boolean;
  /** ISO 8601; null when not blocked */
  blockedAt: string | null;
  blockReason: string | null;
}

/** `data` of PATCH /admin/customers/:id/block. */
export interface BlockCustomerResponse {
  customer: CustomerBlockState;
}
