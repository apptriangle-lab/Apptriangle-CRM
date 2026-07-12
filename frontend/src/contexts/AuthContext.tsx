import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { User } from "@/data/mockData";
import { authApi, usersApi } from "@/lib/api";

const STORAGE_USER = "crm_user";
const STORAGE_TOKEN = "crm_token";

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (updates: { name?: string; phone?: string }) => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function loadStored(): { user: User | null; token: string | null } {
  try {
    const rawUser = localStorage.getItem(STORAGE_USER);
    const token = localStorage.getItem(STORAGE_TOKEN);
    if (!rawUser || !token) return { user: null, token: null };
    const user = JSON.parse(rawUser) as User;
    if (!user?.id || !user?.email) return { user: null, token: null };
    return { user, token };
  } catch {
    return { user: null, token: null };
  }
}

function clearStorage() {
  localStorage.removeItem(STORAGE_USER);
  localStorage.removeItem(STORAGE_TOKEN);
  localStorage.removeItem("crm_expiresAt");
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => loadStored().user);
  const tokenRef = useRef<string | null>(null);

  const logout = useCallback(() => {
    const t = tokenRef.current;
    tokenRef.current = null;
    setUser(null);
    clearStorage();
    if (t) authApi.logout(t).catch(() => {});
  }, []);

  useEffect(() => {
    const { user: u, token } = loadStored();
    if (u && token != null) {
      setUser(u);
      tokenRef.current = token;
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await authApi.login(email, password);
      const apiUser = res.user;
      const u: User = {
        id: apiUser.id,
        name: apiUser.name,
        email: apiUser.email,
        phone: apiUser.phone ?? "",
        role: apiUser.role === "admin" ? "admin" : "user",
        isActive: apiUser.isActive,
        createdAt: apiUser.createdAt,
      };
      const token = res.token;

      setUser(u);
      tokenRef.current = token;
      localStorage.setItem(STORAGE_USER, JSON.stringify(u));
      localStorage.setItem(STORAGE_TOKEN, token);
      localStorage.removeItem("crm_expiresAt");

      return true;
    } catch {
      return false;
    }
  }, []);

  const updateProfile = useCallback(async (updates: { name?: string; phone?: string }) => {
    const updated = await usersApi.updateMe(updates);
    const u: User = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone ?? "",
      role: updated.role === "admin" ? "admin" : "user",
      isActive: updated.isActive,
      createdAt: updated.createdAt,
    };
    setUser(u);
    localStorage.setItem(STORAGE_USER, JSON.stringify(u));
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateProfile, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
