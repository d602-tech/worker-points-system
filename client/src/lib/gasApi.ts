/**
 * gasApi.ts
 * GAS Web App API 客戶端工具庫
 *
 * 使用方式：
 *   1. 使用者在「系統設定」頁面輸入 GAS Web App URL
 *   2. URL 儲存於 localStorage["gas_url"]
 *   3. 所有 API 呼叫透過此工具庫發出
 *
 * GAS API 回應格式：
 *   { success: true, data: any }
 *   { success: false, error: string }
 */

const GAS_URL_KEY = "gas_url";
const SHEET_ID_KEY = "sheet_id";
const DRIVE_FOLDER_ID_KEY = "drive_folder_id";

// ============================================================
// 預設 GAS Web App URL
// 優先順序：localStorage（管理員可覆蓋）> Vite 環境變數（build time 注入）
// 環境變數由 GitHub Secrets → deploy.yml → VITE_GAS_URL 傳入
// ============================================================
const DEFAULT_GAS_URL = import.meta.env.VITE_GAS_URL as string || "";

// ============================================================
// 設定管理
// ============================================================

export function getGasUrl(): string {
  return localStorage.getItem(GAS_URL_KEY) || DEFAULT_GAS_URL;
}

export function setGasUrl(url: string): void {
  localStorage.setItem(GAS_URL_KEY, url);
}

export function getSheetId(): string {
  return localStorage.getItem(SHEET_ID_KEY) || "";
}

export function setSheetId(id: string): void {
  localStorage.setItem(SHEET_ID_KEY, id);
}

export function getDriveFolderId(): string {
  return localStorage.getItem(DRIVE_FOLDER_ID_KEY) || "";
}

export function setDriveFolderId(id: string): void {
  localStorage.setItem(DRIVE_FOLDER_ID_KEY, id);
}

export function isGasConfigured(): boolean {
  return Boolean(getGasUrl());
}

// ============================================================
// HTTP 工具
// ============================================================

export interface GasResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * GET 請求（帶 action 與 params）
 */
export async function gasGet<T = unknown>(
  action: string,
  params: Record<string, string> = {}
): Promise<GasResponse<T>> {
  const url = getGasUrl();
  if (!url) {
    return { success: false, error: "GAS URL 未設定，請至「系統設定」頁面設定。" };
  }
  try {
    const qs = new URLSearchParams({ action, ...params });
    const res = await fetch(`${url}?${qs.toString()}`, {
      method: "GET",
      redirect: "follow",
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const json = await res.json();
    return json as GasResponse<T>;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * POST 請求（帶 JSON body）
 */
export async function gasPost<T = unknown>(
  action: string,
  body: Record<string, unknown> = {}
): Promise<GasResponse<T>> {
  const url = getGasUrl();
  if (!url) {
    return { success: false, error: "GAS URL 未設定，請至「系統設定」頁面設定。" };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...body }),
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const json = await res.json();
    return json as GasResponse<T>;
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================================
// Ping / 健康檢查
// ============================================================

export async function pingGas(): Promise<{ ok: boolean; version?: string; error?: string }> {
  const res = await gasGet<{ version?: string }>("ping");
  if (res.success) {
    return { ok: true, version: res.data?.version };
  }
  return { ok: false, error: res.error };
}

// ============================================================
// 人員名冊 API
// ============================================================

export interface WorkerRow {
  id: string;
  name: string;
  accountType: string;
  email: string;
  dept: string;
  area: string;
  workerType: string;
  onboardDate: string;
  leaveDate: string;
  status: string;
  experienceDays: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export async function getWorkers(): Promise<GasResponse<WorkerRow[]>> {
  return gasGet<WorkerRow[]>("getWorkers");
}

export async function upsertWorker(worker: Partial<WorkerRow>): Promise<GasResponse<WorkerRow>> {
  return gasPost<WorkerRow>("upsertWorker", { worker });
}

// ============================================================
// 差勤紀錄 API
// ============================================================

export interface AttendanceRow {
  id: string;
  workerId: string;
  date: string;
  type: string;
  hours: number;
  note: string;
  createdAt: string;
}

export async function getAttendance(workerId: string, yearMonth: string): Promise<GasResponse<AttendanceRow[]>> {
  return gasGet<AttendanceRow[]>("getAttendance", { workerId, yearMonth });
}

export async function upsertAttendance(record: Partial<AttendanceRow>): Promise<GasResponse<AttendanceRow>> {
  return gasPost<AttendanceRow>("upsertAttendance", { record });
}

// ============================================================
// 每日點數明細 API
// ============================================================

export interface DailyPointRow {
  id: string;
  workerId: string;
  date: string;
  itemId: string;
  itemName: string;
  points: number;
  completed: boolean;
  note: string;
  files: string; // JSON string of file URLs
  status: "draft" | "submitted" | "approved" | "rejected";
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getDailyPoints(workerId: string, date: string): Promise<GasResponse<DailyPointRow[]>> {
  return gasGet<DailyPointRow[]>("getDailyPoints", { workerId, date });
}

export async function saveDailyPoints(
  workerId: string,
  date: string,
  items: Partial<DailyPointRow>[]
): Promise<GasResponse<void>> {
  return gasPost<void>("saveDailyPoints", { workerId, date, items });
}

export async function submitDailyPoints(workerId: string, date: string): Promise<GasResponse<void>> {
  return gasPost<void>("submitDailyPoints", { workerId, date });
}

/**
 * 批次送出多筆當日點數 + 佐證（對應規格書 POST /points/daily/batch）
 */
export async function saveDailyPointsBatch(
  workerId: string,
  workerName: string,
  date: string,
  items: Array<{
    pointCode: string;
    category: string;
    taskName: string;
    points: number;
    fileCount: number;
    note: string;
  }>
): Promise<GasResponse<void>> {
  return gasPost<void>("saveDailyPointsBatch", { workerId, workerName, date, items });
}

// ============================================================
// 月度點數明細 API
// ============================================================

export async function getMonthlyPoints(workerId: string, yearMonth: string): Promise<GasResponse<unknown[]>> {
  return gasGet("getMonthlyPoints", { workerId, yearMonth });
}

// ============================================================
// 審核 API
// ============================================================

export async function getReviewList(status?: string): Promise<GasResponse<unknown[]>> {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  return gasGet("getReviewList", params);
}

export async function reviewRecord(
  recordId: string,
  action: "approve" | "reject",
  reason?: string
): Promise<GasResponse<void>> {
  return gasPost<void>("reviewRecord", { recordId, action, reason: reason || "" });
}

// ============================================================
// 系統設定 API
// ============================================================

export interface SystemConfig {
  key: string;
  value: string;
  description: string;
}

export async function getSystemConfig(): Promise<GasResponse<SystemConfig[]>> {
  return gasGet<SystemConfig[]>("getSystemConfig");
}

export async function setSystemConfig(key: string, value: string): Promise<GasResponse<void>> {
  return gasPost<void>("setSystemConfig", { key, value });
}
