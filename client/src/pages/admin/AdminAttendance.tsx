import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday } from "date-fns";
import { zhTW } from "date-fns/locale";

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

const MOCK_WORKERS = [
  { userId: "W001", name: "王小明" },
  { userId: "W002", name: "李大華" },
  { userId: "W003", name: "陳美玲" },
];

const MOCK_RECORDS: Record<string, AttRecord> = {
  "2026-04-01_W001": { userId: "W001", date: "2026-04-01", amStatus: "／", pmStatus: "／" },
  "2026-04-02_W001": { userId: "W001", date: "2026-04-02", amStatus: "／", pmStatus: "／" },
  "2026-04-03_W001": { userId: "W001", date: "2026-04-03", amStatus: "特4", pmStatus: "特4" },
  "2026-04-07_W002": { userId: "W002", date: "2026-04-07", amStatus: "／", pmStatus: "病4" },
  "2026-04-08_W003": { userId: "W003", date: "2026-04-08", amStatus: "代_張主任", pmStatus: "／" },
};

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
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 3, 1));
  const [selectedWorker, setSelectedWorker] = useState("W001");
  const [editState, setEditState] = useState<EditState | null>(null);
  const [records, setRecords] = useState(MOCK_RECORDS);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDow = getDay(monthStart);

  const openEdit = (dateStr: string) => {
    const key = `${dateStr}_${selectedWorker}`;
    setEditState(recordToEditState(dateStr, records[key]));
  };

  const saveRecord = () => {
    if (!editState) return;
    const key = `${editState.date}_${selectedWorker}`;
    const amStatus = buildStatus(editState.amType, editState.amHours, editState.amProxy);
    const pmStatus = buildStatus(editState.pmType, editState.pmHours, editState.pmProxy);
    setRecords(prev => ({ ...prev, [key]: { userId: selectedWorker, date: editState.date, amStatus, pmStatus } }));
    toast.success(`${editState.date} 差勤已更新`);
    setEditState(null);
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

  const workerName = MOCK_WORKERS.find(w => w.userId === selectedWorker)?.name || "";

  return (
    <div className="space-y-6 print:space-y-4">
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

      <div className="hidden print:block text-center mb-4">
        <h2 className="text-lg font-bold">115年度協助員點數管理系統</h2>
        <h3 className="text-base">差勤統計表 — {format(currentMonth, "yyyy年M月", { locale: zhTW })} — {workerName}</h3>
      </div>

      <div className="flex flex-wrap gap-3 items-start print:hidden">
        <div className="flex gap-2 flex-wrap">
          {MOCK_WORKERS.map(w => (
            <button key={w.userId} onClick={() => setSelectedWorker(w.userId)}
              className={cn("px-3 py-1.5 text-sm font-medium rounded-lg border transition-all",
                selectedWorker === w.userId
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
              {w.name}
            </button>
          ))}
        </div>
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
              const isWeekend = getDay(day) === 0 || getDay(day) === 6;
              const isTodayDate = isToday(day);
              return (
                <button key={dateStr} onClick={() => openEdit(dateStr)}
                  className={cn(
                    "min-h-[64px] rounded-xl border p-1 flex flex-col items-center gap-0.5 transition-all hover:ring-2 hover:ring-blue-300",
                    isWeekend ? "bg-slate-50 border-slate-100 text-slate-400" : "bg-muted/20 border-border/30 hover:bg-muted/40"
                  )}>
                  <span className={cn("text-xs font-semibold leading-none mb-0.5", isTodayDate && "text-blue-700")}>
                    {format(day, "d")}
                  </span>
                  {rec ? (
                    <div className="flex flex-col gap-0.5 w-full">
                      <span className={cn("text-[9px] font-medium px-0.5 py-0.5 rounded text-center border truncate", statusColorClass(rec.amStatus))}>
                        上{rec.amStatus === "／" ? "勤" : rec.amStatus.length > 3 ? rec.amStatus.slice(0, 3) : rec.amStatus}
                      </span>
                      <span className={cn("text-[9px] font-medium px-0.5 py-0.5 rounded text-center border truncate", statusColorClass(rec.pmStatus))}>
                        下{rec.pmStatus === "／" ? "勤" : rec.pmStatus.length > 3 ? rec.pmStatus.slice(0, 3) : rec.pmStatus}
                      </span>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground print:hidden">
          狀態碼：／＝出勤 · 特N＝特休N小時 · 病N／事N等＝請假 · 代_姓名＝代理出勤 · 曠＝曠職
        </div>
      </div>

      {/* Print-only table（列印時替代月曆格式，顯示每日差勤清單） */}
      <div className="hidden print:block mt-4">
        <table className="w-full report-table text-sm">
          <thead>
            <tr>
              {["日期", "星期", "上午狀態", "下午狀態"].map(h => (
                <th key={h} className="px-3 py-2 text-center text-xs font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.filter(day => getDay(day) !== 0 && getDay(day) !== 6).map(day => {
              const dateStr = format(day, "yyyy-MM-dd");
              const rec = records[`${dateStr}_${selectedWorker}`];
              return (
                <tr key={dateStr}>
                  <td className="px-3 py-1.5 text-center">{format(day, "M/d")}</td>
                  <td className="px-3 py-1.5 text-center">
                    {["日", "一", "二", "三", "四", "五", "六"][getDay(day)]}
                  </td>
                  <td className="px-3 py-1.5 text-center">{rec?.amStatus || "—"}</td>
                  <td className="px-3 py-1.5 text-center">{rec?.pmStatus || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Dialog */}
      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
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

            <div className="flex gap-3 mt-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditState(null)}>取消</Button>
              <Button className="flex-1 bg-blue-700 hover:bg-blue-800" onClick={saveRecord}>儲存</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
