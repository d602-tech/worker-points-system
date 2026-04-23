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
