import { useState } from "react";
import { Search, Plus, Edit2, Trash2, Download, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { gasPost } from "@/lib/gasApi";
import { hashPassword } from "@/lib/useGasAuth";

interface Worker {
  userId: string; name: string; email: string; department: string;
  area: string; workerType: string; onboardDate: string;
  status: "在職" | "離職" | "停職"; pastExpDays: number;
}

const MOCK_WORKERS: Worker[] = [
  { userId: "W001", name: "王小明", email: "wang@example.com", department: "土木工作隊", area: "大潭", workerType: "一般工地協助員", onboardDate: "2025-01-01", status: "在職", pastExpDays: 120 },
  { userId: "W002", name: "李大華", email: "li@example.com", department: "土木工作隊", area: "林口", workerType: "一般工地協助員", onboardDate: "2025-03-15", status: "在職", pastExpDays: 45 },
  { userId: "W003", name: "陳美玲", email: "chen@example.com", department: "土木工作隊", area: "大潭", workerType: "離島工地協助員", onboardDate: "2024-09-01", status: "在職", pastExpDays: 210 },
  { userId: "W004", name: "張志偉", email: "zhang@example.com", department: "職安組", area: "總部", workerType: "職安業務兼管理員", onboardDate: "2025-06-01", status: "停職", pastExpDays: 30 },
  { userId: "W005", name: "劉雅婷", email: "liu@example.com", department: "環保組", area: "通霄", workerType: "環保業務人員", onboardDate: "2024-12-01", status: "離職", pastExpDays: 90 },
];

const STATUS_BADGE: Record<Worker["status"], string> = {
  "在職": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "離職": "bg-slate-100 text-slate-600 border-slate-200",
  "停職": "bg-amber-100 text-amber-700 border-amber-200",
};

const WORKER_TYPES = ["全部", "一般工地協助員", "離島工地協助員", "職安業務兼管理員", "環保業務人員"];
const AREAS = ["全部", "大潭", "林口", "通霄", "總部"];

// ── 設定密碼 Modal ────────────────────────────────────────
function SetPasswordModal({
  worker,
  onClose,
}: {
  worker: Worker;
  onClose: () => void;
}) {
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
      if (res.success) {
        toast.success(`${worker.name} 的密碼已設定`);
        onClose();
      } else {
        toast.error(res.error || "設定失敗");
      }
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
            <Input
              id="pwd-new"
              type="password"
              placeholder="至少 6 碼"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pwd-confirm">確認密碼</Label>
            <Input
              id="pwd-confirm"
              type="password"
              placeholder="再次輸入密碼"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              disabled={saving}
            />
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

// ── 主頁面 ───────────────────────────────────────────────
export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("全部");
  const [filterArea, setFilterArea] = useState("全部");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editWorker, setEditWorker] = useState<Worker | null>(null);
  const [pwdWorker, setPwdWorker] = useState<Worker | null>(null);

  const filtered = MOCK_WORKERS.filter(w => {
    const matchSearch = !search || w.name.includes(search) || w.userId.includes(search) || w.email.includes(search);
    const matchType = filterType === "全部" || w.workerType === filterType;
    const matchArea = filterArea === "全部" || w.area === filterArea;
    return matchSearch && matchType && matchArea;
  });

  const handleExport = () => {
    toast.info("匯出功能：需連接 Google Sheets API 後啟用");
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">人員管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">共 {MOCK_WORKERS.length} 位協助員，{MOCK_WORKERS.filter(w => w.status === "在職").length} 位在職</p>
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
      <div className="flex flex-wrap gap-3 items-center">
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
          {WORKER_TYPES.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                filterType === t ? "bg-blue-700 text-white border-blue-700" : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {AREAS.map(a => (
            <button key={a} onClick={() => setFilterArea(a)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                filterArea === a ? "bg-slate-700 text-white border-slate-700" : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
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
                {["工號", "姓名", "部門", "區域", "協助員類型", "到職日", "小計經驗天數", "狀態", "操作"].map(h => (
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
                <tr key={w.userId} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", idx % 2 === 0 ? "" : "bg-muted/10")}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.userId}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.department}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.area}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">{w.workerType}</span>
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
                      <button
                        title="設定密碼"
                        onClick={() => setPwdWorker(w)}
                        className="p-1.5 rounded-lg hover:bg-purple-50 text-muted-foreground hover:text-purple-700 transition-colors"
                      >
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
          <span>顯示 {filtered.length} / {MOCK_WORKERS.length} 筆</span>
          <span>資料來源：Google Sheets「人員資料」分頁</span>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {(showAddModal || editWorker) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {editWorker ? `編輯人員 — ${editWorker.name}` : "新增人員"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "姓名", placeholder: editWorker?.name || "" },
                { label: "Email", placeholder: editWorker?.email || "" },
                { label: "部門", placeholder: editWorker?.department || "" },
                { label: "服務區域", placeholder: editWorker?.area || "" },
                { label: "到職日期", placeholder: editWorker?.onboardDate || "" },
                { label: "小計經驗天數", placeholder: String(editWorker?.pastExpDays || 0) },
              ].map(({ label, placeholder }) => (
                <div key={label}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">{label}</label>
                  <Input defaultValue={placeholder} className="h-9 text-sm" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => { setShowAddModal(false); setEditWorker(null); }}>取消</Button>
              <Button className="flex-1 bg-blue-700 hover:bg-blue-800" onClick={() => {
                toast.success(editWorker ? "人員資料已更新" : "人員已新增");
                setShowAddModal(false); setEditWorker(null);
              }}>
                {editWorker ? "儲存變更" : "新增"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Set Password Modal */}
      {pwdWorker && (
        <SetPasswordModal worker={pwdWorker} onClose={() => setPwdWorker(null)} />
      )}
    </div>
  );
}
