import { SubjectKind } from "../modules/auth/refreshToken.model.js";
import { invalidToken, verifyAccessToken } from "../modules/auth/session.service.js";
import { User } from "../modules/users/user.model.js";

export const authCustomer = async (req, _res, next) => {
  try {
    const userId = verifyAccessToken(req.get("authorization"), SubjectKind.CUSTOMER);
    if (!(await User.exists({ _id: userId }))) throw invalidToken();

    req.user = { id: userId };
    return next();
  } catch (error) {
    return next(error);
  }
};
