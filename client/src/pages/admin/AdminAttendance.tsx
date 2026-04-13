import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from "date-fns";
import { zhTW } from "date-fns/locale";

type LeaveType = "上班" | "特休" | "病假" | "事假" | "婚假" | "喪假" | "公假" | "代理" | "暠職" | "清除";
type Hours = 1 | 2 | 3 | 4 | 8;

interface AttRecord {
  workerId: string; workerName: string;
  leaveType: LeaveType; hours: Hours; proxyName?: string;
}

const LEAVE_TYPES: LeaveType[] = ["上班", "特休", "病假", "事假", "婚假", "喪假", "公假", "代理", "暠職", "清除"];
const LEAVE_COLORS: Record<LeaveType, string> = {
  "上班": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "特休": "bg-blue-100 text-blue-700 border-blue-200",
  "病假": "bg-amber-100 text-amber-700 border-amber-200",
  "事假": "bg-orange-100 text-orange-700 border-orange-200",
  "婚假": "bg-pink-100 text-pink-700 border-pink-200",
  "喪假": "bg-slate-100 text-slate-700 border-slate-200",
  "公假": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "代理": "bg-purple-100 text-purple-700 border-purple-200",
  "暠職": "bg-red-100 text-red-700 border-red-200",
  "清除": "bg-gray-100 text-gray-600 border-gray-200",
};

const MOCK_WORKERS = [
  { id: "W001", name: "王小明" },
  { id: "W002", name: "李大華" },
  { id: "W003", name: "陳美玲" },
];

const MOCK_RECORDS: Record<string, AttRecord> = {
  "2026-04-01_W001": { workerId: "W001", workerName: "王小明", leaveType: "上班", hours: 8 },
  "2026-04-02_W001": { workerId: "W001", workerName: "王小明", leaveType: "上班", hours: 8 },
  "2026-04-03_W001": { workerId: "W001", workerName: "王小明", leaveType: "特休", hours: 8 },
  "2026-04-07_W002": { workerId: "W002", workerName: "李大華", leaveType: "病假", hours: 4 },
  "2026-04-08_W003": { workerId: "W003", workerName: "陳美玲", leaveType: "上班", hours: 8 },
};

export default function AdminAttendance() {
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 3, 1));
  const [selectedWorker, setSelectedWorker] = useState("W001");
  const [editDialog, setEditDialog] = useState<{ date: string; record: Partial<AttRecord> } | null>(null);
  const [records, setRecords] = useState(MOCK_RECORDS);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);

  const openEdit = (dateStr: string) => {
    const key = `${dateStr}_${selectedWorker}`;
    const existing = records[key];
    setEditDialog({
      date: dateStr,
      record: existing || { workerId: selectedWorker, workerName: MOCK_WORKERS.find(w => w.id === selectedWorker)?.name || "", leaveType: "上班", hours: 8 },
    });
  };

  const saveRecord = () => {
    if (!editDialog) return;
    const key = `${editDialog.date}_${selectedWorker}`;
    if (editDialog.record.leaveType === "清除") {
      const next = { ...records };
      delete next[key];
      setRecords(next);
    } else {
      setRecords(prev => ({ ...prev, [key]: editDialog.record as AttRecord }));
    }
    toast.success(`${editDialog.date} 差勤已更新`);
    setEditDialog(null);
  };

  const workerName = MOCK_WORKERS.find(w => w.id === selectedWorker)?.name || "";
  const workerRecords = Object.entries(records)
    .filter(([k]) => k.includes(`_${selectedWorker}`) && k.startsWith(format(currentMonth, "yyyy-MM")))
    .map(([, v]) => v);
  const workDays = workerRecords.filter(r => r.leaveType === "上班").length;
  const leaveDays = workerRecords.filter(r => r.leaveType !== "上班" && r.leaveType !== "清除").length;
  const annualLeave = workerRecords.filter(r => r.leaveType === "特休").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">差勤管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">點擊日期格子可編輯差勤記錄</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[80px] text-center">{format(currentMonth, "yyyy年M月", { locale: zhTW })}</span>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-start">
        <div className="flex gap-2 flex-wrap">
          {MOCK_WORKERS.map(w => (
            <button key={w.id} onClick={() => setSelectedWorker(w.id)}
              className={cn("px-3 py-1.5 text-sm font-medium rounded-lg border transition-all",
                selectedWorker === w.id ? "bg-blue-700 text-white border-blue-700" : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
              {w.name}
            </button>
          ))}
        </div>
        <div className="flex gap-3 ml-auto">
          {[
            { label: "出勤天數", value: workDays, color: "text-emerald-700 bg-emerald-50" },
            { label: "請假天數", value: leaveDays, color: "text-amber-700 bg-amber-50" },
            { label: "特休天數", value: annualLeave, color: "text-blue-700 bg-blue-50" },
          ].map(({ label, value, color }) => (
            <div key={label} className={cn("rounded-xl px-4 py-2 text-center", color)}>
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs">{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden">
        <div className="p-4">
          <div className="grid grid-cols-7 mb-2">
            {["日", "一", "二", "三", "四", "五", "六"].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDow }).map((_, i) => <div key={`e-${i}`} />)}
            {days.map(day => {
              const dateStr = format(day, "yyyy-MM-dd");
              const key = `${dateStr}_${selectedWorker}`;
              const rec = records[key];
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;
              const isTodayDate = isToday(day);
              return (
                <button key={dateStr} onClick={() => openEdit(dateStr)}
                  className={cn(
                    "min-h-[64px] rounded-xl border p-1.5 flex flex-col items-center gap-1 transition-all hover:ring-2 hover:ring-blue-300",
                    rec ? LEAVE_COLORS[rec.leaveType] : (isWeekend ? "bg-slate-50 border-slate-100 text-slate-400" : "bg-muted/20 border-border/30 hover:bg-muted/40"),
                  )}>
                  <span className={cn("text-xs font-semibold leading-none", isTodayDate && "text-blue-700")}>{format(day, "d")}</span>
                  {rec && (
                    <>
                      <span className="text-[10px] font-medium leading-none">{rec.leaveType}</span>
                      {rec.hours !== 8 && (
                        <span className="text-[9px] flex items-center gap-0.5 opacity-70">
                          <Clock className="w-2.5 h-2.5" />{rec.hours}h
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border/30 flex flex-wrap gap-2">
          {LEAVE_TYPES.filter(t => t !== "清除").map(t => (
            <span key={t} className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border", LEAVE_COLORS[t])}>{t}</span>
          ))}
        </div>
      </div>

      {editDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-foreground">編輯差勤 — {workerName} {editDialog.date}</h3>
              <button onClick={() => setEditDialog(null)} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="mb-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">假別</div>
              <div className="grid grid-cols-5 gap-1.5">
                {LEAVE_TYPES.map(t => (
                  <button key={t} onClick={() => setEditDialog(prev => prev ? { ...prev, record: { ...prev.record, leaveType: t } } : null)}
                    className={cn("py-2 rounded-lg text-xs font-medium border transition-all",
                      editDialog.record.leaveType === t
                        ? (t === "清除" ? "bg-red-600 text-white border-red-600" : LEAVE_COLORS[t] + " border-2")
                        : "bg-muted/30 text-muted-foreground border-border hover:border-muted-foreground")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {editDialog.record.leaveType !== "清除" && (
              <div className="mb-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">時數</div>
                <div className="flex gap-2">
                  {([1, 2, 3, 4, 8] as Hours[]).map(h => (
                    <button key={h} onClick={() => setEditDialog(prev => prev ? { ...prev, record: { ...prev.record, hours: h } } : null)}
                      className={cn("flex-1 py-2 rounded-lg text-sm font-semibold border transition-all",
                        editDialog.record.hours === h ? "bg-blue-700 text-white border-blue-700" : "bg-muted/30 text-muted-foreground border-border hover:border-muted-foreground")}>
                      {h}h
                    </button>
                  ))}
                </div>
              </div>
            )}
            {editDialog.record.leaveType === "代理" && (
              <div className="mb-4">
                <div className="text-xs font-medium text-muted-foreground mb-2">代理人姓名</div>
                <input type="text" placeholder="輸入代理人姓名..."
                  value={editDialog.record.proxyName || ""}
                  onChange={e => setEditDialog(prev => prev ? { ...prev, record: { ...prev.record, proxyName: e.target.value } } : null)}
                  className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditDialog(null)}>取消</Button>
              <Button className="flex-1 bg-blue-700 hover:bg-blue-800" onClick={saveRecord}>儲存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
