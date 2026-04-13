import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Camera, Image as ImageIcon, Paperclip, CheckCircle2, Circle, AlertTriangle, Eye, Trash2, Plus, X, Send, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { format, addDays, subDays, isToday, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { POINTS_CONFIG_SEED, type WorkerType } from "../../../../shared/domain";
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
  submittedAt?: string;
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

  // 從登入使用者 profile 取得協助員類型
  const workerType = useMemo(() => user?.workerType || "general", [user?.workerType]);
  const dailyItems = useMemo(() => getDailyItems(workerType), [workerType]);

  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    dailyItems.map((item) => ({
      itemId: item.itemId, name: item.name, points: item.pointsPerUnit,
      completed: false, note: "", files: [], status: "draft" as const,
    }))
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    () => new Set(dailyItems.map(i => i.itemId))
  );

  const [isLoading, setIsLoading] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [lastSubmittedCount, setLastSubmittedCount] = useState(0);

  // 滑動切換日期邏輯
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 70) {
      if (deltaX > 0) setCurrentDate(d => subDays(d, 1)); // 向右滑：前一天
      else setCurrentDate(d => addDays(d, 1)); // 向左滑：後一天
    }
    touchStartX.current = null;
  };

  // 載入資料 (點數紀錄 + 檔案索引)
  useEffect(() => {
    if (!user?.id) return;
    setIsLoading(true);
    const dateStr = format(currentDate, "yyyy-MM-dd");
    
    // 初始化空任務
    const initialTasks: TaskItem[] = dailyItems.map(item => ({
      itemId: item.itemId, name: item.name, points: item.pointsPerUnit,
      completed: false, note: "", files: [], status: "draft" as const,
    }));

    Promise.all([
      gasGet("getDailyPoints", { workerId: user.id, date: dateStr }),
      gasGet("getFileIndex", { workerId: user.id, date: dateStr })
    ]).then(([pointsRes, filesRes]) => {
      let updatedTasks = [...initialTasks];
      
      if (pointsRes.success && Array.isArray(pointsRes.data)) {
        updatedTasks = updatedTasks.map(task => {
          const existing = (pointsRes.data as Record<string, any>[]).find(
            r => r["項目編號"] === task.itemId || r["點數代碼"] === task.itemId
          );
          if (existing) {
            const statusMap: Record<string, TaskItem["status"]> = {
              "草稿": "draft", "已送出": "submitted", "已通過": "approved", "已退回": "rejected",
              "draft": "draft", "submitted": "submitted", "approved": "approved", "rejected": "rejected",
            };
            return {
              ...task,
              completed: true,
              status: statusMap[existing["狀態"] || existing["審核狀態"]] || "draft",
              note: existing["備註"] || "",
              rejectionReason: existing["退回原因"] || "",
              submittedAt: existing["上傳時間"] || existing["最後更新時間"]
            };
          }
          return task;
        });
      }

      if (filesRes.success && Array.isArray(filesRes.data)) {
        updatedTasks = updatedTasks.map(task => {
          const files = (filesRes.data as Record<string, any>[])
            .filter(f => f["項目編號"] === task.itemId)
            .map(f => ({
              id: f["檔案編號"],
              name: f["檔案名稱"],
              type: f["檔案類型"],
              url: `https://drive.google.com/file/d/${f["雲端檔案編號"]}/view`,
            }));
          return { ...task, files: [...task.files, ...files] };
        });
      }

      setTasks(updatedTasks);
    }).finally(() => setIsLoading(false));
  }, [workerType, currentDate, user?.id, dailyItems]);

  const [showNoteFor, setShowNoteFor] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const dayStatus = getDayStatus(tasks);
  const isFinalized = tasks.every(t => t.status === "submitted" || t.status === "approved");
  const completedCount = tasks.filter(t => t.completed).length;

  const toggleTask = (itemId: string) => {
    const task = tasks.find(t => t.itemId === itemId);
    if (task?.status !== "draft" && task?.status !== "rejected") return; 
    setTasks(prev => prev.map(t => t.itemId === itemId ? { ...t, completed: !t.completed } : t));
  };

  const handleFileSelect = (itemId: string, fileList: FileList | null) => {
    if (!fileList) return;
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    const validFiles = Array.from(fileList).filter(f => allowedTypes.includes(f.type));
    const newFiles = validFiles.map(f => ({
      id: Math.random().toString(36).slice(2), name: f.name,
      url: URL.createObjectURL(f), type: f.type, blob: f,
    }));
    setTasks(prev => prev.map(t => t.itemId === itemId ? { ...t, files: [...t.files, ...newFiles] } : t));
  };

  const removeFile = (itemId: string, fileId: string) => {
    setTasks(prev => prev.map(t => t.itemId === itemId ? { ...t, files: t.files.filter(f => f.id !== fileId) } : t));
  };

  const handleSubmit = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const completedTasks = tasks.filter(t => t.completed && t.status !== "submitted" && t.status !== "approved");
      
      setLastSubmittedCount(completedTasks.length);

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

      setTasks(prev => prev.map(t => t.completed ? { ...t, status: "submitted" } : t));
      setShowSummaryModal(true);
    } catch {
      toast.error("送出失敗，請檢查網路連線");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-background select-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <button onClick={() => setCurrentDate(d => subDays(d, 1))} className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all">
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              {format(currentDate, "M/d（EEE）", { locale: zhTW })}
              {isToday(currentDate) && <span className="ml-2 text-[10px] font-bold text-white bg-blue-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">TODAY</span>}
            </div>
            <div className="text-xs text-muted-foreground font-medium">{format(currentDate, "yyyy年M月", { locale: zhTW })}</div>
          </div>
          <button onClick={() => setCurrentDate(d => addDays(d, 1))} className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all">
            <ChevronRight className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>
        <div className="flex items-center justify-between px-4 pb-3">
          <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-sm", STATUS_CONFIG[dayStatus].color)}>
            <span className={cn("w-2 h-2 rounded-full animate-pulse", STATUS_CONFIG[dayStatus].dot)} />
            {STATUS_CONFIG[dayStatus].label}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-foreground leading-none">身份類型</div>
              <div className="text-xs font-semibold text-foreground max-w-[100px] truncate">{workerType}</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center">
              <div className="text-[10px] font-bold text-muted-foreground leading-none">進度</div>
              <div className="text-sm font-bold text-blue-700">{completedCount}/{tasks.length}</div>
            </div>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="h-2 bg-muted rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-700 ease-out" style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 px-4 py-4 space-y-4 pb-32">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-muted-foreground font-medium">讀取今日任務中...</div>
          </div>
        ) : tasks.map(task => {
          const isExpanded = expandedItems.has(task.itemId);
          const isSubmitted = task.status === "submitted" || task.status === "approved";
          const isRejected = task.status === "rejected";

          return (
            <div key={task.itemId} className={cn(
              "bg-white rounded-3xl shadow-elegant border transition-all duration-300",
              isSubmitted ? "border-emerald-100 bg-emerald-50/10 opacity-90" : isRejected ? "border-red-200 bg-red-50/10" : "border-border/60"
            )}>
              <div className="p-4 flex items-start gap-4" onClick={() => {
                setExpandedItems(prev => {
                  const next = new Set(prev);
                  if (next.has(task.itemId)) next.delete(task.itemId); else next.add(task.itemId);
                  return next;
                });
              }}>
                <div className="mt-1" onClick={e => { e.stopPropagation(); toggleTask(task.itemId); }}>
                  {isSubmitted ? <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg transform scale-110"><Check className="w-4 h-4 text-white" /></div> :
                   task.completed ? <CheckCircle2 className="w-6 h-6 text-blue-600" /> : <Circle className="w-6 h-6 text-muted-foreground/30" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-900 text-white leading-none">A1</span>
                        {isSubmitted && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">已上傳</span>}
                      </div>
                      <h4 className={cn("text-[15px] font-bold leading-snug", task.completed ? "text-foreground" : "text-muted-foreground")}>{task.name}</h4>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-blue-800">{task.points.toLocaleString()} pt</div>
                    </div>
                  </div>
                  {isRejected && task.rejectionReason && <div className="mt-2 text-xs font-medium text-red-600 bg-red-50 p-2 rounded-xl border border-red-100 italic">{task.rejectionReason}</div>}
                  {task.files.length > 0 && <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider"><Paperclip className="w-3.5 h-3.5" />{task.files.length} FILES</div>}
                </div>
                <ChevronRight className={cn("w-5 h-5 text-muted-foreground/40 mt-1 transition-transform", isExpanded && "rotate-90")} />
              </div>

              {isExpanded && (
                <div className="px-4 pb-5 pt-2 space-y-4 animate-fade-in border-t border-dashed border-border/60">
                  {/* Upload Actions (only if not submitted) */}
                  {!isSubmitted ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon: Camera, label: "拍照", accept: "image/*", capture: "environment" },
                        { icon: ImageIcon, label: "相簿", accept: "image/*", multiple: true },
                        { icon: Paperclip, label: "文件", accept: ".pdf,.jpg,.jpeg,.png", multiple: true },
                      ].map((act, i) => (
                        <Button key={i} variant="secondary" className="h-16 rounded-2xl flex-col gap-1 bg-slate-50 hover:bg-slate-100 border-none group"
                          onClick={() => {
                            const input = document.createElement("input");
                            input.type = "file";
                            input.accept = act.accept;
                            if (act.capture) input.capture = act.capture;
                            if (act.multiple) input.multiple = true;
                            input.onchange = e => handleFileSelect(task.itemId, (e.target as HTMLInputElement).files);
                            input.click();
                          }}>
                          <act.icon className="w-5 h-5 text-slate-600 group-active:scale-90 transition-transform" />
                          <span className="text-[11px] font-bold text-slate-500">{act.label}</span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-emerald-50/50 p-3 rounded-2xl flex items-center gap-2 border border-emerald-100">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-700">資料已於 {task.submittedAt ? format(parseISO(String(task.submittedAt)), "HH:mm") : "今日"} 完成上傳且不可修改</span>
                    </div>
                  )}

                  {/* File List */}
                  {task.files.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">已選取檔案</div>
                      {task.files.map(file => (
                        <div key={file.id} className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-border/80 shadow-sm hover:border-blue-200 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {file.type?.includes("image") ? <img src={file.url} className="w-full h-full object-cover" /> : <Paperclip className="w-5 h-5 text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-xs font-bold truncate">{file.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase">{file.type?.split("/")[1] || "FILE"}</div>
                          </div>
                          <div className="flex gap-1">
                             <button className="p-2 rounded-xl hover:bg-slate-100 active:scale-90" onClick={() => window.open(file.url, "_blank")}><Eye className="w-4 h-4 text-slate-400" /></button>
                             {!isSubmitted && <button className="p-2 rounded-xl hover:bg-red-50 active:scale-90 text-red-500" onClick={() => removeFile(task.itemId, file.id)}><Trash2 className="w-4 h-4" /></button>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Note Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                       <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">作業備註</div>
                       {!isSubmitted && !showNoteFor.has(task.itemId) && <button className="text-[10px] font-bold text-blue-600 flex items-center gap-1" onClick={() => setShowNoteFor(prev => new Set(prev).add(task.itemId))}><Plus className="w-3 h-3" />新增</button>}
                    </div>
                    {isSubmitted ? (
                      <div className="text-sm font-medium text-slate-700 bg-slate-50 p-3 rounded-2xl min-h-[48px] border border-slate-100">{task.note || "無備註"}</div>
                    ) : showNoteFor.has(task.itemId) || task.note ? (
                      <div className="relative group">
                        <textarea placeholder="請輸入當日作業特殊情況說明..." rows={2} value={task.note}
                          onChange={e => setTasks(prev => prev.map(t => t.itemId === task.itemId ? { ...t, note: e.target.value } : t))}
                          className="w-full text-sm font-medium bg-slate-50 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all resize-none min-h-[64px]" />
                        {!isSubmitted && <button className="absolute right-3 top-3 p-1 rounded-lg bg-slate-200/50 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setShowNoteFor(prev => {const n=new Set(prev); n.delete(task.itemId); return n;})}><X className="w-3.5 h-3.5" /></button>}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Float Submit Button */}
      {!isLoading && !isFinalized && (
        <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-4 z-[45] pb-safe">
          <Button
            id="submit-daily-tasks"
            disabled={!completedCount || isSubmitting}
            onClick={() => setShowConfirmDialog(true)}
            className={cn(
              "w-full h-14 rounded-3xl text-base font-black shadow-elegant-lg transition-all transform active:scale-95 gap-3",
              completedCount ? "bg-slate-900 hover:bg-black text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed"
            )}>
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Send className="w-5 h-5" />確認送出今日資料 ({completedCount} 項)</>
            )}
          </Button>
        </div>
      )}

      {/* Confirm Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowConfirmDialog(false)}>
          <div className="w-full max-w-sm bg-white rounded-[40px] p-8 shadow-elegant-lg transform transition-all animate-fade-scale" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-center mb-2">確定要送出嗎？</h3>
            <p className="text-sm text-center text-slate-500 leading-relaxed mb-8">
              您即將送出 <span className="text-slate-900 font-bold">{completedCount}</span> 項工作資料。<br/>
              <span className="text-red-600 font-bold">送出後將進入稽核流程，無法自行修改。</span>
            </p>
            <div className="flex flex-col gap-3">
              <Button className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black" onClick={handleSubmit} disabled={isSubmitting}>
                確認送出資料
              </Button>
              <Button variant="ghost" className="h-12 rounded-2xl font-bold text-slate-400" onClick={() => setShowConfirmDialog(false)}>
                先不要
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Summary Modal (Success) */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-emerald-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-[40px] p-8 shadow-elegant-lg overflow-hidden relative animate-fade-scale">
            <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 mx-auto shadow-inner">
              <Check className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-center text-slate-900 mb-2">上傳完成！</h3>
            <p className="text-sm text-center text-slate-500 mb-8 font-medium">系統已成功接收您的當日填報資訊</p>
            
            <div className="bg-slate-50 rounded-3xl p-5 space-y-4 mb-8">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">
                <span>上傳明細摘要</span>
                <span>{format(currentDate, "yyyy-MM-dd")}</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600">完成項目數</span>
                  <span className="text-sm font-black text-slate-900">{lastSubmittedCount} 項</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600">預計獲得點數</span>
                  <span className="text-sm font-black text-blue-700">
                    {tasks.filter(t => t.status === "submitted").reduce((sum, t) => sum + t.points, 0).toLocaleString()} pt
                  </span>
                </div>
              </div>
            </div>

            <Button className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black hover:bg-black transition-all" onClick={() => setShowSummaryModal(false)}>
              好的，我知道了
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
