// ============================================================
// 115年度協助員點數管理系統 — 業務領域型別定義
// ============================================================

export const CONTRACT_START = '2026-04-22';
export const CONTRACT_END = '2027-06-21';

export type SystemRole = 'admin' | 'deptMgr' | 'billing' | 'worker';

export type WorkerType =
  | 'general'
  | 'offshore'
  | 'safety'
  | 'environment';

export const WORKER_TYPE_LABELS: Record<WorkerType, string> = {
  general: '一般工地協助員',
  offshore: '離島工地協助員',
  safety: '職安業務兼管理員',
  environment: '環保業務人員',
};

export type PointCategory = 'A1' | 'A2' | 'B1' | 'B2' | 'C' | 'D1' | 'D2' | 'S' | 'P';

export type RecordStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

export const RECORD_STATUS_LABELS: Record<RecordStatus, string> = {
  draft: '草稿',
  submitted: '已送出',
  approved: '已通過',
  rejected: '已退回',
};

export type AttendanceSource = 'auto' | 'planned' | 'actual';

export type ReviewAction =
  | '初審通過'
  | '退回修改'
  | '廠商確認'
  | '廠商退回'
  | '解鎖';

export type PerfLevel = '優' | '佳' | '平';

export interface PointsConfigItem {
  itemId: string;
  workerType: string;
  category: PointCategory;
  name: string;
  pointsPerUnit: number;
  unit: string;
  frequency: string;
  note: string;
}

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  role: SystemRole;
  department: string;
  area: string;
  workerType: WorkerType;
  onboardDate: string;
  pastExpDays: number;
  isActive: boolean;
  createdAt: string;
}

export interface AttendanceRecord {
  userId: string;
  date: string;
  amStatus: string;
  pmStatus: string;
  workHours: number;
  leaveHours: number;
  source: AttendanceSource;
  isFinalized: boolean;
  note: string;
  updatedAt: string;
}

export interface DailyPointRecord {
  recordId: string;
  userId: string;
  date: string;
  itemId: string;
  quantity: number;
  points: number;
  fileIds: string[];
  status: RecordStatus;
  uploadedAt: string;
  updatedAt: string;
}

export interface MonthlyPointRecord {
  recordId: string;
  userId: string;
  yearMonth: string;
  itemId: string;
  quantity: number;
  points: number;
  fileIds: string[];
  perfLevel: PerfLevel | '';
  status: RecordStatus;
  uploadedAt: string;
  updatedAt: string;
}

export interface ReviewLogEntry {
  logId: string;
  userId: string;
  yearMonth: string;
  reviewerUserId: string;
  action: ReviewAction;
  timestamp: string;
  note: string;
  changeDetail: string;
}

export interface MonthlySnapshot {
  snapshotId: string;
  userId: string;
  yearMonth: string;
  aTotal: number;
  bTotal: number;
  cAmount: number;
  dTotal: number;
  sAmount: number;
  pDeduction: number;
  monthTotal: number;
  workDays: number;
  leaveHours: number;
  snapshotTime: string;
  confirmerId: string;
}

export interface ActivityLog {
  logId: string;
  userId: string;
  timestamp: string;
  actionType: string;
  description: string;
}

export interface FileIndexEntry {
  fileId: string;
  userId: string;
  date: string;
  itemId: string;
  fileName: string;
  mimeType: string;
  driveFileId: string;
  uploadedAt: string;
}

export interface SystemConfig {
  companyName: string;
  contractStart: string;
  contractEnd: string;
  totalWorkers: number;
  totalMonths: number;
  holidays: string[];
  driveFolderId: string;
  isInitialized: boolean;
}

export interface OfflineDraft {
  id: string;
  userId: string;
  date: string;
  itemId: string;
  completed: boolean;
  note: string;
  pendingFiles: Array<{
    name: string;
    type: string;
    size: number;
    blob: Blob;
  }>;
  savedAt: number;
}

export interface GasApiResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  message?: string;
}

export const DEPARTMENTS = [
  '土木工作隊', '建築工作隊', '機械工作隊', '電氣工作隊',
  '中部工作隊', '南部工作隊', '工安組', '檢驗組',
] as const;

export const AREAS = [
  '處本部', '大潭', '通霄', '興達', '大林', '金門', '琉球',
] as const;

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: '/', label: '上班（／）' },
  { value: '特', label: '特休' },
  { value: '病', label: '病假' },
  { value: '事', label: '事假' },
  { value: '婚', label: '婚假' },
  { value: '喪', label: '喪假' },
  { value: '公', label: '公假' },
  { value: '代', label: '代理' },
  { value: '曠', label: '曠職' },
  { value: '', label: '清除' },
] as const;

// 51 筆點數定義種子資料（workerType 使用 English enum 與 Google Sheets 一致）
export const POINTS_CONFIG_SEED: PointsConfigItem[] = [
  // 一般工地協助員 (general)
  { itemId: 'GEN-A1-01', workerType: 'general', category: 'A1', name: '自動檢查與工地巡檢', pointsPerUnit: 800, unit: '天', frequency: '每日', note: '' },
  { itemId: 'GEN-A1-02', workerType: 'general', category: 'A1', name: '危害告知與高風險作業管制與監督', pointsPerUnit: 400, unit: '天', frequency: '每日', note: '' },
  { itemId: 'GEN-A1-03', workerType: 'general', category: 'A1', name: '承攬商每日作業安全循環之監督與協調', pointsPerUnit: 200, unit: '天', frequency: '每日', note: '' },
  { itemId: 'GEN-A1-04', workerType: 'general', category: 'A1', name: '工地監看與職安環保管控', pointsPerUnit: 150, unit: '天', frequency: '每日', note: '' },
  { itemId: 'GEN-A2-01', workerType: 'general', category: 'A2', name: '天然災害停止上班遠端作業(颱風假、豪雨假等)', pointsPerUnit: 1400, unit: '天', frequency: '事件', note: '' },
  { itemId: 'GEN-B1-01', workerType: 'general', category: 'B1', name: '進場資格與16專卷審查', pointsPerUnit: 4000, unit: '月', frequency: '每月', note: '' },
  { itemId: 'GEN-B1-02', workerType: 'general', category: 'B1', name: '設備設施安全稽核', pointsPerUnit: 3000, unit: '月', frequency: '每月', note: '' },
  { itemId: 'GEN-B1-03', workerType: 'general', category: 'B1', name: '協議組織運作與績效分析', pointsPerUnit: 3000, unit: '月', frequency: '每月', note: '' },
  { itemId: 'GEN-B1-04', workerType: 'general', category: 'B1', name: '職安衛文書作業與水平展開', pointsPerUnit: 2900, unit: '月', frequency: '每月', note: '' },
  { itemId: 'GEN-B2-01', workerType: 'general', category: 'B2', name: '春節期間強化作業', pointsPerUnit: 5000, unit: '次', frequency: '每年', note: '' },
  { itemId: 'GEN-C-01',  workerType: 'general', category: 'C',  name: '臨時交辦與績效', pointsPerUnit: 5000, unit: '月', frequency: '每月', note: '優5000/佳3000/平2000（由主辦部門評估）' },
  { itemId: 'GEN-S-01',  workerType: 'general', category: 'S',  name: '特休代付款', pointsPerUnit: 220, unit: '小時', frequency: '每月', note: '' },
  { itemId: 'GEN-P-01',  workerType: 'general', category: 'P',  name: '懲罰性違約金 (未派員履約)', pointsPerUnit: 220, unit: '小時', frequency: '事件', note: '' },
  // 離島工地協助員 (offshore)
  { itemId: 'OFF-A1-01', workerType: 'offshore', category: 'A1', name: '自動檢查與工地巡檢', pointsPerUnit: 1060, unit: '天', frequency: '每日', note: '' },
  { itemId: 'OFF-A1-02', workerType: 'offshore', category: 'A1', name: '危害告知與高風險作業管制與監督', pointsPerUnit: 530, unit: '天', frequency: '每日', note: '' },
  { itemId: 'OFF-A1-03', workerType: 'offshore', category: 'A1', name: '承攬商每日作業安全循環之監督與協調', pointsPerUnit: 300, unit: '天', frequency: '每日', note: '' },
  { itemId: 'OFF-A1-04', workerType: 'offshore', category: 'A1', name: '工地監看與職安環保管控', pointsPerUnit: 210, unit: '天', frequency: '每日', note: '' },
  { itemId: 'OFF-A2-01', workerType: 'offshore', category: 'A2', name: '天然災害停止上班遠端作業(颱風假、豪雨假等)', pointsPerUnit: 1800, unit: '天', frequency: '事件', note: '' },
  { itemId: 'OFF-B1-01', workerType: 'offshore', category: 'B1', name: '進場資格與16專卷審查', pointsPerUnit: 5000, unit: '月', frequency: '每月', note: '' },
  { itemId: 'OFF-B1-02', workerType: 'offshore', category: 'B1', name: '設備設施安全稽核', pointsPerUnit: 4000, unit: '月', frequency: '每月', note: '' },
  { itemId: 'OFF-B1-03', workerType: 'offshore', category: 'B1', name: '協議組織運作與績效分析', pointsPerUnit: 4000, unit: '月', frequency: '每月', note: '' },
  { itemId: 'OFF-B1-04', workerType: 'offshore', category: 'B1', name: '職安衛文書作業與水平展開', pointsPerUnit: 3600, unit: '月', frequency: '每月', note: '' },
  { itemId: 'OFF-B2-01', workerType: 'offshore', category: 'B2', name: '春節期間強化作業', pointsPerUnit: 7000, unit: '次', frequency: '每年', note: '' },
  { itemId: 'OFF-C-01',  workerType: 'offshore', category: 'C',  name: '臨時交辦與績效', pointsPerUnit: 7200, unit: '月', frequency: '每月', note: '優7200/佳5200/平4200（由主辦部門評估）' },
  { itemId: 'OFF-S-01',  workerType: 'offshore', category: 'S',  name: '特休代付款', pointsPerUnit: 290, unit: '小時', frequency: '每月', note: '' },
  { itemId: 'OFF-P-01',  workerType: 'offshore', category: 'P',  name: '懲罰性違約金 (未派員履約)', pointsPerUnit: 290, unit: '小時', frequency: '事件', note: '' },
  // 職安業務兼管理員 (safety)
  { itemId: 'SAF-A1-01', workerType: 'safety', category: 'A1', name: '確認協助員每日上傳狀況並追蹤', pointsPerUnit: 600, unit: '天', frequency: '每日', note: '' },
  { itemId: 'SAF-A1-02', workerType: 'safety', category: 'A1', name: '走動管理及工安查核追蹤', pointsPerUnit: 500, unit: '天', frequency: '每日', note: '' },
  { itemId: 'SAF-A2-01', workerType: 'safety', category: 'A2', name: '天然災害停止上班遠端作業(颱風假、豪雨假等)', pointsPerUnit: 1000, unit: '天', frequency: '事件', note: '' },
  { itemId: 'SAF-B1-01', workerType: 'safety', category: 'B1', name: '缺失或宣導製作簡報', pointsPerUnit: 2000, unit: '月', frequency: '每月', note: '' },
  { itemId: 'SAF-B1-02', workerType: 'safety', category: 'B1', name: '職安類週/月/季及年報彙整', pointsPerUnit: 10800, unit: '月', frequency: '每月', note: '' },
  { itemId: 'SAF-B1-03', workerType: 'safety', category: 'B1', name: '職安管理系統文件統計分析', pointsPerUnit: 1000, unit: '月', frequency: '每月', note: '' },
  { itemId: 'SAF-B1-04', workerType: 'safety', category: 'B1', name: '廠商管理人每月計價作業', pointsPerUnit: 4500, unit: '月', frequency: '每月', note: '' },
  { itemId: 'SAF-B1-05', workerType: 'safety', category: 'B1', name: '出勤調度與差勤抽查', pointsPerUnit: 500, unit: '月', frequency: '每月', note: '' },
  { itemId: 'SAF-B2-01', workerType: 'safety', category: 'B2', name: '春節期間防護檢核資料彙整', pointsPerUnit: 4000, unit: '次', frequency: '每年', note: '' },
  { itemId: 'SAF-C-01',  workerType: 'safety', category: 'C',  name: '臨時交辦與績效', pointsPerUnit: 5000, unit: '月', frequency: '每月', note: '優5000/佳3000/平2000（由主辦部門評估）' },
  { itemId: 'SAF-S-01',  workerType: 'safety', category: 'S',  name: '特休代付款', pointsPerUnit: 200, unit: '小時', frequency: '每月', note: '' },
  { itemId: 'SAF-P-01',  workerType: 'safety', category: 'P',  name: '懲罰性違約金 (未派員履約)', pointsPerUnit: 200, unit: '小時', frequency: '事件', note: '' },
  // 環保業務人員 (environment)
  { itemId: 'ENV-A1-01', workerType: 'environment', category: 'A1', name: '環保行政業務', pointsPerUnit: 500, unit: '天', frequency: '每日', note: '' },
  { itemId: 'ENV-A2-01', workerType: 'environment', category: 'A2', name: '天然災害停止上班遠端作業(颱風假、豪雨假等)', pointsPerUnit: 400, unit: '天', frequency: '事件', note: '' },
  { itemId: 'ENV-B1-01', workerType: 'environment', category: 'B1', name: '行政文書核心', pointsPerUnit: 29500, unit: '月', frequency: '每月', note: '' },
  { itemId: 'ENV-B2-01', workerType: 'environment', category: 'B2', name: '春節期間防護檢核資料彙整', pointsPerUnit: 2000, unit: '次', frequency: '每年', note: '' },
  { itemId: 'ENV-C-01',  workerType: 'environment', category: 'C',  name: '臨時交辦與績效', pointsPerUnit: 2000, unit: '月', frequency: '每月', note: '優2000/佳1000/平500（由主辦部門評估）' },
  { itemId: 'ENV-D1-01', workerType: 'environment', category: 'D1', name: '環境管理方案執行績效管制', pointsPerUnit: 100, unit: '天', frequency: '每日', note: '' },
  { itemId: 'ENV-D1-02', workerType: 'environment', category: 'D1', name: '監督與量測計畫及實施', pointsPerUnit: 100, unit: '天', frequency: '每日', note: '' },
  { itemId: 'ENV-D1-03', workerType: 'environment', category: 'D1', name: '法規鑑別與守規性之評估作業程序書作業', pointsPerUnit: 250, unit: '天', frequency: '每日', note: '' },
  { itemId: 'ENV-D2-01', workerType: 'environment', category: 'D2', name: '環境審查作業程序書作業', pointsPerUnit: 800, unit: '月', frequency: '每月', note: '' },
  { itemId: 'ENV-D2-02', workerType: 'environment', category: 'D2', name: '管理階層審查會議資料準備', pointsPerUnit: 400, unit: '月', frequency: '每月', note: '' },
  { itemId: 'ENV-D2-03', workerType: 'environment', category: 'D2', name: '內部稽核文件整理準備', pointsPerUnit: 900, unit: '月', frequency: '每月', note: '' },
  { itemId: 'ENV-S-01',  workerType: 'environment', category: 'S',  name: '特休代付款', pointsPerUnit: 190, unit: '小時', frequency: '每月', note: '' },
  { itemId: 'ENV-P-01',  workerType: 'environment', category: 'P',  name: '懲罰性違約金 (未派員履約)', pointsPerUnit: 190, unit: '小時', frequency: '事件', note: '' },
];
