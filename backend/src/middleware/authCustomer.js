import { SubjectKind } from "../modules/auth/refreshToken.model.js";
import { invalidToken, verifyAccessToken } from "../modules/auth/session.service.js";
import { User } from "../modules/users/user.model.js";

export const authCustomer = async (req, _res, next) => {
  try {
    const userId = verifyAccessToken(req.get("authorization"), SubjectKind.CUSTOMER);
    const user = await User.findById(userId).select("onboardingCompleted").lean();
    if (!user) throw invalidToken();

    req.user = { id: userId, onboardingCompleted: user.onboardingCompleted };
    return next();
  } catch (error) {
    return next(error);
  }
};
