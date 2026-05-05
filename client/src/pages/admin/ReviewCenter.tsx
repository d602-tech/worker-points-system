import { useState, useEffect, useCallback, useMemo } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Eye, ChevronDown, ChevronUp, ChevronsRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet, gasPost } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";

type ReviewStatus = "submitted" | "dept_approved" | "billing_confirmed" | "billed" | "rejected";
type ReviewAction = "初審通過" | "退回修改" | "廠商確認" | "廠商退回" | "已請款" | "admin_save";

interface ReviewItem {
  id: string; workerId: string; workerName: string;
  yearMonth: string; category: string; taskName: string;
  points: number; status: ReviewStatus;
  files: number; note: string; rejectionReason?: string;
  perfLevel?: string;
}

function mapRowToReviewItem(row: any): ReviewItem {
  return {
    id: String(row["紀錄編號"] || row["點數代碼"] || row["itemId"] || ""),
    workerId: String(row["人員編號"] || row["userId"] || ""),
    workerName: String(row["姓名"] || ""),
    yearMonth: String(row["年月"] || row["yearMonth"] || ""),
    category: String(row["類別"] || ""),
    taskName: String(row["工作項目名稱"] || row["itemName"] || ""),
    points: parseFloat(row["點數"]) || 0,
    status: String(row["狀態"] || "submitted") as ReviewStatus,
    files: String(row["佐證檔案編號"] || "").split(',').filter(Boolean).length,
    note: String(row["備註"] || ""),
    rejectionReason: String(row["退回原因"] || ""),
    perfLevel: String(row["績效等級"] || ""),
  };
}

const STATUS_CONFIG: Record<ReviewStatus, { label: string; color: string; icon: typeof AlertTriangle }> = {
  submitted:         { label: "待初審",   color: "bg-amber-50 text-amber-700 border-amber-200",     icon: AlertTriangle },
  dept_approved:     { label: "初審通過", color: "bg-blue-50 text-blue-700 border-blue-200",         icon: CheckCircle2 },
  billing_confirmed: { label: "廠商確認", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  billed:            { label: "已請款",   color: "bg-slate-100 text-slate-600 border-slate-200",     icon: CheckCircle2 },
  rejected:          { label: "已退回",   color: "bg-red-50 text-red-700 border-red-200",            icon: XCircle },
};

function getAvailableActions(status: ReviewStatus): ReviewAction[] {
  switch (status) {
    case "submitted":         return ["初審通過", "退回修改"];
    case "dept_approved":     return ["廠商確認", "廠商退回"];
    case "billing_confirmed": return ["已請款"];
    default:                  return [];
  }
}

const ACTION_CONFIG: Record<ReviewAction, { label: string; variant: "approve" | "reject" | "confirm"; color: string }> = {
  "初審通過": { label: "初審通過", variant: "approve",  color: "bg-blue-600 hover:bg-blue-700" },
  "廠商確認": { label: "廠商確認", variant: "confirm", color: "bg-emerald-600 hover:bg-emerald-700" },
  "已請款":   { label: "已請款",   variant: "confirm", color: "bg-slate-600 hover:bg-slate-700" },
  "退回修改": { label: "退回修改", variant: "reject",  color: "" },
  "廠商退回": { label: "廠商退回", variant: "reject",  color: "" },
  "admin_save": { label: "儲存設定", variant: "confirm", color: "bg-indigo-600 hover:bg-indigo-700" },
};

export default function ReviewCenter() {
  const { user } = useGasAuthContext();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "all">("submitted");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; workerId: string; yearMonth: string; action: "退回修改" | "廠商退回"; reason: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [perfAssess, setPerfAssess] = useState<Record<string, { level: string; points: number }>>({});
  const [confirmDialog, setConfirmDialog] = useState<boolean>(false);
  const [allWorkers, setAllWorkers] = useState<{ userId: string; name: string; workerType: string }[]>([]);

  const currentYearMonth = format(new Date(), "yyyy-MM");

  const loadItems = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      // 1. 載入待審核清單
      const res = await gasGet<any[]>("getReviewList", {
        callerEmail: user.email,
        yearMonth: currentYearMonth,
      });
      if (res.success && Array.isArray(res.data)) {
        setItems(res.data.map(mapRowToReviewItem));
      }

      // 2. 如果是主管，載入所有部門成員以進行填報
      if (user.role === "deptMgr") {
        const wRes = await gasGet<any[]>("getWorkers", { callerEmail: user.email });
        if (wRes.success && Array.isArray(wRes.data)) {
          setAllWorkers(wRes.data.map(w => ({
            userId: String(w["人員編號"] || ""),
            name: String(w["姓名"] || ""),
            workerType: String(w["職務類型"] || "general")
          })));
        }
      }
    } finally { setIsLoading(false); }
  }, [user?.email, user?.role, currentYearMonth]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = filterStatus === "all" ? items : items.filter(i => i.status === filterStatus);
  const pendingCount = items.filter(i => i.status === "submitted" || i.status === "dept_approved").length;

  const applyAction = async (id: string, action: ReviewAction, workerId: string, yearMonth: string, reason?: string) => {
    if (!user?.email) return;
    setIsLoading(true);
    const assessment = perfAssess[id];
    const res = await gasPost("reviewMonthlyReport", {
      callerEmail: user.email,
      workerId: workerId,
      yearMonth: yearMonth,
      action2: action,
      reason: reason || "",
      perfLevel: assessment?.level || "",
      points: assessment?.points
    });
    if (res.success) {
      toast.success(`操作成功：${action}`);
      loadItems();
    } else {
      toast.error(`操作失敗：${res.error}`);
    }
    setRejectDialog(null);
    setConfirmDialog(false);
    setIsLoading(false);
  };

  const handleBulkSubmit = async () => {
    const userIds = Object.keys(perfAssess);
    if (userIds.length === 0) return;
    setIsLoading(true);
    try {
      for (const uid of userIds) {
        const assessment = perfAssess[uid];
        const worker = allWorkers.find(w => w.userId === uid);
        if (!worker) continue;

        // 重新計算點數 (包含破月)
        const perfRules: Record<string, any> = {
          general: { "優": 10000, "佳": 8000, "平": 5000 },
          offshore: { "優": 12000, "佳": 10000, "平": 7000 },
          safety: { "優": 10000, "佳": 8000, "平": 5000 },
          environment: { "優": 8000, "佳": 6000, "平": 3000 },
        };
        const rules = perfRules[worker.workerType] || perfRules.general;
        const proration = currentYearMonth === "2026-04" ? 0.3 : (currentYearMonth === "2027-06" ? 0.7 : 1.0);
        const finalPoints = Math.round((rules[assessment.level] || 5000) * proration);

        await gasPost("reviewMonthlyReport", {
          callerEmail: user?.email,
          workerId: uid,
          yearMonth: currentYearMonth,
          action2: "admin_save",
          perfLevel: assessment.level,
          points: finalPoints
        });
      }
      toast.success("績效評核已同步至 Google Sheet");
      loadItems();
      setConfirmDialog(false);
      setPerfAssess({}); // 清空暫存
    } catch (err) {
      toast.error("儲存過程發生錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  // 分組邏輯：如果是主管，直接列出所有部門成員
  const deptMgrView = useMemo(() => {
    if (user?.role !== "deptMgr") return null;
    return allWorkers.map(w => {
      const wItems = items.filter(i => i.workerId === w.userId && i.category === "C");
      return { ...w, items: wItems };
    });
  }, [user?.role, allWorkers, items]);

  return (
    <div className="space-y-6 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {user?.role === "deptMgr" ? "績效評核 (部門管理)" : "審核中心"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.role === "deptMgr" ? `本月待評核人員：${deptMgrView?.length || 0} 位` : `待處理 ${pendingCount} 項`}
          </p>
        </div>
        
        <div className="flex gap-2">
          {user?.role === "deptMgr" && (
            <Button className="bg-blue-700 hover:bg-blue-800 gap-1.5 shadow-lg" onClick={() => setConfirmDialog(true)}>
              <Send className="w-4 h-4" /> 上傳績效評核
            </Button>
          )}
          <div className="flex gap-1.5 no-print">
            {user?.role !== "deptMgr" && ["all", "submitted", "dept_approved", "billing_confirmed", "billed", "rejected"].map(v => (
              <button key={v} onClick={() => setFilterStatus(v as any)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                  filterStatus === v ? "bg-blue-700 text-white border-blue-700" : "bg-white text-muted-foreground border-border hover:bg-muted")}>
                {v === "all" ? "全部" : STATUS_CONFIG[v as ReviewStatus].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {user?.role === "deptMgr" ? (
        /* 部門主管直接填報視圖 */
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border/30 text-muted-foreground">
                <th className="px-6 py-4 text-left font-bold">協助員姓名 / 工號</th>
                <th className="px-6 py-4 text-center font-bold">績效評核 (優/佳/平)</th>
                <th className="px-6 py-4 text-right font-bold">本月點數額度</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {deptMgrView?.map(w => {
                // 點數規則：優=10000, 佳=8000, 平=5000 (一般型)
                const perfRules: Record<string, any> = {
                  general: { "優": 10000, "佳": 8000, "平": 5000 },
                  offshore: { "優": 12000, "佳": 10000, "平": 7000 },
                  safety: { "優": 10000, "佳": 8000, "平": 5000 },
                  environment: { "優": 8000, "佳": 6000, "平": 3000 },
                };
                const rules = perfRules[w.workerType] || perfRules.general;

                // 破月比例計算
                const proration = currentYearMonth === "2026-04" ? 0.3 : (currentYearMonth === "2027-06" ? 0.7 : 1.0);
                const hasProration = proration < 1.0;

                const existingItem = w.items[0];
                const wId = w.userId;
                
                const currentData = perfAssess[wId] || { 
                  level: existingItem?.perfLevel || "平", 
                  points: 0 
                };

                const basePoints = rules[currentData.level] || 0;
                const finalPoints = Math.round(basePoints * proration);

                return (
                  <tr key={wId} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold border border-blue-100">
                          {w.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{w.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{wId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex gap-2 justify-center">
                        {["優", "佳", "平"].map(l => (
                          <button key={l} 
                            onClick={() => setPerfAssess(prev => ({ ...prev, [wId]: { ...currentData, level: l } }))}
                            className={cn(
                              "px-6 py-2.5 rounded-xl border-2 text-sm font-bold transition-all",
                              currentData.level === l 
                                ? "bg-orange-600 text-white border-orange-600 shadow-md transform scale-110" 
                                : "bg-white text-muted-foreground border-border hover:border-orange-200"
                            )}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="font-mono font-bold text-blue-700 text-2xl">
                        {finalPoints.toLocaleString()}
                      </div>
                      {hasProration && (
                        <div className="text-[10px] text-amber-600 font-bold mt-1 animate-pulse">
                          (已依破月比例 ×{proration} 折算)
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {deptMgrView?.length === 0 && (
            <div className="p-16 text-center text-muted-foreground">目前查無協助員名單</div>
          )}
        </div>
      ) : (
        /* 標準審核視圖 (billing / admin) */
        <div className="space-y-3">
          {filtered.map(item => {
            const isExpanded = expandedId === item.id;
            const cfg = STATUS_CONFIG[item.status];
            const actions = getAvailableActions(item.status);
            return (
              <div key={item.id} className={cn("bg-white rounded-2xl shadow-elegant border overflow-hidden transition-all", item.status === "rejected" ? "border-red-200" : "border-border/50")}>
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{item.id}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50">{item.category}</span>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.color)}>{cfg.label}</span>
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-foreground truncate">{item.taskName}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.workerName}</span>
                      <span>{item.yearMonth}</span>
                      {user?.role === "billing" && <span className="font-semibold text-blue-700">{item.points.toLocaleString()} pt</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {actions.map(action => (
                      <Button key={action} size="sm" className={cn("h-8 px-3 text-xs gap-1", ACTION_CONFIG[action].color)} onClick={() => applyAction(item.id, action, item.workerId, item.yearMonth)}>
                        {ACTION_CONFIG[action].label}
                      </Button>
                    ))}
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="p-1.5 rounded-lg hover:bg-muted"><ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} /></button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 text-xs text-muted-foreground border-t border-border/30 mt-2 pt-3">
                    <p>備註：{item.note || "無"}</p>
                    <p>工號：{item.workerId}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 批量儲存確認 Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 rounded-full text-indigo-600"><AlertTriangle className="w-6 h-6" /></div>
              <h3 className="text-lg font-bold text-foreground">確認儲存績效評核？</h3>
            </div>
            <div className="text-sm text-muted-foreground space-y-2 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <p>本次評核摘要：</p>
              <ul className="list-disc list-inside">
                <li>待評核總人數：{deptMgrView?.length || 0} 位</li>
                <li>本次已設定人數：{Object.keys(perfAssess).length} 位</li>
              </ul>
              <p className="text-amber-700 font-medium">※ 儲存後資料將即時同步至 Google Sheet。</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDialog(false)}>取消</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700" onClick={handleBulkSubmit}>確認並儲存</Button>
            </div>
          </div>
        </div>
      )}

      {/* 退回 Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold mb-4">退回修改原因</h3>
            <textarea className="w-full text-sm border rounded-xl px-3 py-2 mb-4" rows={3} value={rejectDialog.reason} onChange={e => setRejectDialog(p => p ? {...p, reason: e.target.value} : null)} />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setRejectDialog(null)}>取消</Button>
              <Button className="flex-1 bg-red-600" onClick={() => applyAction(rejectDialog.id, rejectDialog.action, rejectDialog.workerId, rejectDialog.yearMonth, rejectDialog.reason)}>確認退回</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
