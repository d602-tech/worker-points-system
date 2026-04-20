import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Camera, Image as ImageIcon, Paperclip, CheckCircle2, Circle, AlertTriangle, Eye, Trash2, Plus, X, Send, Check, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, addDays, subDays, isToday, isBefore, startOfDay, parseISO } from "date-fns";
import { zhTW } from "date-fns/locale";
import { POINTS_CONFIG_SEED, WORKER_TYPE_LABELS } from "../../../../shared/domain";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasPost, gasGet, getFileIndexByDate, getDriveFolderId, type FileIndexRow } from "@/lib/gasApi";

// ── 工具函式 ────────────────────────────────────────────────

function getDailyItems(workerType: string) {
  return POINTS_CONFIG_SEED.filter(
    item => item.workerType === workerType && item.category === "A1"
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── 型別 ──────────────────────────────────────────────────────

interface TaskFile {
  id: string;
  name: string;
  url: string;
  type: string;
  blob?: Blob;          // 尚未上傳的本地檔案
  driveFileId?: string; // 已上傳到 Drive 的 ID
}

interface TaskItem {
  itemId: string; name: string; points: number; completed: boolean;
  note: string; files: TaskFile[];
  status: "draft" | "submitted" | "approved" | "rejected";
  rejectionReason?: string;
  submittedAt?: string;
}

type DayStatus = "none" | "submitted" | "approved" | "rejected";

function getDayStatus(tasks: TaskItem[]): DayStatus {
  if (!tasks.length) return "none";
  if (tasks.every(t => t.status === "approved")) return "approved";
  if (tasks.some(t => t.status === "rejected")) return "rejected";
  if (tasks.some(t => t.status === "submitted" || t.status === "approved")) return "submitted";
  return "none";
}

const STATUS_CONFIG = {
  none:      { label: "未填報", color: "bg-red-50 text-red-600 border-red-200",         dot: "bg-red-500" },
  submitted: { label: "已送出", color: "bg-blue-50 text-blue-700 border-blue-200",      dot: "bg-blue-500" },
  approved:  { label: "已通過", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  rejected:  { label: "已退回", color: "bg-red-50 text-red-700 border-red-200",         dot: "bg-red-500" },
};

// ── 主元件 ────────────────────────────────────────────────────

export default function TodayTasks() {
  const { user } = useGasAuthContext();
  const [currentDate, setCurrentDate] = useState(new Date());

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
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);

  // 滑動切換日期
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 70) {
      if (deltaX > 0) setCurrentDate(d => subDays(d, 1));
      else setCurrentDate(d => addDays(d, 1));
    }
    touchStartX.current = null;
  };

  // 載入資料（點數紀錄 + 已上傳檔案）
  useEffect(() => {
    if (!user?.id) return;
    setIsLoading(true);
    const dateStr = format(currentDate, "yyyy-MM-dd");

    const initialTasks: TaskItem[] = dailyItems.map(item => ({
      itemId: item.itemId, name: item.name, points: item.pointsPerUnit,
      completed: false, note: "", files: [], status: "draft" as const,
    }));

    Promise.all([
      gasGet("getDailyPoints", { callerEmail: user.email, workerId: user.id, date: dateStr }),
      getFileIndexByDate(user.email, user.id, dateStr),
    ]).then(([pointsRes, filesRes]) => {
      let updatedTasks = [...initialTasks];

      if (pointsRes.success && Array.isArray(pointsRes.data)) {
        updatedTasks = updatedTasks.map(task => {
          const existing = (pointsRes.data as Record<string, unknown>[]).find(
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
              status: statusMap[String(existing["狀態"] || existing["審核狀態"] || "")] || "draft",
              note: String(existing["備註"] || ""),
              rejectionReason: String(existing["退回原因"] || ""),
              submittedAt: String(existing["上傳時間"] || existing["最後更新時間"] || ""),
            };
          }
          return task;
        });
      }

      // 載入已上傳的 Drive 檔案（重新整理後仍可見）
      if (filesRes.success && Array.isArray(filesRes.data)) {
        updatedTasks = updatedTasks.map(task => {
          const driveFiles = (filesRes.data as FileIndexRow[])
            .filter(f => f.itemId === task.itemId)
            .map(f => ({
              id: f.fileId,
              name: f.fileName,
              type: f.mimeType,
              url: `https://drive.google.com/file/d/${f.driveFileId}/view`,
              driveFileId: f.driveFileId,
            }));
          return driveFiles.length > 0 ? { ...task, files: driveFiles } : task;
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
  // 已上傳點數：以檔案有 driveFileId 為準（重整後仍可從 getFileIndexByDate 還原）
  const submittedPoints = tasks
    .filter(t => t.files.some(f => f.driveFileId) || t.status === "submitted" || t.status === "approved")
    .reduce((s, t) => s + t.points, 0);
  // 過去已完結日期 → 顯示唯讀詳情區塊
  const isPastFinalized =
    !isToday(currentDate) &&
    isBefore(startOfDay(currentDate), startOfDay(new Date())) &&
    isFinalized &&
    tasks.some(t => t.completed);

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
    setTasks(prev => prev.map(t =>
      t.itemId === itemId ? { ...t, files: t.files.filter(f => f.id !== fileId) } : t
    ));
  };

  // ── 送出：先上傳檔案到 Drive，再送點數 ──────────────────
  const handleSubmit = async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);
    try {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      const completedTasks = tasks.filter(
        t => t.completed && t.status !== "submitted" && t.status !== "approved"
      );
      setLastSubmittedCount(completedTasks.length);

      // 計算需要上傳的 blob 檔案總數
      const pendingFiles = completedTasks.flatMap(t =>
        t.files.filter(f => f.blob && !f.driveFileId)
      );
      const totalFiles = pendingFiles.length;

      if (totalFiles > 0) {
        setUploadProgress({ current: 0, total: totalFiles });
        let uploaded = 0;

        for (const task of completedTasks) {
          for (const file of task.files.filter(f => f.blob && !f.driveFileId)) {
            try {
              const base64Data = await blobToBase64(file.blob!);

              const fileExt = file.name.split('.').pop() || 'jpg';
              const dateStrFormatted = format(currentDate, "yyyyMMdd");
              const taskNameStr = task.name || task.itemId;
              const userNameStr = user?.name || "未知";
              const noteSuffix = task.note ? `_${task.note}` : "";
              const formattedFileName = `${dateStrFormatted}_${taskNameStr}_${userNameStr}${noteSuffix}.${fileExt}`;

              // 步驟 1：上傳至 Google Drive
              const uploadRes = await gasPost("uploadFileToDrive", {
                callerEmail: user?.email || "",
                base64Data,
                fileName: formattedFileName,
                mimeType: file.type,
                workerId: user?.id || "",
                date: dateStr,
                category: "A1_每日",
                driveFolderId: getDriveFolderId(),
              });

              if (uploadRes.success && uploadRes.data) {
                const { driveFileId } = uploadRes.data as { driveFileId: string; fileName: string };

                // 步驟 2：寫入檔案索引
                await gasPost("saveFileIndex", {
                  callerEmail: user?.email || "",
                  record: {
                    userId: user?.id || "",
                    date: dateStr,
                    itemId: task.itemId,
                    fileName: file.name,
                    mimeType: file.type,
                    driveFileId,
                  },
                });

                // 更新本地 file 記錄（標記已上傳）
                setTasks(prev => prev.map(t =>
                  t.itemId === task.itemId
                    ? {
                        ...t,
                        files: t.files.map(f =>
                          f.id === file.id
                            ? { ...f, driveFileId, url: `https://drive.google.com/file/d/${driveFileId}/view`, blob: undefined }
                            : f
                        ),
                      }
                    : t
                ));
              } else {
                toast.error(`檔案 ${file.name} 上傳失敗：${uploadRes.error || "未知錯誤"}`);
              }
            } catch (err) {
              toast.error(`檔案 ${file.name} 上傳失敗`);
            }

            uploaded++;
            setUploadProgress({ current: uploaded, total: totalFiles });
          }
        }
      }

      // 步驟 3：送出點數紀錄
      await gasPost("saveDailyPointsBatch", {
        callerEmail: user?.email || "",
        workerId: user?.id || "",
        workerName: user?.name || "",
        date: dateStr,
        items: completedTasks.map(task => ({
          itemId: task.itemId,
          points: task.points,
          quantity: 1,
          fileIds: task.files.map(f => f.driveFileId).filter(Boolean),
          note: task.note,
        })),
      });

      setTasks(prev => prev.map(t =>
        t.completed && t.status !== "approved" ? { ...t, status: "submitted" } : t
      ));
      setShowSummaryModal(true);
    } catch {
      toast.error("送出失敗，請檢查網路連線");
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
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
          <div className="flex items-center gap-2">
            <div className="text-right">
              <div className="text-[10px] font-bold text-muted-foreground leading-none">身份類型</div>
              <div className="text-xs font-semibold text-foreground max-w-[72px] truncate">{WORKER_TYPE_LABELS[workerType as keyof typeof WORKER_TYPE_LABELS] || workerType}</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center">
              <div className="text-[10px] font-bold text-muted-foreground leading-none">進度</div>
              <div className="text-sm font-bold text-blue-700">{completedCount}/{tasks.length}</div>
            </div>
            <div className="h-8 w-px bg-border/60" />
            <div className="text-center">
              <div className="text-[10px] font-bold text-muted-foreground leading-none">已上傳</div>
              <div className="text-sm font-bold text-emerald-700">
                {submittedPoints > 0 ? `${submittedPoints.toLocaleString()}元` : "—"}
              </div>
            </div>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="h-2 bg-muted rounded-full overflow-hidden shadow-inner">
            <div className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0}%` }} />
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
        ) : isPastFinalized ? (
          /* ── 過去已送出詳情（唯讀）── */
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-black text-muted-foreground uppercase tracking-widest">已送出詳情</span>
              <span className="text-[10px] font-bold text-white bg-slate-700 px-2 py-0.5 rounded-full">歷史紀錄</span>
            </div>
            {tasks.filter(t => t.completed).map(task => (
              <div key={task.itemId} className="bg-white rounded-3xl shadow-elegant border border-emerald-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 mt-0.5">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-900 text-white leading-none">A1</span>
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                        task.status === "approved" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                      )}>
                        {task.status === "approved" ? "已通過" : "已送出"}
                      </span>
                    </div>
                    <div className="text-[15px] font-bold text-foreground leading-snug">{task.name}</div>
                    <div className="text-sm font-black text-blue-800 mt-1">{task.points.toLocaleString()} 元</div>
                    {task.note && (
                      <div className="mt-2 text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">{task.note}</div>
                    )}
                    {task.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {task.files.map(file => (
                          <button
                            key={file.id}
                            onClick={() => window.open(file.url, "_blank")}
                            className="flex items-center gap-2 text-[11px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <Paperclip className="w-3 h-3" />
                            <span className="truncate max-w-[200px]">{file.name}</span>
                            <Eye className="w-3 h-3 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
              <span className="text-sm font-bold text-slate-600">當日總計</span>
              <span className="text-base font-black text-blue-800">
                {tasks.filter(t => t.completed).reduce((s, t) => s + t.points, 0).toLocaleString()} 元
              </span>
            </div>
            <div className="text-center text-xs text-muted-foreground py-2 px-4 leading-relaxed">
              此日期資料已鎖定，如需修正請聯絡管理員
            </div>
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
                  {isSubmitted
                    ? <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg transform scale-110"><Check className="w-4 h-4 text-white" /></div>
                    : task.completed ? <CheckCircle2 className="w-6 h-6 text-blue-600" /> : <Circle className="w-6 h-6 text-muted-foreground/30" />
                  }
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
                      <div className="text-sm font-black text-blue-800">{task.points.toLocaleString()} 元</div>
                    </div>
                  </div>
                  {isRejected && task.rejectionReason && (
                    <div className="mt-2 text-xs font-medium text-red-600 bg-red-50 p-2 rounded-xl border border-red-100 italic">{task.rejectionReason}</div>
                  )}
                  {task.files.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Paperclip className="w-3.5 h-3.5" />{task.files.length} FILES
                    </div>
                  )}
                </div>
                <ChevronRight className={cn("w-5 h-5 text-muted-foreground/40 mt-1 transition-transform", isExpanded && "rotate-90")} />
              </div>

              {isExpanded && (
                <div className="px-4 pb-5 pt-2 space-y-4 animate-fade-in border-t border-dashed border-border/60">
                  {/* 上傳按鈕（僅未送出時顯示）*/}
                  {!isSubmitted ? (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { icon: Camera, label: "拍照", accept: "image/*", capture: "environment" as const },
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
                      <span className="text-xs font-bold text-emerald-700">
                        資料已於 {task.submittedAt ? format(parseISO(String(task.submittedAt)), "HH:mm") : "今日"} 完成上傳且不可修改
                      </span>
                    </div>
                  )}

                  {/* 檔案列表 */}
                  {task.files.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">
                        {isSubmitted ? "已上傳檔案" : "已選取檔案"}
                      </div>
                      {task.files.map(file => (
                        <div key={file.id} className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-border/80 shadow-sm hover:border-blue-200 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {file.type?.includes("image") && !file.driveFileId
                              ? <img src={file.url} className="w-full h-full object-cover" />
                              : <Paperclip className="w-5 h-5 text-slate-400" />}
                          </div>
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-xs font-bold truncate">{file.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono uppercase flex items-center gap-1">
                              {file.type?.split("/")[1] || "FILE"}
                              {file.driveFileId && <span className="text-emerald-600 font-bold">· Drive ✓</span>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <button className="p-2 rounded-xl hover:bg-slate-100 active:scale-90" onClick={() => window.open(file.url, "_blank")}>
                              <Eye className="w-4 h-4 text-slate-400" />
                            </button>
                            {!isSubmitted && (
                              <button className="p-2 rounded-xl hover:bg-red-50 active:scale-90 text-red-500" onClick={() => removeFile(task.itemId, file.id)}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 備註 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-1">作業備註</div>
                      {!isSubmitted && !showNoteFor.has(task.itemId) && (
                        <button className="text-[10px] font-bold text-blue-600 flex items-center gap-1"
                          onClick={() => setShowNoteFor(prev => new Set(prev).add(task.itemId))}>
                          <Plus className="w-3 h-3" />新增
                        </button>
                      )}
                    </div>
                    {isSubmitted ? (
                      <div className="text-sm font-medium text-slate-700 bg-slate-50 p-3 rounded-2xl min-h-[48px] border border-slate-100">{task.note || "無備註"}</div>
                    ) : showNoteFor.has(task.itemId) || task.note ? (
                      <div className="relative group">
                        <textarea placeholder="請輸入當日作業特殊情況說明..." rows={2} value={task.note}
                          onChange={e => setTasks(prev => prev.map(t => t.itemId === task.itemId ? { ...t, note: e.target.value } : t))}
                          className="w-full text-sm font-medium bg-slate-50 border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-blue-100 focus:bg-white transition-all resize-none min-h-[64px]" />
                        <button className="absolute right-3 top-3 p-1 rounded-lg bg-slate-200/50 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => setShowNoteFor(prev => { const n = new Set(prev); n.delete(task.itemId); return n; })}>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 送出按鈕（含上傳進度）*/}
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
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {uploadProgress
                  ? <span>上傳 {uploadProgress.current}/{uploadProgress.total} 個檔案...</span>
                  : <span>儲存中...</span>
                }
              </div>
            ) : (
              <><Send className="w-5 h-5" />確認送出今日資料 ({completedCount} 項)</>
            )}
          </Button>
        </div>
      )}

      {/* 確認 Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowConfirmDialog(false)}>
          <div className="w-full max-w-sm bg-white rounded-[40px] p-8 shadow-elegant-lg transform transition-all animate-fade-scale" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 mx-auto">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-center mb-2">確定要送出嗎？</h3>
            <p className="text-sm text-center text-slate-500 leading-relaxed mb-8">
              您即將送出 <span className="text-slate-900 font-bold">{completedCount}</span> 項工作資料。<br />
              {tasks.some(t => t.completed && t.files.filter(f => f.blob).length > 0) && (
                <span className="text-blue-600 font-bold">
                  <Upload className="w-3 h-3 inline mr-1" />
                  含 {tasks.flatMap(t => t.files.filter(f => f.blob)).length} 個檔案將上傳至 Drive。
                  <br />
                </span>
              )}
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

      {/* 送出成功 Modal */}
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
                  <span className="text-sm font-bold text-slate-600">預計獲得金額</span>
                  <span className="text-sm font-black text-blue-700">
                    {tasks.filter(t => t.status === "submitted").reduce((sum, t) => sum + t.points, 0).toLocaleString()} 元
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
