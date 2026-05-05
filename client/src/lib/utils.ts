import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid, isBefore, isAfter, startOfMonth, endOfMonth } from "date-fns";
import { zhTW } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 安全格式化日期，避免 Invalid time value 崩潰
 */
export function safeFormat(
  date: Date | string | number | null | undefined, 
  formatStr: string, 
  fallback = "—",
  options: { locale?: any } = { locale: zhTW }
): string {
  if (!date) return fallback;
  
  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === "string") {
    // 嘗試 parseISO
    dateObj = parseISO(date);
    // 如果無效，嘗試原生 Date 解析（處理 slash 或其他格式）
    if (!isValid(dateObj)) {
      dateObj = new Date(date);
    }
  } else {
    dateObj = new Date(date);
  }

  if (!isValid(dateObj)) return fallback;
  
  try {
    return format(dateObj, formatStr, options);
  } catch (e) {
    console.error("safeFormat error:", e);
    return fallback;
  }
}

/**
 * 國定假日表 (115~116年)
 */
export const HOLIDAYS = [
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-27", "2026-04-03", "2026-04-06", "2026-05-01", "2026-06-19", "2026-09-25", "2026-10-09",
  "2027-01-01", "2027-02-05", "2027-02-08", "2027-02-09", "2027-02-10", "2027-04-05", "2027-06-09", "2027-09-15", "2027-10-10"
];

/**
 * 契約期間鎖定: 115/04/22 ~ 116/06/21
 */
export const CONTRACT_START = "2026-04-22";
export const CONTRACT_END = "2027-06-21";

/**
 * 計算區間內的工作日數 (扣除假日與週六日)
 */
export function getWorkdaysInRange(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  // 重置時間為 00:00:00 確保比較一致
  current.setHours(0, 0, 0, 0);
  const targetEnd = new Date(end);
  targetEnd.setHours(23, 59, 59, 999);

  while (current <= targetEnd) {
    const dayOfWeek = current.getDay();
    const ymd = format(current, "yyyy-MM-dd");
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !HOLIDAYS.includes(ymd)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/**
 * 取得破月比例 (Proration)
 * 考慮: 契約起迄、人員到職日
 */
export function getProration(onboardDate: string | null | undefined, yearMonth: string): number {
  const [y, m] = yearMonth.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0, 23, 59, 59);

  const contractStart = parseISO(CONTRACT_START);
  const contractEnd = parseISO(CONTRACT_END);
  const onboard = (onboardDate && isValid(parseISO(onboardDate))) ? parseISO(onboardDate) : contractStart;

  // 交集 [MonthStart, MonthEnd], [CONTRACT_START, CONTRACT_END], [Onboard, ∞]
  const intersectStart = new Date(Math.max(monthStart.getTime(), contractStart.getTime(), onboard.getTime()));
  const intersectEnd = new Date(Math.min(monthEnd.getTime(), contractEnd.getTime()));

  if (intersectStart > intersectEnd) return 0;

  const monthWorkdays = getWorkdaysInRange(monthStart, monthEnd);
  if (monthWorkdays === 0) return 1;

  const actualWorkdays = getWorkdaysInRange(intersectStart, intersectEnd);
  return Math.round((actualWorkdays / monthWorkdays) * 100) / 100;
}

/**
 * 判斷是否為協助員白名單 (USR01~USR11)
 */
export function isAssistant(userId: string | null | undefined): boolean {
  if (!userId) return false;
  // 匹配 USR001 ~ USR011
  const match = userId.toUpperCase().match(/^USR(00[1-9]|01[0-1])$/);
  return !!match;
}

/**
 * 取得當月最後一日的 Date 物件
 * @param yearMonth 格式 "yyyy-MM"
 */
export function getLastDayOfMonth(yearMonth: string): Date {
  const [y, m] = yearMonth.split("-").map(Number);
  // next month day 0 = last day of current month
  return new Date(y, m, 0, 23, 59, 59);
}

/**
 * 判斷人員在特定月份是否已到職 (以該月最後一日為準)
 */
export function isPersonActiveInMonth(onboardDate: string | null | undefined, yearMonth: string): boolean {
  if (!onboardDate) return false;
  const onboard = parseISO(onboardDate);
  if (!isValid(onboard)) return false;
  const lastDay = getLastDayOfMonth(yearMonth);
  return onboard <= lastDay;
}

/**
 * 轉換為民國年格式: 115/04/22
 */
export function toMinguoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = parseISO(dateStr);
  if (!isValid(date)) return dateStr;
  const year = date.getFullYear() - 1911;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}
