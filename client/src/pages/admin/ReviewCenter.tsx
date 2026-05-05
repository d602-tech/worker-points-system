import { useState, useEffect, useCallback, useMemo } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Eye, ChevronDown, ChevronUp, ChevronsRight, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet, gasPost } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  
  // 績效相關狀態
  const [perfAssess, setPerfAssess] = useState<Record<string, { level: string; points: number }>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [allWorkers, setAllWorkers] = useState<{ userId: string; name: string; workerType: string }[]>([]);
  const [pointDefs, setPointDefs] = useState<any[]>([]);

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

      // 2. 如果是主管，載入所有部門成員與點數定義以進行填報
      if (user.role === "deptMgr") {
        const [wRes, pRes] = await Promise.all([
          gasGet<any[]>("getWorkers", { callerEmail: user.email }),
          gasGet<any[]>("getPointDefs")
        ]);
        if (wRes.success && Array.isArray(wRes.data)) {
          setAllWorkers(wRes.data.map(w => ({
            userId: String(w["人員編號"] || ""),
            name: String(w["姓名"] || ""),
            workerType: String(w["職務類型"] || "general")
          })));
        }
        if (pRes.success && Array.isArray(pRes.data)) {
          setPointDefs(pRes.data);
        }
      }
    } finally { setIsLoading(false); }
  }, [user?.email, user?.role, currentYearMonth]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // 解析點數定義規則 (Memoized)
  const perfRulesMap = useMemo(() => {
    const map: Record<string, any> = {
      general: { "優": 5000, "佳": 3000, "平": 2000 },
      offshore: { "優": 7200, "佳": 5200, "平": 4200 },
      safety: { "優": 5000, "佳": 3000, "平": 2000 },
      environment: { "優": 2000, "佳": 1000, "平": 500 },
    };

    if (pointDefs.length > 0) {
      const cItems = pointDefs.filter(p => p["類別"] === "C" && p["工作項目名稱"].includes("績效"));
      cItems.forEach(item => {
        const type = item["職務類型"] || "general";
        const note = item["備註"] || "";
        const parts = note.split('/');
        const levelMap: any = {};
        parts.forEach((p: string) => {
          const match = p.match(/(優|佳|平)(\d+)/);
          if (match) levelMap[match[1]] = parseInt(match[2]);
        });
        if (Object.keys(levelMap).length > 0) {
          map[type] = levelMap;
        }
      });
    }
    return map;
  }, [pointDefs]);

  const applyAction = async (id: string, action: ReviewAction, workerId: string, yearMonth: string, reason?: string) => {
    if (!user?.email) return;
    setIsLoading(true);
    const res = await gasPost("reviewMonthlyReport", {
      callerEmail: user.email,
      workerId: workerId,
      yearMonth: yearMonth,
      action2: action,
      reason: reason || ""
    });
    if (res.success) {
      toast.success(`操作成功：${action}`);
      loadItems();
    } else {
      toast.error(`操作失敗：${res.error}`);
    }
    setRejectDialog(null);
    setIsLoading(false);
  };

  const handleBulkSubmit = async () => {
    const userIds = Object.keys(perfAssess);
    if (userIds.length === 0) return;
    setIsLoading(true);
    setShowConfirm(false);
    try {
      for (const uid of userIds) {
        const assessment = perfAssess[uid];
        const worker = allWorkers.find(w => w.userId === uid);
        if (!worker) continue;

        const rules = perfRulesMap[worker.workerType] || perfRulesMap.general;
        const proration = currentYearMonth === "2026-04" ? 0.3 : (currentYearMonth === "2027-06" ? 0.7 : 1.0);
        const finalPoints = Math.round((rules[assessment.level] || 2000) * proration);

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
      setPerfAssess({});
    } catch (err) {
      toast.error("儲存過程發生錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  const deptMgrView = useMemo(() => {
    if (user?.role !== "deptMgr") return null;
    return allWorkers.map(w => {
      const wItems = items.filter(i => i.workerId === w.userId && i.category === "C");
      return { ...w, items: wItems };
    });
  }, [user?.role, allWorkers, items]);

  const filtered = filterStatus === "all" ? items : items.filter(i => i.status === filterStatus);
  const pendingCount = items.filter(i => i.status === "submitted" || i.status === "dept_approved").length;

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
            <Button className="bg-blue-700 hover:bg-blue-800 gap-1.5 shadow-lg" onClick={() => setShowConfirm(true)}>
              <Send className="w-4 h-4" /> 上傳績效評核
            </Button>
          )}
        </div>
      </div>

      {user?.role === "deptMgr" ? (
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
                const rules = perfRulesMap[w.workerType] || perfRulesMap.general;
                const proration = currentYearMonth === "2026-04" ? 0.3 : (currentYearMonth === "2027-06" ? 0.7 : 1.0);
                const hasProration = proration < 1.0;

                const existingItem = w.items[0];
                const wId = w.userId;
                const currentData = perfAssess[wId] || { 
                  level: existingItem?.perfLevel || "平"
                };

                const basePoints = rules[currentData.level] || 0;
                const finalPoints = Math.round(basePoints * proration);

                return (
                  <tr key={wId} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold border border-blue-100">
                          {w.name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{w.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono uppercase">{w.workerType} · {wId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex gap-2 justify-center">
                        {["優", "佳", "平"].map(l => (
                          <button key={l} 
                            onClick={() => setPerfAssess(prev => ({ ...prev, [wId]: { level: l, points: rules[l] } }))}
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
                      {hasProration ? (
                        <div className="text-[10px] text-amber-600 font-bold mt-1 animate-pulse">
                          (已依破月比例 ×{proration} 折算, 實得 {finalPoints.toLocaleString()} 點)
                        </div>
                      ) : (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          全月額度：{basePoints.toLocaleString()} 點
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const isExpanded = expandedId === item.id;
            const cfg = STATUS_CONFIG[item.status];
            const actions = getAvailableActions(item.status);
            return (
              <div key={item.id} className="bg-white rounded-2xl shadow-elegant border overflow-hidden border-border/50">
                <div className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-mono text-muted-foreground">{item.id}</span>
                      <span className="font-bold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50">{item.category}</span>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium border", cfg.color)}>{cfg.label}</span>
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-foreground truncate">{item.taskName}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.workerName}</span>
                      <span className="font-semibold text-blue-700">{item.points.toLocaleString()} 點</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {actions.map(action => (
                      <Button key={action} size="sm" className={cn("h-8 px-3 text-xs", ACTION_CONFIG[action].color)} onClick={() => applyAction(item.id, action, item.workerId, item.yearMonth)}>
                        {ACTION_CONFIG[action].label}
                      </Button>
                    ))}
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="p-1.5 rounded-lg hover:bg-muted"><ChevronDown className={cn("w-4 h-4 transition-transform", isExpanded && "rotate-180")} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 統一確認視窗 */}
      <ConfirmDialog
        isOpen={showConfirm}
        title="確認上傳績效評核摘要"
        variant="indigo"
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleBulkSubmit}
        description={
          <div className="overflow-x-auto border rounded-xl mt-4">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-muted-foreground border-b">
                <tr>
                  <th className="px-4 py-2">姓名</th>
                  <th className="px-4 py-2 text-center">身分</th>
                  <th className="px-4 py-2 text-center">評等</th>
                  <th className="px-4 py-2 text-right">實得點數</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(perfAssess).map(([uid, data]) => {
                  const worker = allWorkers.find(w => w.userId === uid);
                  const rules = perfRulesMap[worker?.workerType || "general"] || perfRulesMap.general;
                  const proration = currentYearMonth === "2026-04" ? 0.3 : (currentYearMonth === "2027-06" ? 0.7 : 1.0);
                  const final = Math.round((rules[data.level] || 2000) * proration);
                  return (
                    <tr key={uid}>
                      <td className="px-4 py-2 font-medium">{worker?.name}</td>
                      <td className="px-4 py-2 text-center uppercase text-[10px]">{worker?.workerType}</td>
                      <td className="px-4 py-2 text-center font-bold text-orange-600">{data.level}</td>
                      <td className="px-4 py-2 text-right font-bold text-blue-700">{final.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        }
      />

      {/* 退回原因視窗 */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold mb-4 text-foreground">退回修改原因</h3>
            <textarea className="w-full text-sm border rounded-xl px-3 py-2 mb-4 focus:ring-2 focus:ring-blue-500 outline-none" rows={3} value={rejectDialog.reason} onChange={e => setRejectDialog(p => p ? {...p, reason: e.target.value} : null)} placeholder="請輸入退回原因..." />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setRejectDialog(null)}>取消</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => applyAction(rejectDialog.id, rejectDialog.action, rejectDialog.workerId, rejectDialog.yearMonth, rejectDialog.reason)}>確認退回</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
