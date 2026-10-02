import { ErrorCodes } from "@medstore/shared";
import { verifyImageObject } from "../../services/storage.js";
import { AppError } from "../../utils/AppError.js";
import { Upload } from "../uploads/upload.model.js";

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const invalidUpload = () =>
  new AppError(
    "A prescription photo couldn't be used. Please upload it again.",
    422,
    ErrorCodes.INVALID_UPLOAD,
  );

// Creation check 5 (root 3.4), for new orders and reorders. `paths` are distinct. Each must have
// exactly the shape the server issues, have been issued to this customer, and exist in storage as
// a real image of the type it was issued for.
export const verifyOrderImages = async (userId, paths) => {
  const pattern = new RegExp(`^${userId}/${UUID}\\.(jpg|png)$`);
  if (!paths.every((path) => pattern.test(path))) throw invalidUpload();

  const uploads = await Upload.find(
    { userId, path: { $in: paths } },
    { path: 1, contentType: 1 },
  ).lean();
  if (uploads.length !== paths.length) throw invalidUpload();

  const verified = await Promise.all(
    uploads.map((upload) => verifyImageObject(upload.path, upload.contentType)),
  );
  if (!verified.every(Boolean)) throw invalidUpload();
};
