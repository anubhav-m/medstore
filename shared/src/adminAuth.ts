import type { AdminRole } from "./adminRoles.js";
import type { StoreSummary } from "./stores.js";

export interface AdminLoginRequest {
  username: string;
  password: string;
}

export interface AdminChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthAdmin {
  id: string;
  username: string;
  name: string;
  role: AdminRole;
  storeIds: string[];
  mustChangePassword: boolean;
}

/** `data` of admin login, refresh and change-password. Refresh and logout take `RefreshRequest` / `LogoutRequest`. */
export interface AdminAuthSession {
  accessToken: string;
  /** ISO 8601 */
  accessTokenExpiresAt: string;
  refreshToken: string;
  admin: AuthAdmin;
}

/** `data` of admin GET /me. `stores` are the admin's stores (owner: all, including inactive), by code. */
export interface AdminMeResponse {
  admin: AuthAdmin;
  stores: StoreSummary[];
}
