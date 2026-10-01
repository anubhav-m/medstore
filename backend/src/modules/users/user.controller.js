import { sendSuccess } from "../../utils/sendSuccess.js";
import * as userService from "./user.service.js";

export const getMe = async (req, res, next) => {
  try {
    const user = await userService.getMe(req.user.id);
    return sendSuccess(res, { message: "Profile loaded", data: { user } });
  } catch (error) {
    return next(error);
  }
};
