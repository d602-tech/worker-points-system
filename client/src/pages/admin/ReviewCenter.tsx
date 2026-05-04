import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Eye, ChevronDown, ChevronUp, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet, gasPost } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";

// 審核狀態（與 Code.gs actionToStatus 對應）
type ReviewStatus = "submitted" | "dept_approved" | "billing_confirmed" | "billed" | "rejected";

// 審核動作（與 Code.gs reviewItem action2 對應）
type ReviewAction = "初審通過" | "退回修改" | "廠商確認" | "廠商退回" | "已請款";

interface ReviewItem {
  id: string; workerId: string; workerName: string;
  yearMonth: string; category: string; taskName: string;
  points: number; status: ReviewStatus;
  files: number; note: string; rejectionReason?: string;
  perfLevel?: string;
}

// 將 GAS 原始資料對應到 ReviewItem 介面
function mapRowToReviewItem(row: any): ReviewItem {
  return {
    id: String(row["紀錄編號"] || row["點數代碼"] || row["itemId"] || ""),
    workerId: String(row["人員編號"] || row["userId"] || ""),
    workerName: String(row["姓名"] || ""),
    yearMonth: String(row["年月"] || row["yearMonth"] || ""),
    category: String(row["類別"] || ""),
    taskName: String(row["工作項目名稱"] || row["itemName"] || ""),
    points: Number(row["點數"] || 0),
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

// 根據當前狀態，決定可執行的動作
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
};

const FILTER_OPTIONS: Array<{ value: ReviewStatus | "all"; label: string }> = [
  { value: "all",              label: "全部" },
  { value: "submitted",        label: "待初審" },
  { value: "dept_approved",    label: "初審通過" },
  { value: "billing_confirmed",label: "廠商確認" },
  { value: "billed",           label: "已請款" },
  { value: "rejected",         label: "已退回" },
];

export default function ReviewCenter() {
  const { user } = useGasAuthContext();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "all">("submitted");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; workerId: string; yearMonth: string; action: "退回修改" | "廠商退回"; reason: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [perfAssess, setPerfAssess] = useState<Record<string, { level: string; points: number }>>({});

  // 1. 載入內容
  const loadItems = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const res = await gasGet<any[]>("getReviewList", {
        callerEmail: user.email,
        yearMonth: format(new Date(), "yyyy-MM"), // 預設看當月
      });
      if (res.success && Array.isArray(res.data)) {
        setItems(res.data.map(mapRowToReviewItem));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.email]);

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
    setIsLoading(false);
  };

  return (
    <div className="space-y-6 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {user?.role === "deptMgr" ? "績效評核" : "審核中心"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">待處理 {pendingCount} 項</p>
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button key={value} onClick={() => setFilterStatus(value)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                filterStatus === value
                  ? "bg-blue-700 text-white border-blue-700"
                  : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
              {label}
              {value === "submitted" && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 審核流程說明 */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
        {["草稿", "已提交", "初審通過", "廠商確認", "已請款"].map((s, i, arr) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className={cn("px-2 py-0.5 rounded-full border",
              s === "已提交" ? "bg-amber-50 text-amber-700 border-amber-200" :
              s === "初審通過" ? "bg-blue-50 text-blue-700 border-blue-200" :
              s === "廠商確認" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
              s === "已請款" ? "bg-slate-100 text-slate-600 border-slate-200" :
              "bg-muted/40 border-border/30"
            )}>{s}</span>
            {i < arr.length - 1 && <ChevronsRight className="w-3 h-3 opacity-40" />}
          </span>
        ))}
        <span className="ml-2 opacity-60">（任一階段可退回修改）</span>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-elegant border border-border/50 p-12 text-center text-muted-foreground">
            目前沒有{filterStatus === "all" ? "" : STATUS_CONFIG[filterStatus as ReviewStatus].label}的項目
          </div>
        ) : filtered.map(item => {
          const isExpanded = expandedId === item.id;
          const cfg = STATUS_CONFIG[item.status];
          const StatusIcon = cfg.icon;
          const actions = getAvailableActions(item.status);
          return (
            <div key={item.id} className={cn(
              "bg-white rounded-2xl shadow-elegant border overflow-hidden transition-all",
              item.status === "rejected" ? "border-red-200" : "border-border/50"
            )}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{item.id}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50">{item.category}</span>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", cfg.color)}>
                        <StatusIcon className="w-3 h-3" />{cfg.label}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-foreground truncate">{item.taskName}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>{item.workerName}</span>
                      <span>{item.yearMonth}</span>
                      {user?.role !== "deptMgr" && (
                        <span className="font-semibold text-blue-700">{item.points.toLocaleString()} pt</span>
                      )}
                      {item.files > 0 && <span>佐證 {item.files} 份</span>}
                    </div>
                    {item.status === "rejected" && item.rejectionReason && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{item.rejectionReason}
                      </div>
                    )}
                    {/* C類績效核定介面 */}
                    {item.category === "C" && item.status === "submitted" && (
                      <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center gap-3">
                        <span className="text-xs font-bold text-blue-700">績效核定：</span>
                        <div className="flex gap-1.5">
                          {[
                            { l: "優", p: 5000 },
                            { l: "佳", p: 3000 },
                            { l: "平", p: 2000 }
                          ].map(v => {
                            const active = perfAssess[item.id]?.level === v.l || (!perfAssess[item.id] && item.perfLevel === v.l);
                            return (
                              <button key={v.l}
                                onClick={() => setPerfAssess(prev => ({ ...prev, [item.id]: { level: v.l, points: v.p } }))}
                                className={cn("px-3 py-1 rounded-lg text-xs font-medium transition-all border",
                                  active ? "bg-blue-600 text-white border-blue-600 shadow-sm" : "bg-white text-muted-foreground border-border hover:border-blue-200")}>
                                {v.l} ({v.p})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {item.category === "C" && item.status !== "submitted" && item.perfLevel && (
                      <div className="mt-2 text-xs font-medium text-blue-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> 已核定：{item.perfLevel}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {actions.map(action => {
                      const acfg = ACTION_CONFIG[action];
                      if (acfg.variant === "reject") {
                        return (
                          <Button key={action} size="sm" variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 text-xs gap-1"
                            onClick={() => setRejectDialog({ 
                              id: item.id, 
                              workerId: item.workerId, 
                              yearMonth: item.yearMonth,
                              action: action as "退回修改" | "廠商退回", 
                              reason: "" 
                            })}>
                            <XCircle className="w-3.5 h-3.5" />{acfg.label}
                          </Button>
                        );
                      }
                      return (
                        <Button key={action} size="sm"
                          className={cn("h-8 px-3 text-xs gap-1", acfg.color)}
                          onClick={() => applyAction(item.id, action, item.workerId, item.yearMonth)}>
                          <CheckCircle2 className="w-3.5 h-3.5" />{acfg.label}
                        </Button>
                      );
                    })}
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                    <div className="text-xs text-muted-foreground"><span className="font-medium">備註：</span>{item.note || "無"}</div>
                    <div className="text-xs text-muted-foreground"><span className="font-medium">人員編號：</span>{item.workerId}</div>
                    {item.files > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {Array.from({ length: item.files }).map((_, i) => (
                          <button key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 transition-colors">
                            <Eye className="w-3 h-3" />佐證 {i + 1}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 退回 Dialog */}
      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground mb-1">{rejectDialog.action}</h3>
            <p className="text-sm text-muted-foreground mb-3">請輸入退回原因（協助員可看到）</p>
            <textarea
              rows={3} placeholder="請說明退回原因..."
              value={rejectDialog.reason}
              onChange={e => setRejectDialog(prev => prev ? { ...prev, reason: e.target.value } : null)}
              className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setRejectDialog(null)}>取消</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={() => applyAction(rejectDialog.id, rejectDialog.action, rejectDialog.workerId, rejectDialog.yearMonth, rejectDialog.reason)}
                disabled={!rejectDialog.reason.trim() || isLoading}>
                確認退回
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
