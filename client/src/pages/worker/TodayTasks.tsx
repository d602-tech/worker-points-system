import { useState, useCallback, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Camera, Image as ImageIcon, Paperclip, CheckCircle2, Circle, AlertTriangle, Eye, Trash2, Plus, X, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, addDays, subDays, isToday } from "date-fns";
import { zhTW } from "date-fns/locale";
import { POINTS_CONFIG_SEED, WORKER_TYPE_LABELS, type WorkerType } from "../../../../shared/domain";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasPost, gasGet } from "@/lib/gasApi";

// 依協助員類型取得當日應填報的工作項目（A1 類別為每日填報項目）
function getDailyItems(workerType: string) {
  return POINTS_CONFIG_SEED.filter(
    item => item.workerType === workerType && item.category === "A1"
  );
}

interface TaskFile { id: string; name: string; url: string; type: string; blob?: Blob; }
interface TaskItem {
  itemId: string; name: string; points: number; completed: boolean;
  note: string; files: TaskFile[];
  status: "draft" | "submitted" | "approved" | "rejected";
  rejectionReason?: string;
}
type DayStatus = "none" | "draft" | "submitted" | "approved" | "rejected";

function getDayStatus(tasks: TaskItem[]): DayStatus {
  if (!tasks.length) return "none";
  if (tasks.every(t => t.status === "approved")) return "approved";
  if (tasks.some(t => t.status === "rejected")) return "rejected";
  if (tasks.every(t => t.status === "submitted")) return "submitted";
  if (tasks.some(t => t.completed)) return "draft";
  return "none";
}

const STATUS_CONFIG = {
  none:      { label: "未填報", color: "bg-red-50 text-red-600 border-red-200",         dot: "bg-red-500" },
  draft:     { label: "草稿中", color: "bg-amber-50 text-amber-600 border-amber-200",   dot: "bg-amber-500" },
  submitted: { label: "已送出", color: "bg-blue-50 text-blue-700 border-blue-200",      dot: "bg-blue-500" },
  approved:  { label: "已通過", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  rejected:  { label: "已退回", color: "bg-red-50 text-red-700 border-red-200",         dot: "bg-red-500" },
};

export default function TodayTasks() {
  const { user, isAuthenticated } = useGasAuthContext();
  const [currentDate, setCurrentDate] = useState(new Date());

  // 從登入使用者 profile 取得協助員類型，預設為一般工地協助員
  const workerType = useMemo(() => {
    if (user?.workerType) return user.workerType;
    return "一般工地協助員";
  }, [user?.workerType]);

  const dailyItems = useMemo(() => getDailyItems(workerType), [workerType]);

  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    getDailyItems("一般工地協助員").map((item) => ({
      itemId: item.itemId, name: item.name, points: item.pointsPerUnit,
      completed: false, note: "", files: [], status: "draft" as const,
    }))
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    () => new Set(dailyItems.map(i => i.itemId))
  );

  // 當協助員類型/日期改變時，重置任務清單 & 嘗試載入已存資料
  useEffect(() => {
    const items = getDailyItems(workerType);
    setTasks(items.map(item => ({
      itemId: item.itemId, name: item.name, points: item.pointsPerUnit,
      completed: false, note: "", files: [], status: "draft" as const,
    })));
    setExpandedItems(new Set(items.map(i => i.itemId)));

    // 嘗試從 GAS 載入當日已有紀錄
    if (user?.id) {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      gasGet("getDailyPoints", { workerId: user.id, date: dateStr })
        .then(res => {
          if (res.success && Array.isArray(res.data) && res.data.length > 0) {
            setTasks(prev => prev.map(task => {
              const existing = (res.data as Record<string, unknown>[]).find(
                (r) => r["點數代碼"] === task.itemId || r["itemId"] === task.itemId
              );
              if (existing) {
                const status = String(existing["審核狀態"] || existing["status"] || "draft");
                const statusMap: Record<string, TaskItem["status"]> = {
                  "草稿": "draft", "已送出": "submitted", "已通過": "approved", "已退回": "rejected",
                  "draft": "draft", "submitted": "submitted", "approved": "approved", "rejected": "rejected",
                };
                return {
                  ...task,
                  completed: true,
                  status: statusMap[status] || "draft",
                  note: String(existing["備註"] || existing["note"] || ""),
                  rejectionReason: String(existing["退回原因"] || existing["rejectionReason"] || ""),
                };
              }
              return task;
            }));
          }
        })
        .catch(() => { /* 靜默失敗，使用預設空白狀態 */ });
    }
  }, [workerType, currentDate, user?.id]);

  const [showNoteFor, setShowNoteFor] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const dayStatus = getDayStatus(tasks);
  const isSubmitted = tasks.every(t => t.status === "submitted" || t.status === "approved");
  const hasAnyCompleted = tasks.some(t => t.completed);
  const completedCount = tasks.filter(t => t.completed).length;

  const toggleTask = useCallback((itemId: string) => {
    setTasks(prev => prev.map(t => t.itemId === itemId ? { ...t, completed: !t.completed } : t));
    setExpandedItems(prev => {
      const next = new Set(prev);
      const task = tasks.find(t => t.itemId === itemId);
      if (task && !task.completed) next.delete(itemId); else next.add(itemId);
      return next;
    });
  }, [tasks]);

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
  };

  const handleFileSelect = (itemId: string, fileList: FileList | null) => {
    if (!fileList) return;
    // 僅接受 PDF/JPG/PNG
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    const validFiles = Array.from(fileList).filter(f => allowedTypes.includes(f.type));
    if (validFiles.length < fileList.length) {
      toast.warning("部分檔案格式不支援，僅接受 JPG/PNG/PDF");
    }
    const newFiles = validFiles.map(f => ({
      id: Math.random().toString(36).slice(2), name: f.name,
      url: URL.createObjectURL(f), type: f.type, blob: f,
    }));
    setTasks(prev => prev.map(t => t.itemId === itemId ? { ...t, files: [...t.files, ...newFiles] } : t));
    if (newFiles.length > 0) toast.success(`已選取 ${newFiles.length} 個檔案`);
  };

  const openFilePicker = (itemId: string, opts: { accept: string; capture?: string; multiple?: boolean }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = opts.accept;
    if (opts.capture) input.capture = opts.capture;
    if (opts.multiple) input.multiple = true;
    input.onchange = e => handleFileSelect(itemId, (e.target as HTMLInputElement).files);
    input.click();
  };

  const removeFile = (itemId: string, fileId: string) => {
    setTasks(prev => prev.map(t => t.itemId === itemId ? { ...t, files: t.files.filter(f => f.id !== fileId) } : t));
  };

  const handleSubmit = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const completedTasks = tasks.filter(t => t.completed);

      // 逐筆送出到 GAS
      for (const task of completedTasks) {
        await gasPost("saveDailyPoints", {
          workerId: user?.id || "",
          workerName: user?.name || "",
          date: dateStr,
          pointCode: task.itemId,
          category: "A1",
          taskName: task.name,
          points: task.points,
          fileCount: task.files.length,
          note: task.note,
        });
      }

      // 更新前端狀態
      setTasks(prev => prev.map(t => t.completed ? { ...t, status: "submitted" } : t));
      toast.success("今日資料已送出！", { duration: 3000 });
    } catch {
      toast.error("送出失敗，請稍後重試");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={() => setCurrentDate(d => subDays(d, 1))} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors active:scale-95">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <div className="text-base font-semibold text-foreground">
              {format(currentDate, "M/d（EEE）", { locale: zhTW })}
              {isToday(currentDate) && <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">今日</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">{format(currentDate, "yyyy年M月", { locale: zhTW })}</div>
          </div>
          <button onClick={() => setCurrentDate(d => addDays(d, 1))} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors active:scale-95">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex items-center justify-between px-4 pb-2">
          <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border", STATUS_CONFIG[dayStatus].color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_CONFIG[dayStatus].dot)} />
            {STATUS_CONFIG[dayStatus].label}
          </div>
          <div className="flex items-center gap-2">
            {/* 顯示登入使用者的協助員類型（唯讀） */}
            <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded-lg max-w-[140px] truncate">
              {workerType}
            </span>
            <span className="text-xs text-muted-foreground">{completedCount}/{tasks.length} 項</span>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-500" style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {tasks.map(task => {
          const isExpanded = expandedItems.has(task.itemId);
          const isRejected = task.status === "rejected";
          return (
            <div key={task.itemId} className={cn(
              "bg-white rounded-2xl shadow-elegant overflow-hidden border transition-all duration-200",
              isRejected ? "border-red-300 ring-1 ring-red-200" : "border-border/60",
              task.completed && !isRejected && "border-emerald-200 bg-emerald-50/20"
            )}>
              <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => toggleExpand(task.itemId)}>
                <div className="mt-0.5 flex-shrink-0" onClick={e => { e.stopPropagation(); toggleTask(task.itemId); }}>
                  {task.completed ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> : <Circle className="w-6 h-6 text-muted-foreground/40" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="inline-block cat-a text-[10px] font-bold px-1.5 py-0.5 rounded mr-1.5 border border-gray-200">A1</span>
                      <span className={cn("text-sm font-medium", task.completed ? "text-emerald-700" : "text-foreground")}>{task.name}</span>
                    </div>
                    <span className="text-xs font-semibold text-blue-700 whitespace-nowrap">{task.points.toLocaleString()} pt</span>
                  </div>
                  {isRejected && task.rejectionReason && (
                    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{task.rejectionReason}
                    </div>
                  )}
                  {task.files.length > 0 && <div className="mt-1 text-xs text-muted-foreground">已上傳 {task.files.length} 個佐證</div>}
                </div>
                <ChevronRight className={cn("w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform", isExpanded && "rotate-90")} />
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                  <div className="flex gap-2">
                    {[
                      { icon: Camera, label: "拍照", opts: { accept: "image/*", capture: "environment" } },
                      { icon: ImageIcon, label: "相簿", opts: { accept: "image/*", multiple: true } },
                      { icon: Paperclip, label: "選檔案", opts: { accept: ".pdf,.jpg,.jpeg,.png", multiple: true } },
                    ].map(({ icon: Icon, label, opts }) => (
                      <button key={label} onClick={() => openFilePicker(task.itemId, opts)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-50 text-slate-700 text-sm font-medium hover:bg-slate-100 active:scale-[0.97] transition-all min-h-[44px]">
                        <Icon className="w-4 h-4" />{label}
                      </button>
                    ))}
                  </div>
                  {task.files.length > 0 && (
                    <div className="space-y-2">
                      {task.files.map(file => (
                        <div key={file.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                          {file.type.startsWith("image/") ? (
                            <img src={file.url} alt={file.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center flex-shrink-0">
                              <span className="text-red-600 text-[10px] font-bold">PDF</span>
                            </div>
                          )}
                          <span className="text-xs text-foreground flex-1 truncate">{file.name}</span>
                          <button className="p-1 hover:bg-muted rounded min-w-[28px] min-h-[28px] flex items-center justify-center" onClick={() => window.open(file.url, "_blank")}><Eye className="w-3.5 h-3.5 text-muted-foreground" /></button>
                          <button className="p-1 hover:bg-red-50 rounded min-w-[28px] min-h-[28px] flex items-center justify-center" onClick={() => removeFile(task.itemId, file.id)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {showNoteFor.has(task.itemId) ? (
                    <div className="relative">
                      <input type="text" placeholder="輸入備註..." value={task.note}
                        onChange={e => setTasks(prev => prev.map(t => t.itemId === task.itemId ? { ...t, note: e.target.value } : t))}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[44px]" />
                      <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1" onClick={() => setShowNoteFor(prev => { const n = new Set(prev); n.delete(task.itemId); return n; })}>
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                      onClick={() => setShowNoteFor(prev => { const n = new Set(prev); n.add(task.itemId); return n; })}>
                      <Plus className="w-3.5 h-3.5" />新增備註
                    </button>
                  )}
                  <div className={cn("flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all min-h-[48px]",
                    task.completed ? "bg-emerald-50 border border-emerald-200" : "bg-muted/40 border border-border/40")}
                    onClick={() => toggleTask(task.itemId)}>
                    <Checkbox checked={task.completed} onCheckedChange={() => toggleTask(task.itemId)}
                      className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500" />
                    <span className={cn("text-sm font-medium", task.completed ? "text-emerald-700" : "text-muted-foreground")}>
                      {task.completed ? "已完成" : "標記為已完成"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 確認送出對話框 — z-index 高於 WorkerLayout nav (z-50) */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirmDialog(false)}>
          <div className="w-full max-w-[430px] bg-white rounded-t-3xl p-6 animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-foreground mb-2">確認送出</h3>
            <p className="text-sm text-muted-foreground mb-6">確定送出 {format(currentDate, "M/d", { locale: zhTW })} 的 {completedCount} 項工作資料？送出後將無法直接修改。</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setShowConfirmDialog(false)}>取消</Button>
              <Button className="flex-1 h-12 rounded-xl bg-blue-700 hover:bg-blue-800 gap-2" onClick={handleSubmit} disabled={isSubmitting}>
                <Send className="w-4 h-4" />
                {isSubmitting ? "送出中..." : "確認送出"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 底部送出按鈕 — 使用 fixed 定位，置於 nav 之上 */}
      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-3 bg-white/95 backdrop-blur-md border-t border-border z-[45] pb-safe">
        {isSubmitted ? (
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base font-medium rounded-xl gap-2" disabled>
            <CheckCircle2 className="w-5 h-5" />已送出
          </Button>
        ) : (
          <Button
            id="submit-daily-tasks"
            className={cn("w-full h-12 text-base font-medium rounded-xl transition-all gap-2",
              hasAnyCompleted ? "bg-blue-700 hover:bg-blue-800 shadow-elegant-md active:scale-[0.98]" : "bg-muted text-muted-foreground cursor-not-allowed")}
            disabled={!hasAnyCompleted || isSubmitting}
            onClick={() => setShowConfirmDialog(true)}>
            <Send className="w-4 h-4" />
            {isSubmitting ? "送出中..." : `確認送出今日資料（${completedCount} 項）`}
          </Button>
        )}
      </div>
    </div>
  );
}
