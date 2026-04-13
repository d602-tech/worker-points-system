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
// 人員資料 API
// ============================================================

export interface WorkerRow {
  userId: string;        // 人員編號
  name: string;          // 姓名
  email: string;         // 電子信箱
  passwordHash: string;  // 密碼雜湊
  role: string;          // 角色（admin/deptMgr/billing/worker）
  department: string;    // 所屬部門
  area: string;          // 服務區域
  workerType: string;    // 職務類型（general/offshore/safety/environment）
  onboardDate: string;   // 到職日
  pastExpDays: number;   // 過往年資天數
  isActive: boolean;     // 是否啟用
  createdAt: string;     // 建立時間
  lastLoginAt: string;   // 最後登入時間
  loginMethod: string;   // 登入方式
}

export async function getWorkers(): Promise<GasResponse<WorkerRow[]>> {
  return gasGet<WorkerRow[]>("getWorkers");
}

export async function upsertWorker(worker: Partial<WorkerRow>): Promise<GasResponse<WorkerRow>> {
  return gasPost<WorkerRow>("upsertWorker", { worker });
}

export async function deleteWorker(userId: string): Promise<GasResponse<void>> {
  return gasPost<void>("deleteWorker", { userId });
}

// ============================================================
// 差勤紀錄 API
// ============================================================

export interface AttendanceRow {
  userId: string;        // 人員編號
  date: string;          // 日期（YYYY-MM-DD）
  amStatus: string;      // 上午狀態（/, 特4, 病4, 代_姓名, 曠 等）
  pmStatus: string;      // 下午狀態
  workHours: number;     // 有效工時
  leaveHours: number;    // 特休時數
  source: string;        // 資料來源（auto/planned/actual）
  isFinalized: boolean;  // 是否鎖定
  note: string;          // 備註
  updatedAt: string;     // 最後更新時間
}

export async function getAttendance(userId: string, yearMonth: string): Promise<GasResponse<AttendanceRow[]>> {
  return gasGet<AttendanceRow[]>("getAttendance", { userId, yearMonth });
}

export async function upsertAttendance(record: Partial<AttendanceRow>): Promise<GasResponse<AttendanceRow>> {
  return gasPost<AttendanceRow>("upsertAttendance", { record });
}

export async function generateMonthlyAttendance(yearMonth: string): Promise<GasResponse<void>> {
  return gasPost<void>("generateMonthlyAttendance", { yearMonth });
}

export async function finalizeAttendance(yearMonth: string): Promise<GasResponse<void>> {
  return gasPost<void>("finalizeAttendance", { yearMonth });
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

export type ReviewAction = "初審通過" | "退回修改" | "廠商確認" | "廠商退回" | "已請款";

export async function reviewRecord(
  workerId: string,
  yearMonth: string,
  action2: ReviewAction,
  reason?: string
): Promise<GasResponse<void>> {
  return gasPost<void>("reviewMonthlyReport", { workerId, yearMonth, action2, reason: reason || "" });
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

// ============================================================
// 檔案索引 API
// ============================================================

export interface FileIndexRow {
  fileId: string;       // 檔案編號
  userId: string;       // 人員編號
  date: string;         // 日期
  itemId: string;       // 項目編號
  fileName: string;     // 檔案名稱
  mimeType: string;     // 檔案類型
  driveFileId: string;  // 雲端檔案編號
  uploadedAt: string;   // 上傳時間
}

/**
 * 上傳檔案至 Google Drive（base64 編碼）
 * category 建議值：A1_每日 / B1_月報 / B2_月報 / 請假佐證 / 年資佐證
 */
export async function uploadFileToDrive(
  callerEmail: string,
  base64Data: string,
  fileName: string,
  mimeType: string,
  workerId: string,
  date: string,
  category = "A1_每日"
): Promise<GasResponse<{ driveFileId: string; fileName: string }>> {
  return gasPost<{ driveFileId: string; fileName: string }>("uploadFileToDrive", {
    callerEmail, base64Data, fileName, mimeType, workerId, date, category,
  });
}

/**
 * 將已上傳的 Drive 檔案寫入「檔案索引」分頁
 */
export async function saveFileIndex(
  callerEmail: string,
  record: {
    userId: string;
    date: string;
    itemId: string;
    fileName: string;
    mimeType: string;
    driveFileId: string;
  }
): Promise<GasResponse<{ fileId: string }>> {
  return gasPost<{ fileId: string }>("saveFileIndex", { callerEmail, record });
}

/**
 * 查詢檔案索引（依人員 + 日期，可選填項目編號）
 */
export async function getFileIndexByDate(
  workerId: string,
  date: string,
  itemId?: string
): Promise<GasResponse<FileIndexRow[]>> {
  const params: Record<string, string> = { workerId, date };
  if (itemId) params.itemId = itemId;
  return gasGet<FileIndexRow[]>("getFileIndex", params);
}
