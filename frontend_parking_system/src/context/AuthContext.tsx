import { createContext, useContext, useState, type ReactNode } from "react";
import { api, type AuthTokens, type AuthUser } from "../services/api";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (userName: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  getRedirectPath: (targetUser?: AuthUser | null) => string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Giải mã payload Base64Url của JWT token an toàn trong trình duyệt
 */
export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Trích xuất các claims chuẩn và vai trò từ JWT access token
 */
export function extractUserFromToken(token: string, fallbackUserName = ""): AuthUser {
  const payload = parseJwtPayload(token);
  if (!payload) {
    return {
      userName: fallbackUserName,
      fullName: fallbackUserName,
      roles: [],
    };
  }

  // Trích xuất roles từ các dạng claim phổ biến của ASP.NET Core & RFC
  const rawRole =
    payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] ??
    payload["role"] ??
    payload["roles"] ??
    payload["Role"];

  let roles: string[] = [];
  if (Array.isArray(rawRole)) {
    roles = rawRole.map((r) => String(r).trim()).filter(Boolean);
  } else if (typeof rawRole === "string" && rawRole.trim()) {
    roles = [rawRole.trim()];
  }

  const userId =
    (payload["sub"] as string) ??
    (payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] as string) ??
    (payload["nameid"] as string);

  const email =
    (payload["email"] as string) ??
    (payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] as string) ??
    fallbackUserName;

  const fullName =
    (payload["name"] as string) ??
    (payload["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] as string) ??
    (payload["unique_name"] as string) ??
    email ??
    fallbackUserName;

  return {
    userId,
    userName: email || fallbackUserName,
    email,
    fullName,
    role: roles[0],
    roles,
  };
}

/**
 * Xác định trang đích dựa trên vai trò của tài khoản
 * - ADMIN / PARKING_MANAGER -> /manager/dashboard (Admin Dashboard)
 * - PARKING_STAFF -> /staff/dashboard (Staff Dashboard)
 * - CUSTOMER / Khách -> / (Trang chủ)
 */
export function getRedirectPathForUser(targetUser?: AuthUser | null): string {
  if (!targetUser) return "/";
  const allRoles = [
    ...(targetUser.roles ?? []),
    ...(targetUser.role ? [targetUser.role] : []),
  ].map((r) => r.trim().toUpperCase());

  // 1. Tài khoản Quản trị viên (Admin) hoặc Quản lý (Manager)
  if (allRoles.some((r) => r.includes("ADMIN") || r.includes("MANAGER"))) {
    return "/manager/dashboard";
  }

  // 2. Tài khoản Nhân viên vận hành bãi (Staff)
  if (allRoles.some((r) => r.includes("STAFF"))) {
    return "/staff/dashboard";
  }

  // 3. Khách hàng hoặc tài khoản thông thường
  return "/";
}

function getSavedUser(): AuthUser | null {
  const savedUser = sessionStorage.getItem("parking.user");
  const token = sessionStorage.getItem("parking.accessToken");

  let parsed: AuthUser | null = null;
  if (savedUser) {
    try {
      parsed = JSON.parse(savedUser) as AuthUser;
    } catch {
      sessionStorage.removeItem("parking.user");
    }
  }

  // Nếu người dùng đã lưu nhưng chưa có vai trò mà còn token hợp lệ, giải mã bù roles từ token
  if (token) {
    const fromToken = extractUserFromToken(token, parsed?.userName || "");
    if (fromToken.roles && fromToken.roles.length > 0) {
      parsed = {
        ...(parsed ?? {}),
        userId: parsed?.userId ?? fromToken.userId,
        userName: parsed?.userName ?? fromToken.userName,
        email: parsed?.email ?? fromToken.email,
        fullName: parsed?.fullName ?? fromToken.fullName,
        role: parsed?.role ?? fromToken.role,
        roles: Array.from(new Set([...(parsed?.roles ?? []), ...fromToken.roles])),
      };
      sessionStorage.setItem("parking.user", JSON.stringify(parsed));
    }
  }

  return parsed;
}

function normalizeUser(tokens: AuthTokens, userName: string): AuthUser {
  const accessToken = tokens.accessToken ?? tokens.token;
  const tokenUser = accessToken ? extractUserFromToken(accessToken, userName) : null;

  const mergedRoles = Array.from(
    new Set([
      ...(tokenUser?.roles ?? []),
      ...(tokens.user?.roles ?? []),
      ...(tokens.roles ?? []),
      ...(tokens.user?.role ? [tokens.user.role] : []),
      ...(tokens.role ? [tokens.role] : []),
    ].map((r) => r.trim()).filter(Boolean))
  );

  return {
    userId: tokens.user?.userId ?? tokens.userId ?? tokenUser?.userId,
    userName: tokens.user?.userName ?? tokens.userName ?? tokenUser?.userName ?? userName,
    email: tokens.user?.email ?? tokens.email ?? tokens.emailNormalized ?? tokenUser?.email ?? userName,
    fullName: tokens.user?.fullName ?? tokens.fullName ?? tokenUser?.fullName ?? userName,
    role: mergedRoles[0] ?? tokenUser?.role ?? tokens.user?.role ?? tokens.role,
    roles: mergedRoles,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getSavedUser);

  const login = async (userName: string, password: string): Promise<AuthUser> => {
    const response = await api.login(userName, password);
    const accessToken = response.accessToken ?? response.token;
    if (!accessToken) {
      throw new Error("Máy chủ không trả access token. Vui lòng kiểm tra cấu hình API đăng nhập.");
    }

    sessionStorage.setItem("parking.accessToken", accessToken);
    if (response.refreshToken) {
      sessionStorage.setItem("parking.refreshToken", response.refreshToken);
    }

    let authenticatedUser = normalizeUser(response, userName);

    // Thử truy vấn thông tin chi tiết qua GET /api/v1/account/information nếu backend sẵn sàng
    try {
      const accountInfo = await api.getAccountInformation();
      if (accountInfo) {
        const serverRoles = (accountInfo.roles ?? []).map((r) => r.trim()).filter(Boolean);
        const combinedRoles = Array.from(
          new Set([...(authenticatedUser.roles ?? []), ...serverRoles])
        );
        authenticatedUser = {
          ...authenticatedUser,
          userId: accountInfo.id ?? authenticatedUser.userId,
          fullName: accountInfo.fullName ?? authenticatedUser.fullName,
          email: accountInfo.emailNormalized ?? authenticatedUser.email,
          role: combinedRoles[0] ?? authenticatedUser.role,
          roles: combinedRoles,
        };
      }
    } catch {
      // Nếu API profile chưa phản hồi kịp, thông tin đã được trích xuất đầy đủ từ JWT claims
    }

    sessionStorage.setItem("parking.user", JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
    return authenticatedUser;
  };

  const logout = async () => {
    try {
      if (sessionStorage.getItem("parking.accessToken")) await api.logout();
    } catch {
      // Clear the local session even while the backend logout endpoint is unavailable.
    } finally {
      sessionStorage.removeItem("parking.accessToken");
      sessionStorage.removeItem("parking.refreshToken");
      sessionStorage.removeItem("parking.user");
      setUser(null);
    }
  };

  const getRedirectPath = (targetUser?: AuthUser | null) => {
    return getRedirectPathForUser(targetUser !== undefined ? targetUser : user);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        login,
        logout,
        getRedirectPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
