import { ErrorCodes } from "@medstore/shared";
import { SubjectKind } from "../modules/auth/refreshToken.model.js";
import { verifyAccessToken } from "../modules/auth/session.service.js";
import { Admin } from "../modules/admins/admin.model.js";
import { accountDisabled } from "../modules/admins/admin.service.js";
import { AppError, invalidToken } from "../utils/AppError.js";

// The admin is loaded on every request (there are only a few), so disabling an account,
// requiring a password change or changing the role or stores applies immediately, whatever the
// token says.
const createAuthAdmin =
  ({ allowPendingPasswordChange }) =>
  async (req, _res, next) => {
    try {
      const adminId = verifyAccessToken(req.get("authorization"), SubjectKind.ADMIN);
      const admin = await Admin.findById(adminId, {
        isActive: 1,
        mustChangePassword: 1,
        role: 1,
        storeIds: 1,
      }).lean();
      if (!admin) throw invalidToken();
      if (!admin.isActive) throw accountDisabled();
      if (admin.mustChangePassword && !allowPendingPasswordChange) {
        throw new AppError(
          "Change your password to continue",
          403,
          ErrorCodes.PASSWORD_CHANGE_REQUIRED,
        );
      }

      req.admin = { id: adminId, role: admin.role, storeIds: admin.storeIds };
      return next();
    } catch (error) {
      return next(error);
    }
  };

export const authAdmin = createAuthAdmin({ allowPendingPasswordChange: false });

// Only change-password and GET /me (logout needs no access token).
export const authAdminAllowPasswordChange = createAuthAdmin({ allowPendingPasswordChange: true });
