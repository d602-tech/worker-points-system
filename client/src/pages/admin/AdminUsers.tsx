import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, Plus, Edit2, Trash2, Download, KeyRound,
  X, PlusCircle, Loader2, CheckCircle2, Camera, Upload, Trash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { gasPost, gasGet, uploadFileToDrive } from "@/lib/gasApi";
import { hashPassword, useGasAuthContext } from "@/lib/useGasAuth";
import { differenceInCalendarDays } from "date-fns";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { isAssistant } from "@/lib/utils";

// ============================================================
// 型別
// ============================================================

type WorkerType = "general" | "offshore" | "safety" | "environment";
type WorkerStatus = "在職" | "離職" | "停職";

interface ExpPeriod {
  id: string;
  startDate: string;
  endDate: string;
  description: string;
  days: number;
  file: File | null;
  driveFileId?: string;
}

interface Worker {
  userId: string;
  name: string;
  email: string;
  department: string;
  area: string;
  workerType: WorkerType;
  onboardDate: string;
  status: WorkerStatus;
  pastExpDays: number;
  pastExpDetail?: string;
  ytdLeaveHours?: number; // 累計至上月已休時數 (供 tab4 使用)
}

// ============================================================
// 常數
// ============================================================

const DEPARTMENTS = [
  "土木工作隊", "建築工作隊", "電氣工作隊", "機械工作隊",
  "中部工作隊", "南部工作隊", "工安組", "檢驗組",
];

const AREAS = ["處本部", "大潭", "通霄", "興達", "大林", "金門", "琉球"];

const AREA_WORKER_TYPE_MAP: Record<string, WorkerType[]> = {
  "處本部": ["safety", "environment"],
  "大潭": ["general"],
  "通霄": ["general"],
  "興達": ["general"],
  "大林": ["general"],
  "金門": ["offshore"],
  "琉球": ["offshore"],
};

const WORKER_TYPE_LABELS: Record<WorkerType, string> = {
  general: "一般工地協助員",
  offshore: "離島工地協助員",
  safety: "職安業務兼管理員",
  environment: "環保業務人員",
};

const WORKER_TYPE_COLORS: Record<WorkerType, string> = {
  general: "bg-blue-50 text-blue-700 border-blue-200",
  offshore: "bg-teal-50 text-teal-700 border-teal-200",
  safety: "bg-orange-50 text-orange-700 border-orange-200",
  environment: "bg-green-50 text-green-700 border-green-200",
};

const STATUS_BADGE: Record<WorkerStatus, string> = {
  "在職": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "離職": "bg-slate-100 text-slate-600 border-slate-200",
  "停職": "bg-amber-100 text-amber-700 border-amber-200",
};

const WORKER_TYPE_FILTER = ["全部", ...Object.values(WORKER_TYPE_LABELS)];
const AREA_FILTER = ["全部", ...AREAS];

// ============================================================
// GAS 欄位名 → Worker 物件映射
// ============================================================

function mapSheetRowToWorker(row: Record<string, unknown>): Worker {
  const isActive = String(row["是否啟用"] ?? "true");
  let status: WorkerStatus = "在職";
  if (isActive === "false" || isActive === "FALSE") status = "離職";
  return {
    userId: String(row["人員編號"] || ""),
    name: String(row["姓名"] || ""),
    email: String(row["電子信箱"] || ""),
    department: String(row["所屬部門"] || ""),
    area: String(row["服務區域"] || ""),
    workerType: (String(row["職務類型"] || "general")) as WorkerType,
    onboardDate: String(row["到職日"] || ""),
    status,
    pastExpDays: Number(row["過往年資天數"] || 0),
    pastExpDetail: String(row["過往年資明細"] || ""),
    ytdLeaveHours: Number(row["累計至上月已休時數"] || row["ytdLeaveHours"] || 0),
  };
}

// ============================================================
// 工具函式
// ============================================================

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  return differenceInCalendarDays(e, s) + 1;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ============================================================
// 設定密碼 Modal
// ============================================================

function SetPasswordModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newPwd) { toast.error("請輸入新密碼"); return; }
    if (newPwd.length < 6) { toast.error("密碼長度至少 6 碼"); return; }
    if (newPwd !== confirmPwd) { toast.error("兩次輸入的密碼不一致"); return; }
    setSaving(true);
    try {
      const passwordHash = await hashPassword(newPwd);
      const res = await gasPost("setWorkerPassword", { userId: worker.userId, passwordHash });
      if (res.success) { toast.success(`${worker.name} 的密碼已設定`); onClose(); }
      else toast.error(res.error || "設定失敗");
    } catch (err) {
      toast.error(`發生錯誤：${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
        <div>
          <h3 className="text-lg font-semibold text-foreground">設定登入密碼</h3>
          <p className="text-sm text-muted-foreground mt-1">
            為 <span className="font-medium text-foreground">{worker.name}</span>（{worker.email}）設定密碼登入憑證。
          </p>
        </div>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="pwd-new">新密碼</Label>
            <Input id="pwd-new" type="password" placeholder="至少 6 碼" value={newPwd}
              onChange={e => setNewPwd(e.target.value)} disabled={saving} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwd-confirm">確認密碼</Label>
            <Input id="pwd-confirm" type="password" placeholder="再次輸入密碼" value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()} disabled={saving} />
          </div>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-100 text-blue-800 text-xs">
          密碼以 SHA-256 雜湊後儲存於 Google Sheets，系統不保留明文密碼。
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>取消</Button>
          <Button className="flex-1 bg-blue-700 hover:bg-blue-800" onClick={handleSave} disabled={saving}>
            {saving ? "儲存中..." : "儲存密碼"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 新增/編輯 Modal
// ============================================================

interface WorkerFormState {
  name: string;
  email: string;
  department: string;
  area: string;
  workerType: WorkerType | "";
  onboardDate: string;
  status: WorkerStatus;
  expPeriods: ExpPeriod[];
  ytdLeaveHours: number;
}

function WorkerModal({
  worker,
  onClose,
  onSaved,
  callerEmail,
}: {
  worker: Worker | null;
  onClose: () => void;
  onSaved: () => void;
  callerEmail: string;
}) {
  const isEdit = Boolean(worker);

  const [form, setForm] = useState<WorkerFormState>(() => {
    if (worker) {
      let periods: ExpPeriod[] = [];
      try {
        if (worker.pastExpDetail) {
          const parsed = JSON.parse(worker.pastExpDetail) as ExpPeriod[];
          periods = parsed.map(p => ({ ...p, file: null }));
        }
      } catch { /* ignore */ }
      return {
        name: worker.name,
        email: worker.email,
        department: worker.department,
        area: worker.area,
        workerType: worker.workerType,
        onboardDate: worker.onboardDate,
        status: worker.status,
        expPeriods: periods,
        ytdLeaveHours: worker.ytdLeaveHours || 0,
      };
    }
    return {
      name: "", email: "", department: "", area: "",
      workerType: "", onboardDate: "", status: "在職", expPeriods: [],
      ytdLeaveHours: 0,
    };
  });

  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cameraRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // 區域連動職務類型
  const handleAreaChange = (area: string) => {
    const types = AREA_WORKER_TYPE_MAP[area] ?? [];
    const newType = types.length === 1 ? types[0] : "";
    setForm((f: WorkerFormState) => ({ ...f, area, workerType: newType as WorkerType | "" }));
  };

  // 過往年資天數（自動加總）
  const totalExpDays = form.expPeriods.reduce((sum: number, p: ExpPeriod) => sum + p.days, 0);

  // 新增年資區間
  const addPeriod = () => {
    const id = Date.now().toString();
    setForm((f: WorkerFormState) => ({
      ...f,
      expPeriods: [
        ...f.expPeriods,
        { id, startDate: "", endDate: "", description: "", days: 0, file: null },
      ],
    }));
  };

  const removePeriod = (id: string) => {
    setForm((f: WorkerFormState) => ({ ...f, expPeriods: f.expPeriods.filter((p: ExpPeriod) => p.id !== id) }));
  };

  const updatePeriod = (id: string, patch: Partial<ExpPeriod>) => {
    setForm((f: WorkerFormState) => ({
      ...f,
      expPeriods: f.expPeriods.map(p => {
        if (p.id !== id) return p;
        const updated = { ...p, ...patch };
        // 自動計算天數
        if (patch.startDate !== undefined || patch.endDate !== undefined) {
          updated.days = calcDays(updated.startDate, updated.endDate);
        }
        return updated;
      }),
    }));
  };

  const handlePeriodFile = (id: string, file: File) => {
    updatePeriod(id, { file, driveFileId: undefined });
  };

  // 儲存
  const handleSave = async () => {
    if (!form.name) { toast.error("請輸入姓名"); return; }
    if (!form.email) { toast.error("請輸入 Email"); return; }
    if (!form.department) { toast.error("請選擇部門"); return; }
    if (!form.area) { toast.error("請選擇服務區域"); return; }
    if (!form.workerType) { toast.error("請選擇職務類型"); return; }
    if (!form.onboardDate) { toast.error("請輸入到職日期"); return; }

    setSaving(true);

    try {
      // 1. 上傳各區間的年資佐證
      const periodsToUpload = form.expPeriods.filter(p => p.file && !p.driveFileId);
      if (periodsToUpload.length > 0) {
        setUploadProgress({ current: 0, total: periodsToUpload.length });
        let uploaded = 0;
        for (const period of periodsToUpload) {
          if (!period.file) continue;
          const base64Data = await blobToBase64(period.file);
          const res = await uploadFileToDrive(
            callerEmail, base64Data, period.file.name, period.file.type,
            worker?.userId || "NEW", form.onboardDate, "年資佐證",
          );
          if (res.success && res.data) {
            updatePeriod(period.id, { driveFileId: res.data.driveFileId, file: null });
          }
          uploaded++;
          setUploadProgress({ current: uploaded, total: periodsToUpload.length });
        }
      }

      // 2. 重新計算 pastExpDetail（含最新 driveFileId）
      const finalPeriods = form.expPeriods.map(p => ({
        id: p.id,
        startDate: p.startDate,
        endDate: p.endDate,
        description: p.description,
        days: p.days,
        driveFileId: p.driveFileId || "",
      }));
      const pastExpDetail = JSON.stringify(finalPeriods);

      // 3. 呼叫 upsertWorker
      const res = await gasPost("upsertWorker", {
        worker: {
          ...(worker ? { userId: worker.userId } : {}),
          name: form.name,
          email: form.email,
          department: form.department,
          area: form.area,
          workerType: form.workerType,
          onboardDate: form.onboardDate,
          isActive: form.status === "在職",
          pastExpDays: totalExpDays,
          pastExpDetail,
          ytdLeaveHours: form.ytdLeaveHours,
        },
      });

      if (res.success) {
        toast.success(isEdit ? "人員資料已更新" : "人員已新增");
        onSaved();
        onClose();
      } else {
        toast.error(res.error || "儲存失敗");
      }
    } catch (err) {
      toast.error(`操作失敗：${String(err)}`);
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const availableTypes = form.area ? (AREA_WORKER_TYPE_MAP[form.area] ?? []) : [];
  const isHQ = form.area === "處本部";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h3 className="text-lg font-semibold text-foreground">
            {isEdit ? `編輯人員 — ${worker!.name}` : "新增人員"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* 基本資料 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>姓名 <span className="text-red-500">*</span></Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="王小明" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="xxx@example.com" type="email" className="h-9" />
            </div>

            {/* 部門下拉 */}
            <div className="space-y-1.5">
              <Label>部門 <span className="text-red-500">*</span></Label>
              <select
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— 請選擇 —</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* 服務區域下拉 */}
            <div className="space-y-1.5">
              <Label>服務區域 <span className="text-red-500">*</span></Label>
              <select
                value={form.area}
                onChange={e => handleAreaChange(e.target.value)}
                className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— 請選擇 —</option>
                {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* 職務類型 */}
            <div className="space-y-1.5 col-span-2">
              <Label>職務類型 <span className="text-red-500">*</span></Label>
              {!form.area ? (
                <div className="h-9 flex items-center px-3 text-sm text-muted-foreground border border-input rounded-md bg-muted/20">
                  請先選擇服務區域
                </div>
              ) : isHQ ? (
                <div className="flex gap-2">
                  {availableTypes.map(t => (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, workerType: t }))}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                        form.workerType === t
                          ? "bg-blue-700 border-blue-700 text-white"
                          : "bg-white border-border text-foreground hover:border-blue-400",
                      )}
                    >
                      {WORKER_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="h-9 flex items-center">
                  {availableTypes[0] && (
                    <span className={cn(
                      "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border",
                      WORKER_TYPE_COLORS[availableTypes[0]],
                    )}>
                      {WORKER_TYPE_LABELS[availableTypes[0]]}（依區域自動設定）
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>到職日期 <span className="text-red-500">*</span></Label>
              <Input type="date" value={form.onboardDate}
                onChange={e => setForm(f => ({ ...f, onboardDate: e.target.value }))} className="h-9" />
            </div>

            <div className="space-y-1.5">
              <Label>在職狀態</Label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as WorkerStatus }))}
                className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="在職">在職</option>
                <option value="停職">停職</option>
                <option value="離職">離職</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>累計至上月已休時數 (B)</Label>
              <Input type="number" value={form.ytdLeaveHours}
                onChange={e => setForm(f => ({ ...f, ytdLeaveHours: Number(e.target.value) }))}
                placeholder="例如 8" className="h-9" />
              <p className="text-[10px] text-muted-foreground italic">用於特休報表「截至上月已休」欄位</p>
            </div>
          </div>

          {/* 過往年資區間 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-foreground">過往年資區間</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  小計年資天數：
                  <span className="font-semibold text-foreground ml-1">{totalExpDays} 天</span>
                  （自動加總）
                </div>
              </div>
              <button
                onClick={addPeriod}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                增加區間
              </button>
            </div>

            {form.expPeriods.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-3 text-center">
                尚未填寫過往年資，點擊「增加區間」新增
              </div>
            ) : (
              <div className="space-y-3">
                {form.expPeriods.map((period, idx) => (
                  <div key={period.id} className="bg-slate-50 rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-medium text-muted-foreground">區間 {idx + 1}</div>
                      <div className="flex items-center gap-2">
                        {period.days > 0 && (
                          <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            {period.days} 天
                          </span>
                        )}
                        <button
                          onClick={() => removePeriod(period.id)}
                          className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-100 text-muted-foreground hover:text-red-600 transition-colors"
                        >
                          <Trash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">起始日</div>
                        <Input
                          type="date"
                          value={period.startDate}
                          onChange={e => updatePeriod(period.id, { startDate: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">結束日</div>
                        <Input
                          type="date"
                          value={period.endDate}
                          onChange={e => updatePeriod(period.id, { endDate: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">說明（選填）</div>
                      <Input
                        value={period.description}
                        onChange={e => updatePeriod(period.id, { description: e.target.value })}
                        placeholder="如：前任職公司名稱..."
                        className="h-8 text-xs"
                      />
                    </div>

                    {/* 年資佐證 */}
                    <div>
                      <div className="text-xs text-muted-foreground mb-1.5">年資佐證</div>
                      {period.driveFileId ? (
                        <a
                          href={`https://drive.google.com/file/d/${period.driveFileId}/view`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs text-blue-600 hover:underline"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          已上傳（點擊查看）
                        </a>
                      ) : period.file ? (
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs text-emerald-700 flex-1 truncate">{period.file.name}</span>
                          <button
                            onClick={() => updatePeriod(period.id, { file: null })}
                            className="text-muted-foreground hover:text-red-600 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => cameraRefs.current[period.id]?.click()}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground bg-white border border-border rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5" />拍照
                          </button>
                          <button
                            onClick={() => fileRefs.current[period.id]?.click()}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground bg-white border border-border rounded-lg hover:border-blue-400 hover:text-blue-600 transition-colors"
                          >
                            <Upload className="w-3.5 h-3.5" />上傳
                          </button>
                        </div>
                      )}
                      <input
                        ref={el => { cameraRefs.current[period.id] = el; }}
                        type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handlePeriodFile(period.id, f);
                          e.target.value = "";
                        }}
                      />
                      <input
                        ref={el => { fileRefs.current[period.id] = el; }}
                        type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) handlePeriodFile(period.id, f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>取消</Button>
          <Button
            className="flex-1 bg-blue-700 hover:bg-blue-800"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadProgress
                  ? `上傳 ${uploadProgress.current}/${uploadProgress.total}...`
                  : "儲存中..."}
              </span>
            ) : (isEdit ? "儲存變更" : "新增")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 主頁面
// ============================================================

export default function AdminUsers() {
  const { user } = useGasAuthContext();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("全部");
  const [filterArea, setFilterArea] = useState("全部");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pwdWorker, setPwdWorker] = useState<Worker | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);

  // 從 GAS API 載入真實人員資料
  const loadWorkers = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const res = await gasGet<Record<string, unknown>[]>("getWorkers", { callerEmail: user.email });
      if (res.success && Array.isArray(res.data)) {
        setWorkers(res.data.map(mapSheetRowToWorker));
      } else {
        toast.error(res.error || "載入人員資料失敗");
      }
    } catch (err) {
      toast.error(`載入失敗：${String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

  useEffect(() => { loadWorkers(); }, [loadWorkers]);

  const filtered = workers.filter(w => {
    if (!isAssistant(w.userId)) return false; // 白名單過濾
    const typeLabel = WORKER_TYPE_LABELS[w.workerType];
    const matchSearch = !search || w.name.includes(search) || w.userId.includes(search) || w.email.includes(search);
    const matchType = filterType === "全部" || typeLabel === filterType;
    const matchArea = filterArea === "全部" || w.area === filterArea;
    return matchSearch && matchType && matchArea;
  });

  const handleExport = () => {
    toast.info("匯出功能：需連接 Google Sheets API 後啟用");
  };

  return (
    <div className="space-y-6 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">人員管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {workers.length} 位協助員，{workers.filter(w => w.status === "在職").length} 位在職
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="w-4 h-4" />匯出
          </Button>
          <Button size="sm" className="bg-blue-700 hover:bg-blue-800 gap-1.5" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" />新增人員
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-start">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜尋姓名、工號、Email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {WORKER_TYPE_FILTER.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                filterType === t
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {AREA_FILTER.map(a => (
            <button key={a} onClick={() => setFilterArea(a)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                filterArea === a
                  ? "bg-slate-700 text-white border-slate-700"
                  : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {["工號", "姓名", "部門", "區域", "協助員類型", "到職日", "小計經驗(天)", "狀態", "操作"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    無符合條件的人員
                  </td>
                </tr>
              ) : filtered.map((w, idx) => (
                <tr key={w.userId}
                  className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors",
                    idx % 2 !== 0 && "bg-muted/10")}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.userId}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.department}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.area}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "inline-block px-2 py-0.5 rounded text-xs border",
                      WORKER_TYPE_COLORS[w.workerType],
                    )}>
                      {WORKER_TYPE_LABELS[w.workerType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{w.onboardDate}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{w.pastExpDays}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_BADGE[w.status])}>
                      {w.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button title="設定密碼" onClick={() => setPwdWorker(w)}
                        className="p-1.5 rounded-lg hover:bg-purple-50 text-muted-foreground hover:text-purple-700 transition-colors">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditWorker(w)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-muted-foreground hover:text-blue-700 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toast.error("刪除功能需二次確認")}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground">
          <span>顯示 {filtered.length} / {workers.length} 筆</span>
          <span>資料來源：Google Sheets「人員資料」分頁</span>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editWorker) && (
        <WorkerModal
          worker={editWorker}
          onClose={() => { setShowAddModal(false); setEditWorker(null); }}
          onSaved={() => { loadWorkers(); }}
          callerEmail={user?.email || ""}
        />
      )}

      {/* Set Password Modal */}
      {pwdWorker && (
        <SetPasswordModal worker={pwdWorker} onClose={() => setPwdWorker(null)} />
      )}
    </div>
  );
}
