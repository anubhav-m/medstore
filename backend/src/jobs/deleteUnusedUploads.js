import { Order } from "../modules/orders/order.model.js";
import { Upload } from "../modules/uploads/upload.model.js";
import { removeObjects } from "../services/storage.js";
import { skipWhileRunning, startJob } from "./schedule.js";

const HOUR_MS = 60 * 60 * 1000;
// Root 3.5. Upload URLs are valid for 2 hours, so nothing can still arrive at an older path.
const UNUSED_FOR_MS = 24 * HOUR_MS;
// Bounds one run (a storage delete takes at most 1000 paths); the rest wait for the next tick.
const BATCH_SIZE = 500;

/**
 * Deletes up to one batch of uploads never attached to an order and created more than 24 hours
 * before `now`: each record is claimed with a conditional delete first, so an order created at
 * the same moment either attached it (and it stays) or finds it gone (INVALID_UPLOAD, checked
 * inside the creation transaction). Then the objects go in one storage call; if that fails, the
 * records are put back so the next run retries. An image any order references is never deleted.
 */
export const deleteUnusedUploads = async (now = new Date()) => {
  const candidates = await Upload.find({
    attachedAt: null,
    createdAt: { $lte: new Date(now.getTime() - UNUSED_FOR_MS) },
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .lean();
  const referenced = new Set(
    await Order.distinct("images.path", {
      "images.path": { $in: candidates.map((upload) => upload.path) },
    }),
  );

  const claimed = [];
  for (const upload of candidates) {
    if (referenced.has(upload.path)) continue;
    const { deletedCount } = await Upload.deleteOne({ _id: upload._id, attachedAt: null });
    if (deletedCount === 1) claimed.push(upload);
  }
  // Used by an order but never marked: mark it, so it isn't picked up again.
  if (referenced.size > 0) {
    await Upload.updateMany(
      { path: { $in: [...referenced] }, attachedAt: null },
      { $set: { attachedAt: now } },
    );
  }
  if (claimed.length === 0) return { deleted: 0 };

  try {
    await removeObjects(claimed.map((upload) => upload.path));
  } catch (error) {
    // Raw insert, so the records come back exactly as they were (createdAt included).
    await Upload.collection.insertMany(claimed);
    throw error;
  }
  return { deleted: claimed.length };
};

export const startUnusedUploadsJob = () =>
  startJob("unused uploads", skipWhileRunning(deleteUnusedUploads), HOUR_MS);
