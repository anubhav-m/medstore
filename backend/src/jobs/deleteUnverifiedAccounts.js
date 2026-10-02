import { OtpCode } from "../modules/auth/otpCode.model.js";
import { User } from "../modules/users/user.model.js";
import { skipWhileRunning, startJob } from "./schedule.js";

const HOUR_MS = 60 * 60 * 1000;
// An unverified account has no sessions, addresses or orders (no tokens are issued before
// verification), so deleting it loses nothing. Registering again updates it and restarts the wait.
const UNVERIFIED_FOR_MS = 7 * 24 * HOUR_MS;
const BATCH_SIZE = 500;

// Deletes up to one batch of accounts still unverified 7 days after their last change. One with a
// live code is kept: its owner may be verifying right now.
export const deleteUnverifiedAccounts = async (now = new Date()) => {
  const stale = {
    emailVerified: false,
    updatedAt: { $lte: new Date(now.getTime() - UNVERIFIED_FOR_MS) },
  };
  const candidates = await User.find(stale, { _id: 1 }).limit(BATCH_SIZE).lean();
  const ids = candidates.map((user) => user._id);
  const withCode = await OtpCode.distinct("userId", {
    userId: { $in: ids },
    expiresAt: { $gt: now },
  });
  const pending = new Set(withCode.map(String));
  const { deletedCount } = await User.deleteMany({
    ...stale,
    _id: { $in: ids.filter((id) => !pending.has(String(id))) },
  });
  return { deleted: deletedCount };
};

export const startUnverifiedAccountsJob = () =>
  startJob("unverified accounts", skipWhileRunning(deleteUnverifiedAccounts), HOUR_MS);
