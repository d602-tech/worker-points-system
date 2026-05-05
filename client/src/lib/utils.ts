import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO, isValid } from "date-fns";
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
 * 契約期間鎖定: 115/04/22 ~ 116/06/21
 */
export const CONTRACT_START = "2026-04-22";
export const CONTRACT_END = "2027-06-21";

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
 * 轉換為民國年格式: 115/04/22
 */
export function toMinguoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const year = date.getFullYear() - 1911;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}
