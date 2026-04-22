/**
 * SheetJS xlsx 報表匯出工具
 * 支援：差勤統計表、工作月報表、工作量彙總表、出勤暨特休統計表、服務費統計表
 * 含中文大寫金額轉換
 */
import * as XLSX from 'xlsx';

// ============================================================
// 中文大寫金額轉換
// ============================================================

const CN_NUM = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
const CN_UNIT = ['', '拾', '佰', '仟'];
const CN_SECTION = ['', '萬', '億', '兆'];

function sectionToChinese(section: number): string {
  const str = String(section);
  let result = '';
  let zeroFlag = false;

  for (let i = 0; i < str.length; i++) {
    const digit = parseInt(str[i]);
    const unitIdx = str.length - 1 - i;

    if (digit === 0) {
      zeroFlag = true;
    } else {
      if (zeroFlag) result += '零';
      result += CN_NUM[digit] + CN_UNIT[unitIdx];
      zeroFlag = false;
    }
  }
  return result;
}

/**
 * 將數字金額轉換為中文大寫（元整）
 * 例：12345.67 → 壹萬貳仟參佰肆拾伍元陸角柒分
 */
export function toChineseAmount(amount: number): string {
  if (isNaN(amount) || amount < 0) return '零元整';
  if (amount === 0) return '零元整';

  const [intPart, decPart] = amount.toFixed(2).split('.');
  const intNum = parseInt(intPart);

  let result = '';
  const sections: number[] = [];
  let temp = intNum;

  if (temp === 0) {
    result = '零';
  } else {
    while (temp > 0) {
      sections.unshift(temp % 10000);
      temp = Math.floor(temp / 10000);
    }

    for (let i = 0; i < sections.length; i++) {
      const sectionStr = sectionToChinese(sections[i]);
      const sectionUnit = CN_SECTION[sections.length - 1 - i];
      if (sections[i] !== 0) {
        result += sectionStr + sectionUnit;
      } else if (result.length > 0 && !result.endsWith('零')) {
        result += '零';
      }
    }
  }

  result += '元';

  const jiao = parseInt(decPart[0]);
  const fen = parseInt(decPart[1]);

  if (jiao === 0 && fen === 0) {
    result += '整';
  } else {
    if (jiao > 0) result += CN_NUM[jiao] + '角';
    if (fen > 0) result += CN_NUM[fen] + '分';
  }

  return result;
}

// ============================================================
// 通用匯出輔助
// ============================================================

function createWorkbook(sheetName: string, data: (string | number)[][]): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(wb, filename);
}

// ============================================================
// 1. 差勤統計表
// ============================================================

export interface AttendanceRow {
  workerId: string;
  workerName: string;
  department: string;
  workDays: number;
  annualLeave: number;
  sickLeave: number;
  personalLeave: number;
  marriageLeave: number;
  funeralLeave: number;
  publicLeave: number;
  proxyLeave: number;
  absentDays: number;
  totalLeaveDays: number;
}

export function exportAttendanceReport(
  rows: AttendanceRow[],
  month: string,
  orgName = '綜合施工處'
): void {
  const title = `${orgName} ${month} 差勤統計表`;
  const headers = [
    '工號', '姓名', '部門', '出勤天數', '特休', '病假', '事假',
    '婚假', '喪假', '公假', '代理', '曠職', '請假合計'
  ];

  const data: (string | number)[][] = [
    [title],
    headers,
    ...rows.map(r => [
      r.workerId, r.workerName, r.department, r.workDays,
      r.annualLeave, r.sickLeave, r.personalLeave,
      r.marriageLeave, r.funeralLeave, r.publicLeave,
      r.proxyLeave, r.absentDays, r.totalLeaveDays
    ]),
  ];

  const wb = createWorkbook('差勤統計表', data);
  downloadWorkbook(wb, `差勤統計表_${month}.xlsx`);
}

// ============================================================
// 2. 工作月報表
// ============================================================

export interface WorkMonthlyRow {
  workerId: string;
  workerName: string;
  date: string;
  pointCode: string;
  category: string;
  taskName: string;
  points: number;
  fileCount: number;
  status: string;
}

export function exportWorkMonthlyReport(
  rows: WorkMonthlyRow[],
  month: string,
  orgName = '綜合施工處'
): void {
  const title = `${orgName} ${month} 工作月報表`;
  const headers = ['工號', '姓名', '日期', '點數代碼', '類別', '項目名稱', '點數', '佐證數量', '審核狀態'];

  const data: (string | number)[][] = [
    [title],
    headers,
    ...rows.map(r => [
      r.workerId, r.workerName, r.date, r.pointCode,
      r.category, r.taskName, r.points, r.fileCount, r.status
    ]),
    ['', '', '', '', '', '合計', rows.reduce((s, r) => s + r.points, 0), '', ''],
  ];

  const wb = createWorkbook('工作月報表', data);
  downloadWorkbook(wb, `工作月報表_${month}.xlsx`);
}

// ============================================================
// 3. 工作量彙總表
// ============================================================

export interface WorkSummaryRow {
  workerId: string;
  workerName: string;
  workerType: string;
  area: string;
  catA: number;
  catB: number;
  catC: number;
  catD: number;
  catS: number;
  catP: number;
  total: number;
}

export function exportWorkSummaryReport(
  rows: WorkSummaryRow[],
  month: string,
  orgName = '綜合施工處'
): void {
  const title = `${orgName} ${month} 工作量彙總表`;
  const headers = [
    '工號', '姓名', '協助員類型', '服務區域',
    'A類點數', 'B類點數', 'C類點數', 'D類點數', 'S類點數', 'P類點數', '月度總點數'
  ];

  const totalRow = ['', '', '', '合計',
    rows.reduce((s, r) => s + r.catA, 0),
    rows.reduce((s, r) => s + r.catB, 0),
    rows.reduce((s, r) => s + r.catC, 0),
    rows.reduce((s, r) => s + r.catD, 0),
    rows.reduce((s, r) => s + r.catS, 0),
    rows.reduce((s, r) => s + r.catP, 0),
    rows.reduce((s, r) => s + r.total, 0),
  ];

  const data: (string | number)[][] = [
    [title],
    headers,
    ...rows.map(r => [
      r.workerId, r.workerName, r.workerType, r.area,
      r.catA, r.catB, r.catC, r.catD, r.catS, r.catP, r.total
    ]),
    totalRow,
  ];

  const wb = createWorkbook('工作量彙總表', data);
  downloadWorkbook(wb, `工作量彙總表_${month}.xlsx`);
}

// ============================================================
// 4. 出勤暨特休統計表
// ============================================================

export interface LeaveStatRow {
  workerId: string;
  workerName: string;
  department: string;
  onboardDate: string;
  expDays: number;
  annualLeaveEntitled: number;
  annualLeaveUsed: number;
  annualLeaveRemaining: number;
  workDays: number;
  totalLeaveDays: number;
}

export function exportLeaveStatReport(
  rows: LeaveStatRow[],
  month: string,
  orgName = '綜合施工處'
): void {
  const title = `${orgName} ${month} 出勤暨特休統計表`;
  const headers = [
    '工號', '姓名', '部門', '到職日期', '年資天數',
    '特休應休', '特休已休', '特休餘額', '出勤天數', '請假合計'
  ];

  const data: (string | number)[][] = [
    [title],
    headers,
    ...rows.map(r => [
      r.workerId, r.workerName, r.department, r.onboardDate,
      r.expDays, r.annualLeaveEntitled, r.annualLeaveUsed,
      r.annualLeaveRemaining, r.workDays, r.totalLeaveDays
    ]),
  ];

  const wb = createWorkbook('出勤暨特休統計表', data);
  downloadWorkbook(wb, `出勤暨特休統計表_${month}.xlsx`);
}

// ============================================================
// 5. 服務費統計表（含中文大寫）
// ============================================================

export interface ServiceFeeRow {
  workerId: string;
  workerName: string;
  workerType: string;
  area: string;
  totalPoints: number;
  pointRate: number;
  serviceFee: number;
}

export function exportServiceFeeReport(
  rows: ServiceFeeRow[],
  month: string,
  orgName = '綜合施工處',
  pointRate = 1
): void {
  const title = `${orgName} ${month} 服務費統計表`;
  const headers = [
    '工號', '姓名', '協助員類型', '服務區域',
    '月度總點數', '點數價值 (點)', '服務費（元）', '服務費（中文大寫）'
  ];

  const totalFee = rows.reduce((s, r) => s + r.serviceFee, 0);

  const data: (string | number)[][] = [
    [title],
    [`點數價值：${pointRate} 點`, `統計月份：${month}`],
    headers,
    ...rows.map(r => [
      r.workerId, r.workerName, r.workerType, r.area,
      r.totalPoints, r.pointRate, r.serviceFee,
      toChineseAmount(r.serviceFee)
    ]),
    ['', '', '', '合計', rows.reduce((s, r) => s + r.totalPoints, 0), '', totalFee, toChineseAmount(totalFee)],
  ];

  const wb = createWorkbook('服務費統計表', data);
  downloadWorkbook(wb, `服務費統計表_${month}.xlsx`);
}

// ============================================================
// 列印支援
// ============================================================

/** 觸發瀏覽器列印對話框 */
export function printPage(): void {
  window.print();
}
