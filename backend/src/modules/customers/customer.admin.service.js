import { ErrorCodes } from "@medstore/shared";
import { AppError } from "../../utils/AppError.js";
import { User } from "../users/user.model.js";

const BLOCK_FIELDS = { isBlocked: 1, blockedAt: 1, blockReason: 1 };

// Blocking stops new uploads, orders and reorders (root 3.2); sessions and existing orders are
// left alone. Blocking again replaces the time, admin and reason.
export const setBlocked = async (adminId, customerId, { isBlocked, reason }) => {
  const fields = isBlocked
    ? { isBlocked, blockedAt: new Date(), blockedBy: adminId, blockReason: reason ?? null }
    : { isBlocked, blockedAt: null, blockedBy: null, blockReason: null };
  const user = await User.findByIdAndUpdate(
    customerId,
    { $set: fields },
    { returnDocument: "after", projection: BLOCK_FIELDS },
  ).lean();
  if (!user) throw new AppError("Customer not found", 404, ErrorCodes.CUSTOMER_NOT_FOUND);
  return {
    id: String(user._id),
    isBlocked: user.isBlocked,
    blockedAt: user.blockedAt,
    blockReason: user.blockReason,
  };
};
