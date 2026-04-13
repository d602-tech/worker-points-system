/**
 * Google Apps Script (GAS) API 整合層
 * 透過 GAS Web App URL 執行 Google Sheets CRUD 操作
 */

import axios from 'axios';
import type {
  GasApiResponse,
  UserProfile,
  AttendanceRecord,
  DailyPointRecord,
  MonthlyPointRecord,
  ReviewLogEntry,
  FileIndexEntry,
  SystemConfig,
  PointsConfigItem,
} from '../shared/domain';

const GAS_URL = process.env.GAS_API_URL || '';
const GAS_TOKEN = process.env.GAS_API_TOKEN || '';

const gasClient = axios.create({
  baseURL: GAS_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    ...(GAS_TOKEN ? { Authorization: `Bearer ${GAS_TOKEN}` } : {}),
  },
});

async function gasGet<T>(action: string, params: Record<string, string> = {}): Promise<T> {
  const searchParams = new URLSearchParams({ action, ...params });
  const res = await gasClient.get<GasApiResponse<T>>(`?${searchParams}`);
  if (res.data.status !== 'ok') throw new Error(res.data.message || 'GAS API error');
  return res.data.data as T;
}

async function gasPost<T>(action: string, payload: unknown): Promise<T> {
  const res = await gasClient.post<GasApiResponse<T>>('', { action, ...payload as object });
  if (res.data.status !== 'ok') throw new Error(res.data.message || 'GAS API error');
  return res.data.data as T;
}

// ============================================================
// 系統設定
// ============================================================
export const gasConfig = {
  get: () => gasGet<SystemConfig>('getConfig'),
  update: (data: Partial<SystemConfig>) => gasPost<void>('updateConfig', data),
};

// ============================================================
// 人員名冊
// ============================================================
export const gasUsers = {
  list: () => gasGet<UserProfile[]>('listUsers'),
  get: (userId: string) => gasGet<UserProfile>('getUser', { userId }),
  create: (data: Omit<UserProfile, 'userId' | 'createdAt'>) => gasPost<UserProfile>('createUser', data),
  update: (userId: string, data: Partial<UserProfile>) => gasPost<void>('updateUser', { userId, ...data }),
  delete: (userId: string) => gasPost<void>('deleteUser', { userId }),
};

// ============================================================
// 差勤紀錄
// ============================================================
export const gasAttendance = {
  listByMonth: (yearMonth: string) => gasGet<AttendanceRecord[]>('listAttendance', { yearMonth }),
  listByUser: (userId: string, yearMonth: string) =>
    gasGet<AttendanceRecord[]>('listAttendance', { userId, yearMonth }),
  upsert: (data: AttendanceRecord) => gasPost<void>('upsertAttendance', data),
  bulkUpsert: (records: AttendanceRecord[]) => gasPost<void>('bulkUpsertAttendance', { records }),
  finalize: (userId: string, yearMonth: string) =>
    gasPost<void>('finalizeAttendance', { userId, yearMonth }),
};

// ============================================================
// 每日點數明細
// ============================================================
export const gasDailyPoints = {
  listByDate: (userId: string, date: string) =>
    gasGet<DailyPointRecord[]>('listDailyPoints', { userId, date }),
  listByMonth: (userId: string, yearMonth: string) =>
    gasGet<DailyPointRecord[]>('listDailyPoints', { userId, yearMonth }),
  upsert: (data: DailyPointRecord) => gasPost<DailyPointRecord>('upsertDailyPoint', data),
  updateStatus: (recordId: string, status: string) =>
    gasPost<void>('updateDailyPointStatus', { recordId, status }),
  delete: (recordId: string) => gasPost<void>('deleteDailyPoint', { recordId }),
};

// ============================================================
// 月度點數明細
// ============================================================
export const gasMonthlyPoints = {
  listByMonth: (userId: string, yearMonth: string) =>
    gasGet<MonthlyPointRecord[]>('listMonthlyPoints', { userId, yearMonth }),
  upsert: (data: MonthlyPointRecord) => gasPost<MonthlyPointRecord>('upsertMonthlyPoint', data),
  updateStatus: (recordId: string, status: string) =>
    gasPost<void>('updateMonthlyPointStatus', { recordId, status }),
  setPerfLevel: (recordId: string, perfLevel: string) =>
    gasPost<void>('setMonthlyPerfLevel', { recordId, perfLevel }),
};

// ============================================================
// 審核紀錄
// ============================================================
export const gasReviewLog = {
  listByMonth: (yearMonth: string) =>
    gasGet<ReviewLogEntry[]>('listReviewLog', { yearMonth }),
  listByUser: (userId: string, yearMonth: string) =>
    gasGet<ReviewLogEntry[]>('listReviewLog', { userId, yearMonth }),
  append: (data: Omit<ReviewLogEntry, 'logId'>) => gasPost<ReviewLogEntry>('appendReviewLog', data),
};

// ============================================================
// 點數定義表
// ============================================================
export const gasPointsConfig = {
  list: () => gasGet<PointsConfigItem[]>('listPointsConfig'),
  listByWorkerType: (workerType: string) =>
    gasGet<PointsConfigItem[]>('listPointsConfig', { workerType }),
};

// ============================================================
// 佐證檔案索引
// ============================================================
export const gasFilesIndex = {
  listByRecord: (userId: string, date: string, itemId: string) =>
    gasGet<FileIndexEntry[]>('listFiles', { userId, date, itemId }),
  append: (data: Omit<FileIndexEntry, 'fileId'>) => gasPost<FileIndexEntry>('appendFile', data),
  delete: (fileId: string) => gasPost<void>('deleteFile', { fileId }),
};

// ============================================================
// 報表資料
// ============================================================
export const gasReports = {
  summary: (yearMonth: string) =>
    gasGet<unknown[]>('reportSummary', { yearMonth }),
  leave: (yearMonth: string) =>
    gasGet<unknown[]>('reportLeave', { yearMonth }),
  fee: (yearMonth: string) =>
    gasGet<unknown>('reportFee', { yearMonth }),
  attendance: (userId: string, yearMonth: string) =>
    gasGet<unknown>('reportAttendance', { userId, yearMonth }),
  workMonthly: (userId: string, yearMonth: string) =>
    gasGet<unknown>('reportWorkMonthly', { userId, yearMonth }),
};
