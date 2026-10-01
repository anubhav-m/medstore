import { sendSuccess } from "../../utils/sendSuccess.js";
import * as reportService from "./report.service.js";

export const getDailyReport = async (req, res, next) => {
  try {
    const report = await reportService.getDailyReport(req.validated.query);
    return sendSuccess(res, { message: "Report loaded", data: { report } });
  } catch (error) {
    return next(error);
  }
};
