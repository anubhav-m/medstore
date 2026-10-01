import { sendSuccess } from "../../utils/sendSuccess.js";
import * as uploadService from "./upload.service.js";

export const createPrescriptionUploadUrl = async (req, res, next) => {
  try {
    const upload = await uploadService.createPrescriptionUploadUrl(req.user.id, req.validated.body);
    return sendSuccess(res, { message: "Upload URL created", data: upload });
  } catch (error) {
    return next(error);
  }
};
