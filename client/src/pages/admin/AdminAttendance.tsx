import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { LoadingOverlay } from "@/components/LoadingOverlay";

// ── 狀態碼工具 ───────────────────────────────────────────────
// 格式：／ | 特N | 病N | 事N | 婚N | 喪N | 公N | 代_姓名 | 曠
type StatusType = "／" | "特" | "病" | "事" | "婚" | "喪" | "公" | "代_" | "曠";

const STATUS_TYPES: StatusType[] = ["／", "特", "病", "事", "婚", "喪", "公", "代_", "曠"];

const STATUS_TYPE_LABELS: Record<StatusType, string> = {
  "／": "出勤", "特": "特休", "病": "病假", "事": "事假",
  "婚": "婚假", "喪": "喪假", "公": "公假", "代_": "代理", "曠": "曠職",
};

const STATUS_COLORS: Record<StatusType, string> = {
  "／": "text-emerald-700 bg-emerald-50 border-emerald-200",
  "特": "text-blue-700 bg-blue-50 border-blue-200",
  "病": "text-amber-700 bg-amber-50 border-amber-200",
  "事": "text-orange-700 bg-orange-50 border-orange-200",
  "婚": "text-pink-700 bg-pink-50 border-pink-200",
  "喪": "text-slate-700 bg-slate-50 border-slate-200",
  "公": "text-cyan-700 bg-cyan-50 border-cyan-200",
  "代_": "text-purple-700 bg-purple-50 border-purple-200",
  "曠": "text-red-700 bg-red-50 border-red-200",
};

function getStatusType(status: string): StatusType {
  if (status === "／") return "／";
  if (status === "曠") return "曠";
  if (status.startsWith("代_")) return "代_";
  for (const t of ["特", "病", "事", "婚", "喪", "公"] as const) {
    if (status.startsWith(t)) return t;
  }
  return "／";
}

function getStatusHours(status: string): number {
  const match = status.match(/(\d+)$/);
  return match ? parseInt(match[1]) : 4;
}

function getStatusProxy(status: string): string {
  return status.startsWith("代_") ? status.slice(2) : "";
}

function buildStatus(type: StatusType, hours: number, proxy: string): string {
  if (type === "／") return "／";
  if (type === "曠") return "曠";
  if (type === "代_") return `代_${proxy}`;
  return `${type}${hours}`;
}

function statusColorClass(status: string): string {
  return STATUS_COLORS[getStatusType(status)];
}

function isWork(status: string): boolean {
  return status === "／" || status.startsWith("代_");
}

// ── 資料模型 ──────────────────────────────────────────────────
interface AttRecord {
  userId: string;
  date: string;
  amStatus: string;
  pmStatus: string;
}

import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet, gasPost } from "@/lib/gasApi";

interface Worker {
  userId: string;
  name: string;
}

// ── 編輯 Dialog 狀態 ──────────────────────────────────────────
interface EditState {
  date: string;
  amType: StatusType; amHours: number; amProxy: string;
  pmType: StatusType; pmHours: number; pmProxy: string;
}

function recordToEditState(date: string, rec?: AttRecord): EditState {
  if (!rec) return { date, amType: "／", amHours: 4, amProxy: "", pmType: "／", pmHours: 4, pmProxy: "" };
  return {
    date,
    amType: getStatusType(rec.amStatus), amHours: getStatusHours(rec.amStatus), amProxy: getStatusProxy(rec.amStatus),
    pmType: getStatusType(rec.pmStatus), pmHours: getStatusHours(rec.pmStatus), pmProxy: getStatusProxy(rec.pmStatus),
  };
}

// ── 半段選擇器 ───────────────────────────────────────────────
function HalfEditor({
  label, type, hours, proxy,
  onType, onHours, onProxy,
}: {
  label: string;
  type: StatusType; hours: number; proxy: string;
  onType: (t: StatusType) => void;
  onHours: (h: number) => void;
  onProxy: (p: string) => void;
}) {
  const needsHours = type !== "／" && type !== "曠" && type !== "代_";
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold text-muted-foreground mb-2">{label}</div>
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {STATUS_TYPES.map(t => (
          <button key={t} onClick={() => onType(t)}
            className={cn("py-1.5 rounded-lg text-xs font-medium border transition-all",
              type === t
                ? cn("border-2", STATUS_COLORS[t])
                : "bg-muted/30 text-muted-foreground border-border hover:border-muted-foreground")}>
            {STATUS_TYPE_LABELS[t]}
          </button>
        ))}
      </div>
      {needsHours && (
        <div className="flex gap-2">
          {[2, 4].map(h => (
            <button key={h} onClick={() => onHours(h)}
              className={cn("flex-1 py-1.5 rounded-lg text-sm font-semibold border transition-all",
                hours === h ? "bg-blue-700 text-white border-blue-700" : "bg-muted/30 text-muted-foreground border-border hover:border-muted-foreground")}>
              {h}h
            </button>
          ))}
        </div>
      )}
      {type === "代_" && (
        <input type="text" placeholder="輸入代理人姓名..."
          value={proxy} onChange={e => onProxy(e.target.value)}
          className="w-full text-sm border border-border rounded-lg px-3 py-1.5 mt-1 focus:outline-none focus:ring-2 focus:ring-blue-300" />
      )}
    </div>
  );
}

// ── 主頁面 ───────────────────────────────────────────────────
export default function AdminAttendance() {
  const { user } = useGasAuthContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedWorker, setSelectedWorker] = useState("");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [records, setRecords] = useState<Record<string, AttRecord>>({});
  const [editState, setEditState] = useState<EditState | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [filterType, setFilterType] = useState<StatusType | "all">("all");
  const [holidays, setHolidays] = useState<string[]>([]);

  // 0. 載入系統設定 (取得國定假日)
  useEffect(() => {
    gasGet<any>("getConfig").then(res => {
      if (res.success && res.data?.holidays2026) {
        setHolidays(res.data.holidays2026.split(",").filter(Boolean));
      }
    });
  }, []);

  // 1. 載入人員名單
  useEffect(() => {
    if (!user?.email) return;
    setIsLoading(true);
    gasGet<any[]>("getWorkers", { callerEmail: user.email }).then(res => {
      if (res.success && Array.isArray(res.data)) {
        const list = res.data.map(w => ({
          userId: String(w["人員編號"] || ""),
          name: String(w["姓名"] || ""),
        })).filter(w => w.userId);
        setWorkers(list);
        if (list.length > 0 && !selectedWorker) setSelectedWorker(list[0].userId);
      }
    }).finally(() => setIsLoading(false));
  }, [user?.email]);

  // 2. 載入差勤紀錄
  const loadRecords = useCallback(async () => {
    if (!user?.email || !selectedWorker) return;
    setIsLoading(true);
    const monthStr = format(currentMonth, "yyyy-MM");
    try {
      const res = await gasGet<any[]>("getAttendance", {
        callerEmail: user.email,
        workerId: selectedWorker,
        yearMonth: monthStr
      });
      if (res.success && Array.isArray(res.data)) {
        const map: Record<string, AttRecord> = {};
        res.data.forEach(r => {
          const date = String(r["日期"] || "");
          const dStr = date.includes("T") ? date.split("T")[0] : date;
          map[`${dStr}_${selectedWorker}`] = {
            userId: selectedWorker,
            date: dStr,
            amStatus: String(r["上午狀態"] || "／"),
            pmStatus: String(r["下午狀態"] || "／"),
          };
        });
        setRecords(map);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, selectedWorker, currentMonth]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);

  const openEdit = (dateStr: string) => {
    const key = `${dateStr}_${selectedWorker}`;
    setEditState(recordToEditState(dateStr, records[key]));
  };

  const saveRecord = async () => {
    if (!editState || !user?.email) return;
    const amStatus = buildStatus(editState.amType, editState.amHours, editState.amProxy);
    const pmStatus = buildStatus(editState.pmType, editState.pmHours, editState.pmProxy);
    
    // 計算工時時數
    const getHrs = (type: StatusType, hrs: number) => (type === "／" || type === "代_") ? 4 : 0;
    const leaveHrs = (type: StatusType, hrs: number) => (type === "特") ? hrs : 0;
    
    const workHours = getHrs(editState.amType, editState.amHours) + getHrs(editState.pmType, editState.pmHours);
    const leaveHours = leaveHrs(editState.amType, editState.amHours) + leaveHrs(editState.pmType, editState.pmHours);

    const res = await gasPost("upsertAttendance", {
      callerEmail: user.email,
      record: {
        userId: selectedWorker,
        date: editState.date,
        amStatus,
        pmStatus,
        workHours,
        leaveHours,
        source: "admin",
        updatedAt: format(new Date(), "yyyy-MM-dd HH:mm:ss")
      }
    });

    if (res.success) {
      toast.success("差勤紀錄已更新");
      loadRecords();
      setEditState(null);
      setShowConfirmDialog(false);
    } else {
      toast.error(`更新失敗: ${res.error}`);
    }
  };

  const workerRecords = Object.entries(records)
    .filter(([k]) => k.includes(`_${selectedWorker}`) && k.startsWith(format(currentMonth, "yyyy-MM")))
    .map(([, v]) => v);

  const fullDays = workerRecords.filter(r => isWork(r.amStatus) && isWork(r.pmStatus)).length;
  const halfDays = workerRecords.filter(r => isWork(r.amStatus) !== isWork(r.pmStatus)).length;
  const leaveHours = workerRecords.reduce((sum, r) => {
    const h = (s: string) => getStatusType(s) === "特" ? getStatusHours(s) : 0;
    return sum + h(r.amStatus) + h(r.pmStatus);
  }, 0);

  const workerName = workers.find(w => w.userId === selectedWorker)?.name || "";

  return (
    <div className="space-y-6 print:space-y-4 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-foreground">差勤管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">點擊日期格子可編輯上午／下午差勤狀態</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" />列印
          </Button>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-sm font-semibold text-foreground min-w-[80px] text-center">
            {format(currentMonth, "yyyy年M月", { locale: zhTW })}
          </span>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center print:hidden bg-slate-50/50 p-4 rounded-2xl border border-border/50">
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">選擇協助員</span>
          <div className="flex gap-2 flex-wrap">
            {workers.map(w => (
              <button key={w.userId} onClick={() => setSelectedWorker(w.userId)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                  selectedWorker === w.userId
                    ? "bg-blue-700 text-white border-blue-700 shadow-sm"
                    : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
                {w.name}
              </button>
            ))}
          </div>
        </div>

        <div className="h-10 w-px bg-border mx-2" />

        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider ml-1">假別篩選</span>
          <div className="flex gap-1.5 flex-wrap">
            <button onClick={() => setFilterType("all")}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                filterType === "all" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-muted-foreground border-border")}>
              全部
            </button>
            {STATUS_TYPES.map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                  filterType === t ? cn("border-transparent text-white", STATUS_COLORS[t].split(' ')[0].replace('text-', 'bg-')) : "bg-white text-muted-foreground border-border")}>
                {STATUS_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="hidden print:block text-center mb-4">
        <h2 className="text-lg font-bold">115年度協助員點數管理系統</h2>
        <h3 className="text-base">差勤統計表 — {format(currentMonth, "yyyy年M月", { locale: zhTW })} — {workerName}</h3>
      </div>

      <div className="flex flex-wrap gap-3 items-start print:hidden">
        <div className="flex gap-3 ml-auto">
          {[
            { label: "全天出勤", value: fullDays, color: "text-emerald-700 bg-emerald-50" },
            { label: "半天出勤", value: halfDays, color: "text-amber-700 bg-amber-50" },
            { label: "特休時數", value: `${leaveHours}h`, color: "text-blue-700 bg-blue-50" },
          ].map(({ label, value, color }) => (
            <div key={label} className={cn("rounded-xl px-4 py-2 text-center", color)}>
              <div className="text-xl font-bold">{value}</div>
              <div className="text-xs">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {user?.role === "deptMgr" && (
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-border/30 bg-gray-50/50">
            <h2 className="text-sm font-bold text-foreground">部門差勤彙總 (特休統計)</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30 text-muted-foreground bg-slate-50/30">
                <th className="px-4 py-3 text-left font-medium">姓名</th>
                <th className="px-4 py-3 text-center font-medium">特休總額(天)</th>
                <th className="px-4 py-3 text-center font-medium">本月已休(天)</th>
                <th className="px-4 py-3 text-center font-medium">累計已休(天)</th>
                <th className="px-4 py-3 text-center font-medium">剩餘特休(天)</th>
              </tr>
            </thead>
            <tbody>
              {workers.map(w => {
                const wRecords = Object.values(records).filter(r => r.userId === w.userId);
                const mHours = wRecords.reduce((sum, r) => {
                  const h = (s: string) => getStatusType(s) === "特" ? getStatusHours(s) : 0;
                  return sum + h(r.amStatus) + h(r.pmStatus);
                }, 0);
                const totalDays = parseFloat((w as any).totalLeaveDays) || 7.0;
                const usedYtdDays = parseFloat((w as any).ytdLeaveDays) || 0.0;
                const usedMonthDays = mHours / 8;
                const remaining = totalDays - usedYtdDays;

                return (
                  <tr key={w.userId} className="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">{w.name}</td>
                    <td className="px-4 py-3 text-center font-mono">{totalDays.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center font-mono text-blue-600">{usedMonthDays.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center font-mono text-amber-700">{usedYtdDays.toFixed(1)}</td>
                    <td className="px-4 py-3 text-center font-mono font-bold text-indigo-700">{remaining.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar */}
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
              const rec = records[`${dateStr}_${selectedWorker}`];
              const isHoliday = holidays.includes(dateStr);
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;
              const isNonWork = isWeekend || isHoliday;
              const isTodayDate = isToday(day);

              const matchesFilter = filterType === "all" || 
                (rec && (getStatusType(rec.amStatus) === filterType || getStatusType(rec.pmStatus) === filterType));
              
              const opacityClass = matchesFilter ? "opacity-100" : "opacity-20 grayscale";

              return (
                <button key={dateStr} onClick={() => openEdit(dateStr)}
                  className={cn(
                    "min-h-[72px] rounded-xl border p-1.5 flex flex-col items-center gap-0.5 transition-all hover:ring-2 hover:ring-blue-300",
                    isNonWork ? "bg-slate-50 border-slate-100 text-slate-400" : "bg-white border-border/60 hover:bg-blue-50/30",
                    opacityClass
                  )}>
                  <div className="w-full flex justify-between items-start mb-0.5">
                    <span className={cn("text-[10px] font-bold px-1 rounded-sm", isTodayDate ? "bg-blue-600 text-white" : "")}>
                      {format(day, "d")}
                    </span>
                    {isHoliday && <span className="text-[8px] text-red-400 font-bold">假</span>}
                  </div>
                  
                  {rec ? (
                    <div className="flex flex-col gap-0.5 w-full">
                      <span className={cn("text-[9px] font-medium px-0.5 py-0.5 rounded text-center border truncate", statusColorClass(rec.amStatus))}>
                        上{rec.amStatus === "／" ? "勤" : rec.amStatus.length > 3 ? rec.amStatus.slice(0, 3) : rec.amStatus}
                      </span>
                      <span className={cn("text-[9px] font-medium px-0.5 py-0.5 rounded text-center border truncate", statusColorClass(rec.pmStatus))}>
                        下{rec.pmStatus === "／" ? "勤" : rec.pmStatus.length > 3 ? rec.pmStatus.slice(0, 3) : rec.pmStatus}
                      </span>
                    </div>
                  ) : (
                    !isNonWork && (
                      <div className="flex flex-col gap-0.5 w-full mt-auto">
                        <span className="text-[9px] font-medium px-0.5 py-0.5 rounded text-center border border-emerald-100 bg-emerald-50/30 text-emerald-600/50">
                          (預設上班)
                        </span>
                      </div>
                    )
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground print:hidden">
          狀態碼：／＝出勤 · 特N＝特休N小時 · 病N／事N等＝請假 · 代_姓名＝代理出勤 · 曠＝曠職
        </div>
      </div>

      {/* Edit Dialog */}
      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-foreground">
                  編輯差勤 — {workerName} {editState.date}
                </h3>
                <button onClick={() => setEditState(null)} className="p-1 rounded-lg hover:bg-muted">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <HalfEditor
                label="上午狀態"
                type={editState.amType} hours={editState.amHours} proxy={editState.amProxy}
                onType={t => setEditState(s => s ? { ...s, amType: t } : s)}
                onHours={h => setEditState(s => s ? { ...s, amHours: h } : s)}
                onProxy={p => setEditState(s => s ? { ...s, amProxy: p } : s)}
              />
              <HalfEditor
                label="下午狀態"
                type={editState.pmType} hours={editState.pmHours} proxy={editState.pmProxy}
                onType={t => setEditState(s => s ? { ...s, pmType: t } : s)}
                onHours={h => setEditState(s => s ? { ...s, pmHours: h } : s)}
                onProxy={p => setEditState(s => s ? { ...s, pmProxy: p } : s)}
              />
            </div>
            <div className="p-6 flex justify-end gap-3 bg-slate-50 border-t border-border/50 rounded-b-2xl">
              <Button variant="outline" onClick={() => setEditState(null)}>取消</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowConfirmDialog(true)}>儲存變更</Button>
            </div>
          </div>
        </div>
      )}

      {/* 差勤儲存確認對話框 */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 rounded-full text-amber-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">確認修改差勤？</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              您即將修改 <span className="font-bold text-foreground">{editState?.date}</span> 的出勤狀態。此變更將即時同步至系統後端。
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDialog(false)}>返回</Button>
              <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={saveRecord}>確定儲存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
