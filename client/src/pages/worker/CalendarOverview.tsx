import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, getDay } from "date-fns";
import { zhTW } from "date-fns/locale";

type DayStatus = "none" | "draft" | "submitted" | "approved" | "rejected" | "holiday" | "leave";

const MOCK_STATUS: Record<string, DayStatus> = {
  "2026-04-01": "approved", "2026-04-02": "approved", "2026-04-03": "approved",
  "2026-04-04": "holiday",  "2026-04-05": "holiday",
  "2026-04-07": "approved", "2026-04-08": "submitted", "2026-04-09": "draft",
};

const STATUS_DOT: Record<DayStatus, string> = {
  none: "", draft: "bg-amber-400", submitted: "bg-blue-500",
  approved: "bg-emerald-500", rejected: "bg-red-500",
  holiday: "bg-slate-400", leave: "bg-purple-400",
};

const STATUS_BG: Record<DayStatus, string> = {
  none: "", draft: "bg-amber-50 border-amber-200", submitted: "bg-blue-50 border-blue-200",
  approved: "bg-emerald-50 border-emerald-200", rejected: "bg-red-50 border-red-200",
  holiday: "bg-slate-50 border-slate-200", leave: "bg-purple-50 border-purple-200",
};

const LEGEND = [
  { status: "approved" as DayStatus, label: "已通過" },
  { status: "submitted" as DayStatus, label: "已送出" },
  { status: "draft" as DayStatus, label: "草稿" },
  { status: "rejected" as DayStatus, label: "已退回" },
  { status: "holiday" as DayStatus, label: "休假" },
  { status: "leave" as DayStatus, label: "請假" },
];

export default function CalendarOverview() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 3, 1));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);

  const approvedCount = Object.values(MOCK_STATUS).filter(s => s === "approved").length;
  const submittedCount = Object.values(MOCK_STATUS).filter(s => s === "submitted").length;
  const draftCount = Object.values(MOCK_STATUS).filter(s => s === "draft").length;

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <div className="text-base font-semibold text-foreground">
              {format(currentMonth, "yyyy年M月", { locale: zhTW })}
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

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 px-4 pb-4">
          {[
            { label: "已通過", value: approvedCount, color: "text-emerald-700 bg-emerald-50" },
            { label: "已送出", value: submittedCount, color: "text-blue-700 bg-blue-50" },
            { label: "草稿", value: draftCount, color: "text-amber-700 bg-amber-50" },
          ].map(({ label, value, color }) => (
            <div key={label} className={cn("rounded-xl p-2.5 text-center", color)}>
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs font-medium">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="px-4 py-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {["日", "一", "二", "三", "四", "五", "六"].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDow }).map((_, i) => <div key={`empty-${i}`} />)}
          {days.map(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const status = MOCK_STATUS[dateStr] || "none";
            const isSelected = selectedDate === dateStr;
            const isTodayDate = isToday(day);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={cn(
                  "aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm font-medium transition-all duration-150 border",
                  status !== "none" ? STATUS_BG[status] : "border-transparent hover:bg-muted/50",
                  isSelected && "ring-2 ring-blue-500 ring-offset-1",
                  isWeekend && status === "none" && "text-muted-foreground/60",
                )}
              >
                <span className={cn(
                  "text-sm leading-none",
                  isTodayDate ? "text-blue-700 font-bold" : (isWeekend && status === "none" ? "text-muted-foreground/60" : "text-foreground")
                )}>
                  {format(day, "d")}
                </span>
                {status !== "none" && (
                  <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_DOT[status])} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
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

      {/* Selected day detail */}
      {selectedDate && (
        <div className="px-4 pb-4">
          <div className="bg-white rounded-2xl p-4 shadow-elegant border border-border/50">
            <div className="text-sm font-semibold text-foreground mb-2">{selectedDate} 詳情</div>
            <div className="text-sm text-muted-foreground">
              {MOCK_STATUS[selectedDate] ? (
                <span>狀態：{LEGEND.find(l => l.status === MOCK_STATUS[selectedDate])?.label}</span>
              ) : (
                <span>未填報</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
