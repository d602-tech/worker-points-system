import { useState, useMemo, useRef, useEffect } from "react";
import {
  ChevronLeft, ChevronRight, TrendingUp, Send,
  AlertCircle, Camera, Upload, X, Loader2, FileText, CheckCircle2, Circle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, addMonths, subMonths } from "date-fns";
import { zhTW } from "date-fns/locale";
import { POINTS_CONFIG_SEED } from "../../../../shared/domain";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasPost, gasGet, getDriveFolderId } from "@/lib/gasApi";

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

function getMonthlyItems(workerType: string) {
  return POINTS_CONFIG_SEED.filter(
    item =>
      item.workerType === workerType &&
      (item.category === "B1" || item.category === "B2" || item.category === "C"),
  );
}

// ============================================================
// 型別
// ============================================================

interface TaskFile {
  id: string;
  name: string;
  type: string;
  blob?: File;
  driveFileId?: string;
}

interface MonthlyItem {
  itemId: string;
  name: string;
  category: string;
  pointsPerUnit: number;
  unit: string;
  quantity: number;
  perfLevel: "" | "優" | "佳" | "平";
  status: "draft" | "submitted" | "approved" | "rejected" | "";
  files: TaskFile[];
}

// ============================================================
// 常數
// ============================================================

const PERF_LEVELS = [
  { value: "優" as const, label: "優", points: 5000, color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "佳" as const, label: "佳", points: 3000, color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "平" as const, label: "平", points: 2000, color: "bg-slate-100 text-slate-700 border-slate-300" },
];

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-700",
  draft: "bg-amber-100 text-amber-700",
};

const STATUS_LABEL: Record<string, string> = {
  submitted: "已送出", approved: "已通過", rejected: "已退回", draft: "待送出",
};

// ============================================================
// 主元件
// ============================================================

export default function MonthlyReport() {
  const { user } = useGasAuthContext();
  const workerType = useMemo(() => user?.workerType || "general", [user?.workerType]);
  const monthlyItemDefs = useMemo(() => getMonthlyItems(workerType), [workerType]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [items, setItems] = useState<MonthlyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [resubmitNoteMap, setResubmitNoteMap] = useState<Record<string, string>>({});

  // File input refs per item
  const cameraRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 滑動切換月份
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 70) {
      if (deltaX > 0) setCurrentMonth(m => subMonths(m, 1));
      else setCurrentMonth(m => addMonths(m, 1));
    }
    touchStartX.current = null;
  };

  const [dailyTotal, setDailyTotal] = useState(0);

  // 載入月報資料
  useEffect(() => {
    if (!user?.id) return;
    setIsLoading(true);
    const monthStr = format(currentMonth, "yyyy-MM");

    const initialItems: MonthlyItem[] = monthlyItemDefs.map(def => ({
      itemId: def.itemId, name: def.name, category: def.category,
      pointsPerUnit: def.pointsPerUnit, unit: def.unit, quantity: 0,
      perfLevel: "", status: "", files: [],
    }));

    Promise.all([
      gasGet("getMonthlyPoints", { callerEmail: user.email, workerId: user.id, yearMonth: monthStr }),
      gasGet("getDailyPoints", { callerEmail: user.email, workerId: user.id, yearMonth: monthStr })
    ]).then(([res, dailyRes]) => {
      if (res.success && Array.isArray(res.data)) {
        const dbItems = res.data as Record<string, unknown>[];
        setItems(initialItems.map(item => {
          const found = dbItems.find(
            r => r["項目編號"] === item.itemId || r["點數代碼"] === item.itemId,
          );
          if (found) {
            const qty = Number(found["完成數量"] || found["數量"] || 1);
            const note = String(found["備註"] || "");
            const st = String(found["狀態"] || "submitted") as MonthlyItem["status"];
            let perf = String(found["績效等級"] || "") as MonthlyItem["perfLevel"];
            if (item.category === "C" && !perf) {
              if (note.includes("優")) perf = "優";
              else if (note.includes("佳")) perf = "佳";
              else if (note.includes("平")) perf = "平";
            }
            const effectiveStatus = (st === "rejected" || st === "draft") ? "" : st;
            const dbFileIdsStr = String(found["佐證檔案編號"] || "");
            const loadedFiles = dbFileIdsStr.split(',').filter(Boolean).map((fid, idx) => ({
              id: fid, name: `已上傳檔案 ${idx + 1}`, type: "application/octet-stream", driveFileId: fid
            }));
            return { ...item, quantity: qty, perfLevel: perf, status: effectiveStatus, files: loadedFiles };
          }
          return item;
        }));
      } else {
        setItems(initialItems);
      }

      if (dailyRes.success && Array.isArray(dailyRes.data)) {
        const sum = (dailyRes.data as any[]).reduce((acc, curr) => {
          let pt = 0;
          for (const key in curr) {
            if (key.trim() === "點數" || key.trim().toLowerCase() === "points") {
              pt += Number((curr as Record<string, unknown>)[key]) || 0;
            }
          }
          return acc + pt;
        }, 0);
        setDailyTotal(sum);
      } else {
        setDailyTotal(0);
      }
    }).finally(() => setIsLoading(false));
  }, [user?.id, currentMonth, monthlyItemDefs]);

  // ──────────────────────────────
  // 計算
  // ──────────────────────────────
  const monthlyRegTotal = items.reduce((sum, item) => {
    if (item.category === "C") return sum;
    return sum + item.pointsPerUnit * item.quantity;
  }, 0);

  const perfTotal = items.reduce((sum, item) => {
    if (item.category === "C" && item.perfLevel) {
      return sum + (PERF_LEVELS.find(l => l.value === item.perfLevel)?.points || 0);
    }
    return sum;
  }, 0);

  const totalPoints = dailyTotal + monthlyRegTotal + perfTotal;

  const isLocked = (item: MonthlyItem) =>
    item.status === "submitted" || item.status === "approved";

  // B1/B2 需上傳佐證驗證
  const b1b2WithoutFile = items.filter(
    i => (i.category === "B1" || i.category === "B2") &&
      i.quantity > 0 &&
      !isLocked(i) &&
      i.files.length === 0,
  );
  const canSubmit =
    !isSubmitting &&
    totalPoints > 0 &&
    b1b2WithoutFile.length === 0 &&
    items.some(i => !isLocked(i) && (i.quantity > 0 || i.perfLevel));

  // ──────────────────────────────
  // 操作
  // ──────────────────────────────
  // B1/B2 checkbox 開關（勾選 = 1次，取消 = 0次）
  const toggleB1B2 = (itemId: string) => {
    setItems(prev =>
      prev.map(i =>
        i.itemId === itemId && !isLocked(i)
          ? { ...i, quantity: i.quantity > 0 ? 0 : 1 }
          : i,
      ),
    );
  };

  const setPerfLevel = (itemId: string, level: MonthlyItem["perfLevel"]) => {
    setItems(prev =>
      prev.map(i =>
        i.itemId === itemId && !isLocked(i)
          ? { ...i, perfLevel: level, quantity: level ? 1 : 0 }
          : i,
      ),
    );
  };

  const addFile = (itemId: string, file: File) => {
    const newFile: TaskFile = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      type: file.type,
      blob: file,
    };
    setItems(prev =>
      prev.map(i =>
        i.itemId === itemId ? { ...i, files: [...i.files, newFile] } : i,
      ),
    );
  };

  const removeFile = (itemId: string, fileId: string) => {
    setItems(prev =>
      prev.map(i =>
        i.itemId === itemId
          ? { ...i, files: i.files.filter(f => f.id !== fileId) }
          : i,
      ),
    );
  };

  // ──────────────────────────────
  // 送出
  // ──────────────────────────────
  const handleSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);

    try {
      const yearMonth = format(currentMonth, "yyyy-MM");
      const toSubmit = items.filter(
        i => !isLocked(i) && (i.quantity > 0 || i.perfLevel),
      );

      // 計算總上傳檔案數
      const allFiles = toSubmit.flatMap(i =>
        i.files.filter(f => f.blob && !f.driveFileId),
      );
      const totalFiles = allFiles.length;

      // 1. 上傳所有佐證檔案
      if (totalFiles > 0) {
        setUploadProgress({ current: 0, total: totalFiles });
        let uploaded = 0;

        for (const item of toSubmit) {
          for (const file of item.files.filter(f => f.blob && !f.driveFileId)) {
            const base64Data = await blobToBase64(file.blob!);
            const category = item.category === "B1" ? "B1_月報" : "B2_月報";

            const fileExt = file.name.split('.').pop() || 'jpg';
            const dateStrFormatted = format(currentMonth, "yyyyMM");
            const taskNameStr = item.name || item.itemId;
            const userNameStr = user?.name || "未知";
            const formattedFileName = `${dateStrFormatted}_${taskNameStr}_${userNameStr}.${fileExt}`;

            const uploadRes = await gasPost<{ driveFileId: string; fileName: string }>(
              "uploadFileToDrive",
              {
                callerEmail: user.email,
                base64Data,
                fileName: formattedFileName,
                mimeType: file.type,
                workerId: user.id,
                date: yearMonth,
                category,
                driveFolderId: getDriveFolderId(),
              },
            );
            if (uploadRes.success && uploadRes.data) {
              const { driveFileId } = uploadRes.data;
              await gasPost("saveFileIndex", {
                callerEmail: user.email,
                record: {
                  userId: user.id,
                  date: yearMonth,
                  itemId: item.itemId,
                  fileName: file.name,
                  mimeType: file.type,
                  driveFileId,
                },
              });
              // 標記已上傳
              setItems(prev =>
                prev.map(i =>
                  i.itemId === item.itemId
                    ? {
                        ...i,
                        files: i.files.map(f =>
                          f.id === file.id ? { ...f, driveFileId, blob: undefined } : f,
                        ),
                      }
                    : i,
                ),
              );
            }
            uploaded++;
            setUploadProgress({ current: uploaded, total: totalFiles });
          }
        }
      }

      // 2. 送出點數紀錄
      for (const item of toSubmit) {
        await gasPost("saveMonthlyPoints", {
          callerEmail: user.email,
          record: {
            userId: user.id,
            yearMonth: yearMonth,
            itemId: item.itemId,
            quantity: item.quantity,
            points:
              item.category === "C"
                ? PERF_LEVELS.find(l => l.value === item.perfLevel)?.points || 0
                : item.pointsPerUnit * item.quantity,
            fileIds: item.files.filter(f => f.driveFileId).map(f => f.driveFileId).join(","),
            perfLevel: item.perfLevel || "",
            status: "submitted"
          }
        });
      }

      toast.success("月報資料已送出！");
      setItems(prev =>
        prev.map(i =>
          !isLocked(i) && (i.quantity > 0 || i.perfLevel)
            ? { ...i, status: "submitted" }
            : i,
        ),
      );
    } catch (err) {
      toast.error(`送出失敗：${String(err)}`);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  };

  const handleResubmitMonthlyItem = async (item: MonthlyItem) => {
    const reason = resubmitNoteMap[item.itemId];
    if (!reason || !reason.trim()) {
      toast.error("請填寫修改原因！");
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.pdf,application/pdf";
    input.multiple = true;
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList || fileList.length === 0) return;

      setIsSubmitting(true);
      try {
        const dateStr = format(new Date(), "yyyy-MM-dd");
        const monthStr = format(currentMonth, "yyyy-MM");
        const newFileIds: string[] = [];

        // 上傳新檔案
        for (const f of Array.from(fileList)) {
          const base64Data = await blobToBase64(f);
          const fileExt = f.name.split('.').pop() || 'jpg';
          const taskNameStr = item.name || item.itemId;
          const userNameStr = user?.name || "未知";
          const formattedFileName = `${format(currentMonth, "yyyyMM")}_${taskNameStr}_${userNameStr}_覆寫.${fileExt}`;

          const uploadRes = await gasPost("uploadFileToDrive", {
            callerEmail: user?.email || "",
            base64Data,
            fileName: formattedFileName,
            mimeType: f.type,
            workerId: user?.id || "",
            date: monthStr, // index key
            category: item.category === "B1" ? "B1_月報" : "B2_月報",
            driveFolderId: getDriveFolderId(),
          });

          if (uploadRes.success && uploadRes.data) {
            const drvId = (uploadRes.data as any).driveFileId;
            newFileIds.push(drvId);
            // 寫入索引
            await gasPost("saveFileIndex", {
              callerEmail: user?.email || "",
              record: {
                userId: user?.id || "", 
                date: monthStr,
                itemId: item.itemId,
                fileName: formattedFileName, 
                mimeType: f.type, 
                driveFileId: drvId,
              }
            });
          }
        }

        // 重新送出該列
        const ptsRes = await gasPost("saveMonthlyPoints", {
          callerEmail: user?.email || "",
          record: {
            userId: user?.id || "",
            yearMonth: monthStr,
            itemId: item.itemId,
            quantity: item.quantity || 1,
            points: item.category === "C" ? (PERF_LEVELS.find(l => l.value === item.perfLevel)?.points || 0) : (item.pointsPerUnit * (item.quantity || 1)),
            perfLevel: item.perfLevel || "",
            fileIds: newFileIds.join(","),
            status: "submitted",
            note: `[修改原因: ${reason}]`,
          }
        });

        if (ptsRes.success) {
          toast.success("佐證已重新覆寫完成！");
          setResubmitNoteMap(prev => ({ ...prev, [item.itemId]: "" }));
          setTimeout(() => window.location.reload(), 1000);
        } else {
          toast.error("覆寫記錄失敗：" + ptsRes.error);
        }
      } catch (err: any) {
        toast.error("覆寫失敗：" + err.message);
      } finally {
        setIsSubmitting(false);
      }
    };
    input.click();
  };

  // ──────────────────────────────
  // Render
  // ──────────────────────────────
  return (
    <div
      className="flex flex-col min-h-full bg-background select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="flex items-center justify-between px-4 py-4">
          <button
            onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
          >
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">
              {format(currentMonth, "yyyy年M月", { locale: zhTW })}
            </div>
            <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
              MONTHLY REPORT
            </div>
          </div>
          <button
            onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all"
          >
            <ChevronRight className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="bg-slate-900 rounded-[28px] px-6 py-5 flex items-center justify-between shadow-elegant-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">
                本月累計（含每日及月報）
              </span>
              <span className="text-3xl font-black text-white">
                {totalPoints.toLocaleString()}
                <span className="text-sm font-bold ml-1 text-slate-400">元</span>
              </span>
              <div className="text-[11px] font-medium text-white/70 mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span>每日: {dailyTotal.toLocaleString()}</span>
                <span>+</span>
                <span>例行月報: {monthlyRegTotal.toLocaleString()}</span>
                <span>+</span>
                <span>績效: {perfTotal.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* B1/B2 必附佐證提示 */}
      {b1b2WithoutFile.length > 0 && !isLoading && (
        <div className="mx-4 mt-4 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800">
            B1/B2 項目填報數量後須上傳佐證文件，才能送出月報
          </span>
        </div>
      )}

      {/* Items */}
      <div className="flex-1 px-4 py-4 space-y-4 pb-36">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm text-muted-foreground font-medium">讀取月報資料中...</div>
          </div>
        ) : items.map(item => {
          const isC = item.category === "C";
          const locked = isLocked(item);
          const needsFile = (item.category === "B1" || item.category === "B2") &&
            item.quantity > 0 && !locked;
          const missingFile = needsFile && item.files.length === 0;

          return (
            <div
              key={item.itemId}
              className={cn(
                "bg-white rounded-[32px] shadow-elegant border transition-all duration-300",
                locked
                  ? "border-emerald-100 bg-emerald-50/5 opacity-90"
                  : missingFile
                    ? "border-amber-300"
                    : "border-border/60 hover:border-blue-200",
              )}
            >
              <div className="p-5">
                {/* Item header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className={cn(
                        "text-[10px] font-black px-1.5 py-0.5 rounded-md text-white leading-none",
                        item.category === "B1" ? "bg-orange-500"
                          : item.category === "B2" ? "bg-purple-500"
                            : "bg-blue-600",
                      )}>
                        {item.category}
                      </span>
                      {item.status && (
                        <span className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                          STATUS_BADGE[item.status] ?? "bg-slate-100 text-slate-600",
                        )}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      )}
                      {missingFile && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
                          需附佐證
                        </span>
                      )}
                    </div>
                    <h4 className="text-[15px] font-bold text-foreground leading-snug">
                      {item.name}
                    </h4>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-slate-400">
                      {item.pointsPerUnit.toLocaleString()} 元
                    </div>
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">
                      PER {item.unit}
                    </div>
                  </div>
                </div>

                {/* Input area */}
                {isC ? (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                      本月績效評估
                    </div>
                    <div className="flex gap-2.5">
                      {PERF_LEVELS.map(({ value, label, points, color }) => (
                        <button
                          key={value}
                          disabled={locked}
                          onClick={() => setPerfLevel(item.itemId, item.perfLevel === value ? "" : value)}
                          className={cn(
                            "flex-1 py-3.5 rounded-[20px] border-2 transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95",
                            item.perfLevel === value
                              ? color
                              : "border-slate-50 bg-slate-50 text-slate-400 opacity-60",
                          )}
                        >
                          <span className="text-base font-black">{label}</span>
                          <span className="text-[10px] font-bold opacity-80">{points.toLocaleString()}元</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={locked}
                    onClick={() => toggleB1B2(item.itemId)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-2xl border transition-all active:scale-[0.98]",
                      item.quantity > 0
                        ? "bg-blue-50 border-blue-200"
                        : "bg-slate-50/50 border-slate-100",
                      locked && "opacity-70 cursor-not-allowed",
                    )}
                  >
                    {item.quantity > 0
                      ? <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      : <Circle className="w-6 h-6 text-slate-300 flex-shrink-0" />
                    }
                    <div className="flex-1 text-left">
                      <div className={cn(
                        "text-sm font-bold",
                        item.quantity > 0 ? "text-blue-700" : "text-slate-400",
                      )}>
                        {item.quantity > 0 ? "已勾選" : "點擊勾選"}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{item.unit}</div>
                    </div>
                    <div className={cn(
                      "text-sm font-black",
                      item.quantity > 0 ? "text-blue-700" : "text-slate-300",
                    )}>
                      {item.quantity > 0 ? `+${item.pointsPerUnit.toLocaleString()} 元` : "—"}
                    </div>
                  </button>
                )}

                {/* 小計 */}
                {(item.quantity > 0 || item.perfLevel) && (
                  <div className="mt-4 pt-3 border-t border-dashed border-border/60 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">小計</span>
                    <span className="text-sm font-black text-blue-700">
                      +{(isC
                        ? PERF_LEVELS.find(l => l.value === item.perfLevel)?.points || 0
                        : item.pointsPerUnit * item.quantity
                      ).toLocaleString()} 元
                    </span>
                  </div>
                )}

                {/* B1/B2 佐證上傳區 */}
                {(item.category === "B1" || item.category === "B2") && !locked && (
                  <div className="mt-4 pt-4 border-t border-border/40">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        佐證文件
                        {needsFile && (
                          <span className="text-red-500 ml-0.5">*</span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => cameraRefs.current[item.itemId]?.click()}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground bg-slate-50 border border-border rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                          <Camera className="w-3.5 h-3.5" />拍照
                        </button>
                        <button
                          onClick={() => fileRefs.current[item.itemId]?.click()}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground bg-slate-50 border border-border rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />上傳
                        </button>
                      </div>
                    </div>

                    {/* 已選擇的檔案 */}
                    {item.files.length > 0 && (
                      <div className="space-y-1.5">
                        {item.files.map(f => (
                          <div key={f.id}
                            className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2">
                            <FileText className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                            <span className="text-xs text-foreground flex-1 truncate">{f.name}</span>
                            {f.driveFileId ? (
                              <a
                                href={`https://drive.google.com/file/d/${f.driveFileId}/view`}
                                target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-emerald-600 font-bold"
                              >Drive ✓</a>
                            ) : (
                              <button
                                onClick={() => removeFile(item.itemId, f.id)}
                                className="w-5 h-5 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                              >
                                <X className="w-3 h-3 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 修改原因覆寫區塊 (Locked B1/B2/C) */}
                {(item.category === "B1" || item.category === "B2") && locked && (
                  <div className="mt-4 pt-4 border-t border-dashed border-border/40">
                      <div className="bg-orange-50/70 border border-orange-200/60 p-4 rounded-2xl space-y-3">
                         <div className="flex items-center gap-1.5 text-orange-800 text-xs font-bold mb-1">
                           <AlertCircle className="w-4 h-4" />重新上傳佐證 (覆寫舊檔)
                         </div>
                         <textarea
                           placeholder="請填寫修改原因 (必填)"
                           className="w-full text-xs p-3 rounded-xl border border-orange-200 bg-white/60 focus:ring-orange-500 min-h-[60px]"
                           onChange={e => setResubmitNoteMap(prev => ({...prev, [item.itemId]: e.target.value}))}
                           value={resubmitNoteMap[item.itemId] || ""}
                         />
                         <button
                           disabled={!resubmitNoteMap[item.itemId]?.trim() || isSubmitting}
                           onClick={() => handleResubmitMonthlyItem(item)}
                           className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 transition-all text-white font-bold text-xs rounded-xl h-10 shadow-sm flex items-center justify-center disabled:opacity-50"
                         >
                            <Upload className="w-4 h-4 mr-1.5" />選取新檔案並覆寫
                         </button>
                      </div>
                  </div>
                )}

                {/* 隱藏的 input */}
                    <input
                      ref={el => { cameraRefs.current[item.itemId] = el; }}
                      type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) addFile(item.itemId, f);
                        e.target.value = "";
                      }}
                    />
                    <input
                      ref={el => { fileRefs.current[item.itemId] = el; }}
                      type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) addFile(item.itemId, f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}

                {/* 已上傳的 Drive 佐證（鎖定狀態） */}
                {locked && item.files.filter(f => f.driveFileId).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                    {item.files.filter(f => f.driveFileId).map(f => (
                      <a
                        key={f.id}
                        href={`https://drive.google.com/file/d/${f.driveFileId}/view`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        {f.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom submit bar */}
      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-4 bg-white/95 backdrop-blur-md border-t border-border z-[45] pb-safe">
        {b1b2WithoutFile.length > 0 && !isLoading && (
          <div className="text-xs text-amber-700 text-center mb-2 font-medium">
            尚有 {b1b2WithoutFile.length} 個 B1/B2 項目未上傳佐證
          </div>
        )}
        <Button
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={cn(
            "w-full h-14 rounded-3xl text-base font-black shadow-elegant-lg transition-all transform active:scale-95 gap-3",
            canSubmit ? "bg-slate-900 hover:bg-black text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed",
          )}
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              {uploadProgress
                ? `上傳 ${uploadProgress.current}/${uploadProgress.total} 個檔案...`
                : "送出中..."}
            </span>
          ) : (
            <>
              <Send className="w-5 h-5" />
              送出月報累記 ({totalPoints.toLocaleString()} 元)
            </>
          )}
        </Button>
      </div>

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
          <div className="w-20 h-20 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200">
            <AlertCircle className="w-10 h-10" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900">目前尚無可填報項目</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              此月份或您的身份類型目前沒有對應的月度工作項目。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
