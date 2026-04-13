/**
 * useGasAuth.ts
 * 雙模式認證機制
 *
 * 支援兩種登入方式：
 *   A. Google 帳號登入（Google Identity Services）
 *      → GSI SDK 回傳 id_token JWT
 *      → 前端解析 JWT 取得 email（無需後端驗簽，信任 Google SDK）
 *      → 呼叫 GAS getMyProfile?callerEmail=email
 *
 *   B. 帳號密碼登入
 *      → 前端 SHA-256(密碼) → hex
 *      → POST GAS { action: "passwordLogin", email, passwordHash }
 *      → GAS 比對人員資料「密碼雜湊」欄
 *
 * 使用者資訊結構（localStorage["gas_user"]）：
 *   { id, name, accountType, email, dept, area, workerType, role }
 */

import { useState, useCallback, createContext, useContext } from "react";
import { getGasUrl } from "./gasApi";

const USER_KEY = "gas_user";
const EMAIL_KEY = "gas_caller_email";

export interface GasUser {
  id: string;          // 人員編號
  name: string;        // 姓名
  email: string;       // 電子信箱
  dept: string;        // 所屬部門
  area: string;        // 服務區域
  workerType: string;  // 職務類型（English enum: general/offshore/safety/environment）
  role: "admin" | "deptMgr" | "billing" | "worker";  // 角色（English enum）
}

export function getStoredUser(): GasUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GasUser;
  } catch {
    return null;
  }
}

export function getCallerEmail(): string {
  return localStorage.getItem(EMAIL_KEY) || "";
}

function storeUser(user: GasUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(EMAIL_KEY, user.email);
}

function clearUser(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

// ============================================================
// 工具函式
// ============================================================

/** 解析 Google id_token JWT payload（不驗簽，僅取 email） */
export function parseGoogleJwt(token: string): { email?: string; name?: string; picture?: string } | null {
  try {
    const payload = token.split(".")[1];
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

/** SHA-256 雜湊密碼，回傳 hex string */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/** 以 email 呼叫 GAS getMyProfile，回傳 GasUser 或 null */
async function fetchProfile(email: string): Promise<{ user: GasUser | null; error: string | null }> {
  const gasUrl = getGasUrl();
  if (!gasUrl) return { user: null, error: "GAS URL 未設定，請聯絡管理員。" };

  const qs = new URLSearchParams({ action: "getMyProfile", callerEmail: email });
  const res = await fetch(`${gasUrl}?${qs.toString()}`, { redirect: "follow" });
  if (!res.ok) return { user: null, error: `HTTP ${res.status}` };

  const json = await res.json() as { success: boolean; data?: Record<string, unknown>; error?: string };
  if (!json.success || !json.data) {
    return { user: null, error: json.error || "找不到此帳號，請確認是否已加入人員資料。" };
  }

  const d = json.data;
  const user: GasUser = {
    id: String(d["人員編號"] || ""),
    name: String(d["姓名"] || ""),
    email: String(d["電子信箱"] || email),
    dept: String(d["所屬部門"] || ""),
    area: String(d["服務區域"] || ""),
    workerType: String(d["職務類型"] || "general"),
    role: (String(d["角色"] || "worker")) as GasUser["role"],
  };
  return { user, error: null };
}

// ============================================================
// Hook
// ============================================================

export interface GasAuthState {
  user: GasUser | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

export function useGasAuth() {
  const [state, setState] = useState<GasAuthState>(() => ({
    user: getStoredUser(),
    loading: false,
    error: null,
    isAuthenticated: Boolean(getStoredUser()),
  }));

  /** A. Google 帳號登入：傳入 GSI 回傳的 credential JWT */
  const loginWithGoogle = useCallback(async (credential: string): Promise<boolean> => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const payload = parseGoogleJwt(credential);
      if (!payload?.email) {
        setState(s => ({ ...s, loading: false, error: "無法解析 Google 帳號資訊，請重試。" }));
        return false;
      }
      const { user, error } = await fetchProfile(payload.email);
      if (!user) {
        setState(s => ({ ...s, loading: false, error: error ?? "登入失敗" }));
        return false;
      }
      storeUser(user);
      setState({ user, loading: false, error: null, isAuthenticated: true });
      return true;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: `Google 登入失敗：${String(err)}` }));
      return false;
    }
  }, []);

  /** B. 帳號密碼登入 */
  const loginWithPassword = useCallback(async (email: string, password: string): Promise<boolean> => {
    const gasUrl = getGasUrl();
    if (!gasUrl) {
      setState(s => ({ ...s, error: "GAS URL 未設定，請聯絡管理員。" }));
      return false;
    }
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const passwordHash = await hashPassword(password);
      const res = await fetch(gasUrl, {
        method: "POST",
        redirect: "follow",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "passwordLogin", email, passwordHash }),
      });
      if (!res.ok) {
        setState(s => ({ ...s, loading: false, error: `HTTP ${res.status}` }));
        return false;
      }
      const json = await res.json() as { success: boolean; data?: Record<string, unknown>; error?: string };
      if (!json.success || !json.data) {
        setState(s => ({ ...s, loading: false, error: json.error || "帳號或密碼錯誤。" }));
        return false;
      }
      const d = json.data;
      const user: GasUser = {
        id: String(d["人員編號"] || ""),
        name: String(d["姓名"] || ""),
        email: String(d["電子信箱"] || email),
        dept: String(d["所屬部門"] || ""),
        area: String(d["服務區域"] || ""),
        workerType: String(d["職務類型"] || "general"),
        role: (String(d["角色"] || "worker")) as GasUser["role"],
      };
      storeUser(user);
      setState({ user, loading: false, error: null, isAuthenticated: true });
      return true;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: `登入失敗：${String(err)}` }));
      return false;
    }
  }, []);

  /** 相容舊版 login（以 email 直接查詢，無密碼） */
  const login = useCallback(async (email: string): Promise<boolean> => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const { user, error } = await fetchProfile(email);
      if (!user) {
        setState(s => ({ ...s, loading: false, error: error ?? "登入失敗" }));
        return false;
      }
      storeUser(user);
      setState({ user, loading: false, error: null, isAuthenticated: true });
      return true;
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: `登入失敗：${String(err)}` }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearUser();
    setState({ user: null, loading: false, error: null, isAuthenticated: false });
  }, []);

  const refresh = useCallback(async () => {
    const stored = getStoredUser();
    if (!stored) return;
    await login(stored.email);
  }, [login]);

  return {
    ...state,
    login,
    loginWithGoogle,
    loginWithPassword,
    logout,
    refresh,
  };
}

// ============================================================
// Context（供全域使用）
// ============================================================

export interface GasAuthContextValue extends GasAuthState {
  login: (email: string) => Promise<boolean>;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  loginWithPassword: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const GasAuthContext = createContext<GasAuthContextValue>({
  user: null,
  loading: false,
  error: null,
  isAuthenticated: false,
  login: async () => false,
  loginWithGoogle: async () => false,
  loginWithPassword: async () => false,
  logout: () => {},
  refresh: async () => {},
});

export function useGasAuthContext(): GasAuthContextValue {
  return useContext(GasAuthContext);
}
