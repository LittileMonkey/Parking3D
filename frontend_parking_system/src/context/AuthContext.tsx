import { createContext, useContext, useState, type ReactNode } from "react";
import { api, type AuthTokens, type AuthUser } from "../services/api";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (userName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getSavedUser(): AuthUser | null {
  const savedUser = sessionStorage.getItem("parking.user");
  if (!savedUser) return null;
  try {
    return JSON.parse(savedUser) as AuthUser;
  } catch {
    sessionStorage.removeItem("parking.user");
    return null;
  }
}

function normalizeUser(tokens: AuthTokens, userName: string): AuthUser {
  return {
    ...(tokens.user ?? {}),
    userName: tokens.user?.userName ?? tokens.userName ?? userName,
    email: tokens.user?.email ?? tokens.email,
    fullName: tokens.user?.fullName ?? tokens.fullName ?? userName,
    role: tokens.user?.role ?? tokens.role,
    roles: tokens.user?.roles ?? tokens.roles ?? [],
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(getSavedUser);

  const login = async (userName: string, password: string) => {
    const response = await api.login(userName, password);
    const accessToken = response.accessToken ?? response.token;
    if (!accessToken) {
      throw new Error("Máy chủ không trả access token. Vui lòng kiểm tra cấu hình API đăng nhập.");
    }

    const authenticatedUser = normalizeUser(response, userName);
    sessionStorage.setItem("parking.accessToken", accessToken);
    if (response.refreshToken) sessionStorage.setItem("parking.refreshToken", response.refreshToken);
    sessionStorage.setItem("parking.user", JSON.stringify(authenticatedUser));
    setUser(authenticatedUser);
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

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}