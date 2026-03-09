import React, { createContext, useContext, useState, useMemo, useEffect, ReactNode } from "react";
import { apiRequest } from "@/lib/query-client";

export interface AuthUser {
  id: string;
  phone: string;
  displayName: string;
  avatarUrl?: string | null;
  lastSeen?: string | null;
  isOnline?: boolean;
  isAiUser?: boolean;
  hasAiAccess?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, displayName: string, password: string, otp: string) => Promise<void>;
  sendOtp: (phone: string) => Promise<{ devOtp: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { displayName?: string; avatarUrl?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      const data = await res.json();
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async (phone: string): Promise<{ devOtp: string }> => {
    const res = await apiRequest("POST", "/api/auth/send-otp", { phone });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to send OTP");
    return data;
  };

  const login = async (phone: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { phone, password });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setUser(data.user);
  };

  const register = async (phone: string, displayName: string, password: string, otp: string) => {
    const res = await apiRequest("POST", "/api/auth/register", { phone, displayName, password, otp });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    setUser(data.user);
  };

  const logout = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    setUser(null);
  };

  const updateProfile = async (data: { displayName?: string; avatarUrl?: string }) => {
    const res = await apiRequest("PUT", "/api/users/me", data);
    const updated = await res.json();
    setUser(prev => prev ? { ...prev, ...updated } : null);
  };

  const value = useMemo(() => ({ user, isLoading, login, register, sendOtp, logout, updateProfile }), [user, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
