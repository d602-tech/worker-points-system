import { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, X, Upload, FileText,
  Loader2, Camera, CheckCircle2, AlertCircle, CalendarDays, LayoutGrid, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isToday, getDay, isBefore, startOfDay, addMonths,
} from "date-fns";
import { zhTW } from "date-fns/locale";
import { toast } from "sonner";
import { useGasAuthContext } from "@/lib/useGasAuth";
import {
  gasGet, gasPost, getFileIndexByDate, getDriveFolderId,
  type AttendanceRow, type DailyPointRow, type FileIndexRow,
} from "@/lib/gasApi";
import { POINTS_CONFIG_SEED } from "../../../../shared/domain";

// ============================================================
// 工具函式
// ============================================================

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// 型別定義
// ============================================================

type DayStatus = "none" | "draft" | "submitted" | "approved" | "rejected" | "holiday" | "leave";
type LeaveType = "特休" | "病假" | "事假" | "婚假" | "喪假" | "公假";

interface LeaveForm {
  startHour: number;   // 8–16
  endHour: number;     // 9–17
  leaveType: LeaveType;
  note: string;
  file: File | null;
}

// 可選起始時間（上班 08:00，不含午休起點 12:00 作為結束點）
const START_HOUR_OPTIONS = [8, 9, 10, 11, 13, 14, 15, 16];
// 可選結束時間（最晚 17:00，不含 12:00 前結束後立即接午後）
const END_HOUR_OPTIONS   = [9, 10, 11, 12, 14, 15, 16, 17];

function hourLabel(h: number): string {
  return `${String(h).padStart(2, "0")}:00`;
}

/** 計算 AM / PM 各請幾小時（午休 12:00–13:00 不計入） */
function computeLeaveHours(startH: number, endH: number) {
  const amHours = Math.max(0, Math.min(endH, 12) - Math.max(startH, 8));
  const pmHours = Math.max(0, Math.min(endH, 17) - Math.max(startH, 13));
  return { amHours, pmHours, total: amHours + pmHours };
}

// ============================================================
// 常數
// ============================================================

const LEAVE_PREFIX: Record<LeaveType, string> = {
  "特休": "特", "病假": "病", "事假": "事",
  "婚假": "婚", "喪假": "喪", "公假": "公",
};

const LEAVE_CODES = ["特", "病", "事", "婚", "喪", "公"];

const STATUS_DOT: Record<DayStatus, string> = {
  none: "", draft: "bg-amber-400", submitted: "bg-blue-500",
  approved: "bg-emerald-500", rejected: "bg-red-500",
  holiday: "bg-slate-400", leave: "bg-purple-400",
};

const STATUS_BG: Record<DayStatus, string> = {
  none: "",
  draft: "bg-amber-50 border-amber-200",
  submitted: "bg-blue-50 border-blue-200",
  approved: "bg-emerald-50 border-emerald-200",
  rejected: "bg-red-50 border-red-200",
  holiday: "bg-slate-50 border-slate-200",
  leave: "bg-purple-50 border-purple-200",
};

const STATUS_LABEL: Record<DayStatus, string> = {
  none: "未填報", draft: "草稿", submitted: "已送出",
  approved: "已通過", rejected: "已退回", holiday: "休假", leave: "請假",
};

const STATUS_BADGE: Record<DayStatus, string> = {
  none: "bg-slate-100 text-slate-500",
  draft: "bg-amber-100 text-amber-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  holiday: "bg-slate-100 text-slate-500",
  leave: "bg-purple-100 text-purple-700",
};

const POINT_STATUS_BADGE: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
};

const POINT_STATUS_LABEL: Record<string, string> = {
  draft: "草稿", submitted: "已送出", approved: "已通過", rejected: "已退回",
};

const LEGEND: { status: DayStatus; label: string }[] = [
  { status: "approved", label: "已通過" },
  { status: "submitted", label: "已送出" },
  { status: "draft", label: "草稿" },
  { status: "rejected", label: "已退回" },
  { status: "holiday", label: "休假" },
  { status: "leave", label: "請假" },
];

// ============================================================
// 2026 台灣國定假日（農曆假日以政府公告為準，每年更新）
// ============================================================

const TW_HOLIDAYS_2026: Set<string> = new Set([
  "2026-01-01", "2026-01-02",                                        // 元旦
  "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19",           // 農曆春節
  "2026-02-20", "2026-02-21", "2026-02-22", "2026-02-23",           // 農曆春節
  "2026-02-27", "2026-02-28",                                        // 和平紀念日
  "2026-04-03", "2026-04-04", "2026-04-05", "2026-04-06",           // 兒童節+清明
  "2026-05-01",                                                      // 勞動節
  "2026-06-19", "2026-06-20", "2026-06-22",                         // 端午節
  "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05",           // 中秋節
  "2026-10-09", "2026-10-10",                                        // 國慶日
]);

// ============================================================
// 狀態推導
// ============================================================

function deriveDayStatus(day: Date, att: AttendanceRow | undefined): DayStatus {
  const dow = getDay(day);
  if (dow === 0 || dow === 6) return "holiday";
  if (!att) return "none";
  const { amStatus, pmStatus, isFinalized } = att;
  const hasLeave = LEAVE_CODES.some(c => amStatus.startsWith(c) || pmStatus.startsWith(c));
  if (hasLeave) return "leave";
  if (isFinalized) return "approved";
  if (amStatus || pmStatus) return "submitted";
  return "none";
}

// ============================================================
// 主元件
// ============================================================

export default function CalendarOverview() {
  const { user } = useGasAuthContext();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceRow>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  // 視圖切換：月曆 / 出勤計畫表
  const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar");

  // Drawer
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayTasks, setDayTasks] = useState<DailyPointRow[]>([]);
  const [dayFiles, setDayFiles] = useState<FileIndexRow[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  // Leave modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState<LeaveForm>({
    startHour: 8, endHour: 17, leaveType: "特休", note: "", file: null,
  });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const leaveFileRef = useRef<HTMLInputElement>(null);
  const leaveCameraRef = useRef<HTMLInputElement>(null);

  // 出勤計畫表：下個月差勤 + 計畫送出
  const [nextMonthAttMap, setNextMonthAttMap] = useState<Record<string, AttendanceRow>>({});
  const [planSubmitting, setPlanSubmitting] = useState(false);

  // 今日點數摘要（月曆底部條）
  const [todayPointsSummary, setTodayPointsSummary] = useState<{ submitted: number; total: number } | null>(null);

  // ──────────────────────────────
  // 載入月份差勤
  // ──────────────────────────────
  const loadAttendance = useCallback(async (month: Date) => {
    if (!user?.id) return;
    const yearMonth = format(month, "yyyy-MM");
    setLoadingMonth(true);
    try {
      const res = await gasGet<AttendanceRow[]>("getAttendance", {
        workerId: user.id, yearMonth,
      });
      if (res.success && res.data) {
        const map: Record<string, AttendanceRow> = {};
        res.data.forEach(row => { map[row.date] = row; });
        setAttendanceMap(map);
      }
    } finally {
      setLoadingMonth(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadAttendance(currentMonth);
  }, [loadAttendance, currentMonth]);

  // 出勤計畫表視圖：同時載入下個月差勤
  useEffect(() => {
    if (viewMode !== "table" || !user?.id) return;
    const nextMonth = addMonths(currentMonth, 1);
    const yearMonth = format(nextMonth, "yyyy-MM");
    gasGet<AttendanceRow[]>("getAttendance", { workerId: user.id, yearMonth })
      .then(res => {
        if (res.success && res.data) {
          const map: Record<string, AttendanceRow> = {};
          res.data.forEach(row => { map[row.date] = row; });
          setNextMonthAttMap(map);
        }
      });
  }, [viewMode, currentMonth, user?.id]);

  // 月曆今日點數摘要（以上傳檔案為準，重整後仍可還原）
  useEffect(() => {
    if (!user?.id) return;
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const wt = user.workerType || "general";
    const dailyItems = POINTS_CONFIG_SEED.filter(i => i.workerType === wt && i.category === "A1");
    const totalPossible = dailyItems.reduce((s, i) => s + i.pointsPerUnit, 0);

    Promise.all([
      gasGet<DailyPointRow[]>("getDailyPoints", { workerId: user.id, date: todayStr }),
      getFileIndexByDate(user.id, todayStr),
    ]).then(([pointsRes, filesRes]) => {
      // 已上傳檔案的 itemId 集合
      const uploadedIds = new Set(
        filesRes.success && Array.isArray(filesRes.data)
          ? (filesRes.data as FileIndexRow[]).map(f => f.itemId)
          : []
      );
      let submitted = 0;
      if (pointsRes.success && Array.isArray(pointsRes.data)) {
        (pointsRes.data as DailyPointRow[]).forEach(row => {
          if (row.status === "submitted" || row.status === "approved" || uploadedIds.has(row.itemId)) {
            submitted += row.points || 0;
          }
        });
      } else {
        // Fallback：直接以 file index 反推點數
        dailyItems.forEach(item => {
          if (uploadedIds.has(item.itemId)) submitted += item.pointsPerUnit;
        });
      }
      setTodayPointsSummary({ submitted, total: totalPossible });
    });
  }, [user?.id, user?.workerType]);

  const updateDailyStatus = async (dateStr: string, period: "am" | "pm", val: string) => {
    if (!user?.id) return;
    const isNextMonth = dateStr.startsWith(format(addMonths(currentMonth, 1), "yyyy-MM"));
    const map = isNextMonth ? nextMonthAttMap : attendanceMap;
    const setMap = isNextMonth ? setNextMonthAttMap : setAttendanceMap as any;

    const existingAtt = map[dateStr] || {
      userId: user.id,
      date: dateStr,
      workHours: 8,
      amStatus: "",
      pmStatus: "",
      isFinalized: false,
      note: ""
    } as AttendanceRow;

    const newAtt = { ...existingAtt, [period === "am" ? "amStatus" : "pmStatus"]: val };

    let wh = 8;
    if (LEAVE_CODES.some(c => newAtt.amStatus && newAtt.amStatus.includes(c))) wh -= 4;
    if (LEAVE_CODES.some(c => newAtt.pmStatus && newAtt.pmStatus.includes(c))) wh -= 4;
    newAtt.workHours = Math.max(0, wh);

    setMap((prev: Record<string, AttendanceRow>) => ({ ...prev, [dateStr]: newAtt }));

    try {
      await gasPost("upsertAttendance", { record: newAtt });
    } catch {
      toast.error("狀態更新失敗");
    }
  };

  const estimatedPoints = useMemo(() => {
    if (!user || !user.workerType) return 0;
    const wt = user.workerType;
    let workDaysCount = 0;
    
    // 取當月所有的天數
    const daysInMonth = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });

    daysInMonth.forEach(d => {
      const dateStr = format(d, "yyyy-MM-dd");
      const isWeekend = getDay(d) === 0 || getDay(d) === 6;
      const isHoliday = TW_HOLIDAYS_2026.has(dateStr);
      const isOff = isWeekend || isHoliday;
      
      if (!isOff) {
        const att = attendanceMap[dateStr];
        let dayRatio = 1; // 1 = 8h, 0.5 = 4h
        if (att) {
          if (LEAVE_CODES.some(c => att.amStatus && att.amStatus.includes(c))) dayRatio -= 0.5;
          if (LEAVE_CODES.some(c => att.pmStatus && att.pmStatus.includes(c))) dayRatio -= 0.5;
        }
        workDaysCount += Math.max(0, dayRatio);
      }
    });

    const dailyItems = POINTS_CONFIG_SEED.filter(i => i.workerType === wt && i.category === "A1");
    const dailyPoints = dailyItems.reduce((s, i) => s + i.pointsPerUnit, 0);

    const monthlyItems = POINTS_CONFIG_SEED.filter(i => i.workerType === wt && (i.category === "B1" || i.category === "B2"));
    const monthlyPoints = monthlyItems.reduce((s, i) => s + i.pointsPerUnit, 0);

    const perfPoints = 2500; // 預設平
    
    return (workDaysCount * dailyPoints) + monthlyPoints + perfPoints;
  }, [attendanceMap, currentMonth, user]);

  // ──────────────────────────────
  // 送出出勤計畫
  // ──────────────────────────────
  const handleSubmitPlan = useCallback(async () => {
    if (!user) return;
    setPlanSubmitting(true);
    try {
      const nextMonth = addMonths(currentMonth, 1);
      const combined = { ...attendanceMap, ...nextMonthAttMap };
      const planDays = eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(nextMonth),
      });
      const records = planDays
        .filter(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isWeekend = getDay(day) === 0 || getDay(day) === 6;
          const isHoliday = TW_HOLIDAYS_2026.has(dateStr);
          return !isWeekend && !isHoliday && !combined[dateStr];
        })
        .map(day => ({
          userId: user.id,
          date: format(day, "yyyy-MM-dd"),
          amStatus: "／",
          pmStatus: "／",
          source: "planned",
          note: "出勤計畫",
        }));
      await gasPost("submitAttendancePlan", {
        callerEmail: user.email,
        workerId: user.id,
        records,
      });
      toast.success("出勤計畫已送出，主辦部門將收到通知");
      await loadAttendance(currentMonth);
      const nmRes = await gasGet<AttendanceRow[]>("getAttendance", {
        workerId: user.id, yearMonth: format(nextMonth, "yyyy-MM"),
      });
      if (nmRes.success && nmRes.data) {
        const map: Record<string, AttendanceRow> = {};
        nmRes.data.forEach(row => { map[row.date] = row; });
        setNextMonthAttMap(map);
      }
    } catch (err) {
      toast.error(`送出失敗：${String(err)}`);
    } finally {
      setPlanSubmitting(false);
    }
  }, [user, currentMonth, attendanceMap, nextMonthAttMap, loadAttendance]);

  // ──────────────────────────────
  // 點擊日期 → Drawer
  // ──────────────────────────────
  const handleDateClick = useCallback(async (dateStr: string) => {
    if (selectedDate === dateStr) {
      setSelectedDate(null);
      return;
    }
    setSelectedDate(dateStr);
    setDayTasks([]);
    setDayFiles([]);
    setDrawerLoading(true);
    if (user?.id) {
      const [tasksRes, filesRes] = await Promise.all([
        gasGet<DailyPointRow[]>("getDailyPoints", { workerId: user.id, date: dateStr }),
        getFileIndexByDate(user.id, dateStr),
      ]);
      if (tasksRes.success && tasksRes.data) setDayTasks(tasksRes.data);
      if (filesRes.success && filesRes.data) setDayFiles(filesRes.data);
    }
    setDrawerLoading(false);
  }, [selectedDate, user?.id]);

  // ──────────────────────────────
  // 請假送出
  // ──────────────────────────────
  const handleLeaveSubmit = async () => {
    if (!leaveForm.file) { setLeaveError("請上傳假單佐證"); return; }
    const { amHours, pmHours, total } = computeLeaveHours(leaveForm.startHour, leaveForm.endHour);
    if (total === 0) { setLeaveError("請假時數為 0，請重新選擇時間範圍"); return; }
    if (!selectedDate || !user) return;

    setLeaveSubmitting(true);
    setLeaveError(null);

    try {
      // 1. 上傳假單至 Drive
      const base64Data = await blobToBase64(leaveForm.file);
      const uploadRes = await gasPost<{ driveFileId: string; fileName: string }>(
        "uploadFileToDrive", {
          callerEmail: user.email,
          base64Data,
          fileName: leaveForm.file.name,
          mimeType: leaveForm.file.type,
          workerId: user.id,
          date: selectedDate,
          category: "請假佐證",
          driveFolderId: getDriveFolderId(),
        }
      );
      if (!uploadRes.success || !uploadRes.data) {
        setLeaveError(`上傳失敗：${uploadRes.error ?? "未知錯誤"}`);
        return;
      }
      const { driveFileId } = uploadRes.data;

      // 2. 寫入檔案索引
      await gasPost("saveFileIndex", {
        callerEmail: user.email,
        record: {
          userId: user.id, date: selectedDate, itemId: "LEAVE",
          fileName: leaveForm.file.name, mimeType: leaveForm.file.type, driveFileId,
        },
      });

      // 3. 計算 amStatus / pmStatus（依時段小時數）
      const pfx = LEAVE_PREFIX[leaveForm.leaveType];
      const amStatus = amHours > 0 ? `${pfx}${amHours}` : "／";
      const pmStatus = pmHours > 0 ? `${pfx}${pmHours}` : "／";

      // 4. 寫入差勤
      await gasPost("upsertAttendance", {
        callerEmail: user.email,
        record: {
          userId: user.id, date: selectedDate,
          amStatus, pmStatus, source: "actual",
          note: leaveForm.note,
        },
      });

      // 5. 重新載入月份差勤
      await loadAttendance(currentMonth);

      // 6. 關閉 modal，重設表單
      setShowLeaveModal(false);
      setLeaveForm({ startHour: 8, endHour: 17, leaveType: "特休", note: "", file: null });
    } catch (err) {
      setLeaveError(`操作失敗：${String(err)}`);
    } finally {
      setLeaveSubmitting(false);
    }
  };

  // ──────────────────────────────
  // 月曆計算
  // ──────────────────────────────
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);

  const approvedCount = days.filter(d =>
    deriveDayStatus(d, attendanceMap[format(d, "yyyy-MM-dd")]) === "approved"
  ).length;
  const submittedCount = days.filter(d =>
    deriveDayStatus(d, attendanceMap[format(d, "yyyy-MM-dd")]) === "submitted"
  ).length;
  const leaveCount = days.filter(d =>
    deriveDayStatus(d, attendanceMap[format(d, "yyyy-MM-dd")]) === "leave"
  ).length;

  // 選定日期的差勤記錄
  const selectedAtt = selectedDate ? attendanceMap[selectedDate] : undefined;
  const selectedDayObj = selectedDate ? new Date(selectedDate) : null;
  const isFinalized = selectedAtt?.isFinalized ?? false;
  const isPast = selectedDayObj ? isBefore(startOfDay(selectedDayObj), startOfDay(new Date())) : false;
  const canLeave = !isFinalized;

  // ──────────────────────────────
  // Render
  // ──────────────────────────────
  return (
    <div className="flex flex-col min-h-full bg-background">

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <div className="text-base font-semibold text-foreground flex items-center gap-1.5">
              {format(currentMonth, "yyyy年M月", { locale: zhTW })}
              {loadingMonth && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">日曆總覽</div>
          </div>
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Stats + 申請請假按鈕 */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="flex-1 grid grid-cols-3 gap-2">
            {[
              { label: "已通過", value: approvedCount, color: "text-emerald-700 bg-emerald-50" },
              { label: "已送出", value: submittedCount, color: "text-blue-700 bg-blue-50" },
              { label: "請假", value: leaveCount, color: "text-purple-700 bg-purple-50" },
            ].map(({ label, value, color }) => (
              <div key={label} className={cn("rounded-xl p-2.5 text-center", color)}>
                <div className="text-xl font-bold">{value}</div>
                <div className="text-xs font-medium">{label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              // 預設選今天，再開請假 modal
              const todayStr = format(new Date(), "yyyy-MM-dd");
              setSelectedDate(todayStr);
              setShowLeaveModal(true);
              setLeaveError(null);
            }}
            className="flex flex-col items-center justify-center gap-1 px-3 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 active:scale-95 transition-all flex-shrink-0"
          >
            <span className="text-base leading-none">＋</span>
            <span>請假</span>
          </button>
        </div>

        {/* 預估總點數面板 */}
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="text-sm font-semibold text-blue-800">本月預估點數（依現有出勤、加上固定/績效估計）</div>
            <div className="text-lg font-bold text-blue-700">{estimatedPoints.toLocaleString()}</div>
          </div>
        </div>

        {/* 視圖切換 */}
        <div className="flex px-4 pb-3 gap-2">
          <button
            onClick={() => setViewMode("calendar")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all",
              viewMode === "calendar"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-muted-foreground border-border hover:border-blue-300",
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />月曆
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all",
              viewMode === "table"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-muted-foreground border-border hover:border-blue-300",
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />出勤計畫表
          </button>
        </div>
      </div>

      {/* ── 出勤計畫表視圖（當月 + 次月，含國定假日預設）── */}
      {viewMode === "table" && (() => {
        const nextMonth = addMonths(currentMonth, 1);
        const combined = { ...attendanceMap, ...nextMonthAttMap };
        const planDays = eachDayOfInterval({
          start: startOfMonth(currentMonth),
          end: endOfMonth(nextMonth),
        });
        return (
          <div className="px-4 py-4 space-y-3 pb-36">
            <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-border">
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground w-12">日</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">週</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">上午</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">下午</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">工時</th>
                    <th className="px-2 py-2.5 text-center text-xs font-semibold text-muted-foreground">狀態</th>
                  </tr>
                </thead>
                <tbody>
                  {planDays.flatMap((day, idx) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const prevDay = idx > 0 ? planDays[idx - 1] : null;
                    const isNewMonth = !prevDay || day.getMonth() !== prevDay.getMonth();
                    const att = combined[dateStr];
                    const isWeekend = getDay(day) === 0 || getDay(day) === 6;
                    const isHoliday = TW_HOLIDAYS_2026.has(dateStr);
                    const isTodayDate = isToday(day);
                    const status = deriveDayStatus(day, att);
                    const isOff = isWeekend || isHoliday;

                    const rows = [];
                    if (isNewMonth) {
                      rows.push(
                        <tr key={`mh-${dateStr}`} className="bg-blue-600">
                          <td colSpan={6} className="px-3 py-1.5 text-xs font-bold text-white">
                            {format(day, "yyyy年M月", { locale: zhTW })}
                          </td>
                        </tr>
                      );
                    }
                    rows.push(
                      <tr
                        key={dateStr}
                        onClick={() => !isOff && handleDateClick(dateStr)}
                        className={cn(
                          "border-b border-border/40 transition-colors",
                          isOff ? "bg-slate-50/60 text-muted-foreground/50" : "hover:bg-muted/30 cursor-pointer",
                          isTodayDate && "bg-blue-50/60",
                        )}
                      >
                        <td className="px-3 py-2">
                          <span className={cn("font-medium text-xs", isTodayDate && "text-blue-700 font-bold")}>
                            {format(day, "d")}
                            {isHoliday && !isWeekend && (
                              <span className="ml-0.5 text-[9px] text-red-500">假</span>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center text-xs text-muted-foreground">
                          {["日", "一", "二", "三", "四", "五", "六"][getDay(day)]}
                        </td>
                        <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {!att?.isFinalized && !isOff && viewMode === "table" ? (
                            <select
                              value={att?.amStatus || ""}
                              onChange={e => updateDailyStatus(dateStr, "am", e.target.value)}
                              className="text-xs font-medium px-1.5 py-0.5 rounded bg-white border border-slate-300 outline-none focus:ring-2 focus:ring-blue-400"
                            >
                              <option value="">—</option>
                              <option value="本處">本處</option>
                              <option value="工地">工地</option>
                              <option value="公假">公假</option>
                              <option value="特休">特休</option>
                              <option value="事假">事假</option>
                              <option value="病假">病假</option>
                              <option value="婚假">婚假</option>
                              <option value="喪假">喪假</option>
                            </select>
                          ) : att?.amStatus ? (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100">{att.amStatus}</span>
                          ) : isOff ? (
                            <span className="text-xs text-muted-foreground/30">—</span>
                          ) : (
                            <span className="text-xs text-slate-300 font-medium">／</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {!att?.isFinalized && !isOff && viewMode === "table" ? (
                            <select
                              value={att?.pmStatus || ""}
                              onChange={e => updateDailyStatus(dateStr, "pm", e.target.value)}
                              className="text-xs font-medium px-1.5 py-0.5 rounded bg-white border border-slate-300 outline-none focus:ring-2 focus:ring-blue-400"
                            >
                              <option value="">—</option>
                              <option value="本處">本處</option>
                              <option value="工地">工地</option>
                              <option value="公假">公假</option>
                              <option value="特休">特休</option>
                              <option value="事假">事假</option>
                              <option value="病假">病假</option>
                              <option value="婚假">婚假</option>
                              <option value="喪假">喪假</option>
                            </select>
                          ) : att?.pmStatus ? (
                            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-slate-100">{att.pmStatus}</span>
                          ) : isOff ? (
                            <span className="text-xs text-muted-foreground/30">—</span>
                          ) : (
                            <span className="text-xs text-slate-300 font-medium">／</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-center text-xs text-muted-foreground">
                          {att?.workHours ? `${att.workHours}h` : isOff ? "—" : "8h"}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {isHoliday ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">國假</span>
                          ) : isWeekend ? (
                            <span className="text-[10px] text-muted-foreground/40">休</span>
                          ) : status !== "none" ? (
                            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", STATUS_BADGE[status])}>
                              {STATUS_LABEL[status]}
                            </span>
                          ) : (
                            <span className="text-[10px] text-blue-400 font-medium">預設出勤</span>
                          )}
                        </td>
                      </tr>
                    );
                    return rows;
                  })}
                </tbody>
              </table>
            </div>

            {/* 送出出勤計畫 */}
            <button
              onClick={handleSubmitPlan}
              disabled={planSubmitting}
              className="w-full py-3.5 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-elegant"
            >
              {planSubmitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />送出中...</>
              ) : (
                <><Send className="w-4 h-4" />送出出勤計畫（通知主辦部門）</>
              )}
            </button>
          </div>
        );
      })()}

      {/* ── Calendar Grid ── */}
      {viewMode === "calendar" && (
      <>
      <div className="px-4 py-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {["日", "一", "二", "三", "四", "五", "六"].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDow }).map((_, i) => <div key={`e-${i}`} />)}
          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const status = deriveDayStatus(day, attendanceMap[dateStr]);
            const isSelected = selectedDate === dateStr;
            const isTodayDate = isToday(day);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;

            return (
              <button
                key={dateStr}
                onClick={() => handleDateClick(dateStr)}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-medium transition-all duration-150 border",
                  status !== "none"
                    ? STATUS_BG[status]
                    : "border-transparent hover:bg-muted/50",
                  isSelected && "ring-2 ring-blue-500 ring-offset-1",
                  isWeekend && status === "none" && "text-muted-foreground/60",
                )}
              >
                <span className={cn(
                  "text-sm leading-none",
                  isTodayDate
                    ? "text-blue-700 font-bold"
                    : (isWeekend && status === "none" ? "text-muted-foreground/60" : "text-foreground"),
                )}>
                  {format(day, "d")}
                </span>
                {status !== "none" && (
                  <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status])} />
                )}
                {isTodayDate && todayPointsSummary && todayPointsSummary.total > 0 && (
                  <div className="w-4/5 h-1 rounded-full overflow-hidden bg-slate-100 flex">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.min(100, (todayPointsSummary.submitted / todayPointsSummary.total) * 100)}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-2xl p-4 shadow-elegant border border-border/50">
          <div className="text-xs font-medium text-muted-foreground mb-3">圖例</div>
          <div className="grid grid-cols-3 gap-2">
            {LEGEND.map(({ status, label }) => (
              <div key={status} className="flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", STATUS_DOT[status])} />
                <span className="text-xs text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
      )}

      {/* ── Bottom Drawer ── */}
      {selectedDate && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setSelectedDate(null)}
          />

          {/* Drawer panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[75vh] flex flex-col">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
              <div>
                <div className="text-base font-semibold text-foreground">
                  {selectedDate && format(new Date(selectedDate), "M月d日（EEE）", { locale: zhTW })}
                </div>
                <div className={cn(
                  "inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs font-medium",
                  STATUS_BADGE[deriveDayStatus(
                    new Date(selectedDate),
                    attendanceMap[selectedDate],
                  )],
                )}>
                  {STATUS_LABEL[deriveDayStatus(
                    new Date(selectedDate),
                    attendanceMap[selectedDate],
                  )]}
                </div>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Drawer content (scrollable) */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {drawerLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* 差勤狀態 */}
                  {selectedAtt && (
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="text-xs font-medium text-muted-foreground mb-2">差勤</div>
                      <div className="flex gap-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">上午</span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-border text-sm font-medium text-foreground">
                            {selectedAtt.amStatus || "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-muted-foreground">下午</span>
                          <span className="px-2 py-0.5 rounded-md bg-white border border-border text-sm font-medium text-foreground">
                            {selectedAtt.pmStatus || "—"}
                          </span>
                        </div>
                        {selectedAtt.workHours > 0 && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-xs text-muted-foreground">工時</span>
                            <span className="text-sm font-medium text-foreground">{selectedAtt.workHours}h</span>
                          </div>
                        )}
                      </div>
                      {selectedAtt.note && (
                        <div className="mt-2 text-xs text-muted-foreground">{selectedAtt.note}</div>
                      )}
                    </div>
                  )}

                  {/* 工作項目 */}
                  {dayTasks.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        工作項目（{dayTasks.length} 項）
                      </div>
                      <div className="space-y-2">
                        {dayTasks.map(task => (
                          <div key={task.id}
                            className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                            <div className="flex-1 min-w-0 mr-2">
                              <div className="text-sm font-medium text-foreground truncate">
                                {task.itemName}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {task.points} 元
                              </div>
                            </div>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0",
                              POINT_STATUS_BADGE[task.status] ?? "bg-slate-100 text-slate-500",
                            )}>
                              {POINT_STATUS_LABEL[task.status] ?? task.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 已上傳檔案 */}
                  {dayFiles.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        佐證檔案（{dayFiles.length} 個）
                      </div>
                      <div className="space-y-2">
                        {dayFiles.map(f => (
                          <a
                            key={f.fileId}
                            href={`https://drive.google.com/file/d/${f.driveFileId}/view`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 transition-colors rounded-xl px-3 py-2.5"
                          >
                            <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm text-blue-600 truncate">{f.fileName}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {f.uploadedAt ? format(new Date(f.uploadedAt), "HH:mm") : ""}
                              </div>
                            </div>
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 無資料 */}
                  {!selectedAtt && dayTasks.length === 0 && dayFiles.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      此日尚無填報資料
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer footer：申請請假按鈕 */}
            {canLeave && (
              <div className="px-5 pb-6 pt-3 border-t border-border/60">
                <button
                  onClick={() => { setShowLeaveModal(true); setLeaveError(null); }}
                  className="w-full py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 active:bg-purple-800 transition-colors"
                >
                  申請請假
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Leave Modal ── */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          {/* Modal header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-border bg-white">
            <div>
              <div className="text-base font-semibold text-foreground">申請請假</div>
              {selectedDate && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {format(new Date(selectedDate), "M月d日（EEE）", { locale: zhTW })}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowLeaveModal(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Modal content */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
            {/* 請假時段（起迄時間，最小單位 1 小時） */}
            <div>
              <div className="text-sm font-medium text-foreground mb-1">請假時間</div>
              <div className="text-xs text-muted-foreground mb-3">午休 12:00–13:00 不計入時數</div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-xs font-medium text-muted-foreground mb-1">開始時間</div>
                  <select
                    value={leaveForm.startHour}
                    onChange={e => {
                      const h = Number(e.target.value);
                      setLeaveForm(f => ({
                        ...f,
                        startHour: h,
                        endHour: f.endHour <= h ? Math.min(h + 1, 17) : f.endHour,
                      }));
                    }}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {START_HOUR_OPTIONS.map(h => (
                      <option key={h} value={h}>{hourLabel(h)}</option>
                    ))}
                  </select>
                </div>
                <div className="text-sm font-bold text-muted-foreground pt-5">～</div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-muted-foreground mb-1">結束時間</div>
                  <select
                    value={leaveForm.endHour}
                    onChange={e => setLeaveForm(f => ({ ...f, endHour: Number(e.target.value) }))}
                    className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {END_HOUR_OPTIONS.filter(h => h > leaveForm.startHour).map(h => (
                      <option key={h} value={h}>{hourLabel(h)}</option>
                    ))}
                  </select>
                </div>
              </div>
              {/* 時數預覽 */}
              {(() => {
                const { amHours, pmHours, total } = computeLeaveHours(leaveForm.startHour, leaveForm.endHour);
                return total > 0 ? (
                  <div className="mt-2.5 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-blue-700 font-medium">
                      {amHours > 0 && `上午 ${amHours}h`}
                      {amHours > 0 && pmHours > 0 && "　"}
                      {pmHours > 0 && `下午 ${pmHours}h`}
                    </span>
                    <span className="text-xs font-bold text-blue-800">共 {total} 小時</span>
                  </div>
                ) : (
                  <div className="mt-2.5 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                    <span className="text-xs text-red-600 font-medium">時間範圍無效（請調整起迄時間）</span>
                  </div>
                );
              })()}
            </div>

            {/* 假別 */}
            <div>
              <div className="text-sm font-medium text-foreground mb-2">假別</div>
              <div className="grid grid-cols-3 gap-2">
                {(["特休", "病假", "事假", "婚假", "喪假", "公假"] as LeaveType[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setLeaveForm(f => ({ ...f, leaveType: t }))}
                    className={cn(
                      "py-2.5 rounded-xl text-sm font-medium border transition-all",
                      leaveForm.leaveType === t
                        ? "bg-purple-600 border-purple-600 text-white"
                        : "bg-white border-border text-foreground",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 備註 */}
            <div>
              <div className="text-sm font-medium text-foreground mb-2">備註（選填）</div>
              <textarea
                value={leaveForm.note}
                onChange={e => setLeaveForm(f => ({ ...f, note: e.target.value }))}
                rows={2}
                placeholder="如：就醫、家庭事由..."
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* 假單佐證（必填） */}
            <div>
              <div className="text-sm font-medium text-foreground mb-1">
                假單佐證
                <span className="text-red-500 ml-0.5">*</span>
              </div>
              <div className="text-xs text-muted-foreground mb-3">請上傳假單、醫療證明等相關文件</div>

              {leaveForm.file ? (
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-emerald-800 truncate">{leaveForm.file.name}</div>
                    <div className="text-xs text-emerald-600">
                      {(leaveForm.file.size / 1024).toFixed(0)} KB
                    </div>
                  </div>
                  <button
                    onClick={() => setLeaveForm(f => ({ ...f, file: null }))}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-emerald-200 transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-emerald-700" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => leaveCameraRef.current?.click()}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <Camera className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">拍照</span>
                  </button>
                  <button
                    onClick={() => leaveFileRef.current?.click()}
                    className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-dashed border-border hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">上傳檔案</span>
                  </button>
                </div>
              )}

              <input
                ref={leaveCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setLeaveForm(fm => ({ ...fm, file: f }));
                  e.target.value = "";
                }}
              />
              <input
                ref={leaveFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setLeaveForm(fm => ({ ...fm, file: f }));
                  e.target.value = "";
                }}
              />
            </div>

            {/* Error */}
            {leaveError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700">{leaveError}</span>
              </div>
            )}
          </div>

          {/* Modal footer */}
          <div className="px-4 pb-8 pt-3 border-t border-border bg-white grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowLeaveModal(false)}
              disabled={leaveSubmitting}
              className="py-3 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleLeaveSubmit}
              disabled={leaveSubmitting || !leaveForm.file}
              className="py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 active:bg-purple-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {leaveSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  上傳中...
                </>
              ) : "確認送出"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
