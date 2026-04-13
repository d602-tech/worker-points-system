import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Eye, ChevronDown, ChevronUp, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// 審核狀態（與 Code.gs actionToStatus 對應）
type ReviewStatus = "submitted" | "dept_approved" | "billing_confirmed" | "billed" | "rejected";

// 審核動作（與 Code.gs reviewItem action2 對應）
type ReviewAction = "初審通過" | "退回修改" | "廠商確認" | "廠商退回" | "已請款";

interface ReviewItem {
  id: string; workerId: string; workerName: string;
  yearMonth: string; category: string; taskName: string;
  points: number; status: ReviewStatus;
  files: number; note: string; rejectionReason?: string;
}

const MOCK_ITEMS: ReviewItem[] = [
  { id: "R001", workerId: "W001", workerName: "王小明", yearMonth: "2026-04", category: "A1", taskName: "危害告知與高風險作業管制與監督", points: 1200, status: "submitted", files: 2, note: "已完成全區確認" },
  { id: "R002", workerId: "W002", workerName: "李大華", yearMonth: "2026-04", category: "B1", taskName: "安全衛生教育訓練出席", points: 3000, status: "dept_approved", files: 3, note: "已參加全日訓練" },
  { id: "R003", workerId: "W003", workerName: "陳美玲", yearMonth: "2026-04", category: "A1", taskName: "材料進場驗收協助作業", points: 1500, status: "rejected", files: 0, note: "無佐證", rejectionReason: "缺少進場單佐證，請補傳相關文件" },
  { id: "R004", workerId: "W001", workerName: "王小明", yearMonth: "2026-03", category: "D1", taskName: "法規鑑別與守規性之評估作業程序書作業", points: 2500, status: "billing_confirmed", files: 1, note: "" },
];

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
  const [items, setItems] = useState<ReviewItem[]>(MOCK_ITEMS);
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "all">("submitted");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; action: "退回修改" | "廠商退回"; reason: string } | null>(null);

  const filtered = filterStatus === "all" ? items : items.filter(i => i.status === filterStatus);
  const pendingCount = items.filter(i => i.status === "submitted" || i.status === "dept_approved").length;

  const applyAction = (id: string, action: ReviewAction, reason?: string) => {
    const nextStatus: ReviewStatus =
      action === "初審通過" ? "dept_approved" :
      action === "廠商確認" ? "billing_confirmed" :
      action === "已請款"   ? "billed" :
      "rejected";

    setItems(prev => prev.map(i =>
      i.id === id ? { ...i, status: nextStatus, rejectionReason: reason || i.rejectionReason } : i
    ));

    if (action === "退回修改" || action === "廠商退回") {
      toast.error(`已退回（${action}）`);
    } else {
      toast.success(`操作成功：${action}`);
    }
    setRejectDialog(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">審核中心</h1>
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
                      <span className="font-semibold text-blue-700">{item.points.toLocaleString()} pt</span>
                      {item.files > 0 && <span>佐證 {item.files} 份</span>}
                    </div>
                    {item.status === "rejected" && item.rejectionReason && (
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{item.rejectionReason}
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
                            onClick={() => setRejectDialog({ id: item.id, action: action as "退回修改" | "廠商退回", reason: "" })}>
                            <XCircle className="w-3.5 h-3.5" />{acfg.label}
                          </Button>
                        );
                      }
                      return (
                        <Button key={action} size="sm"
                          className={cn("h-8 px-3 text-xs gap-1", acfg.color)}
                          onClick={() => applyAction(item.id, action)}>
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
                onClick={() => applyAction(rejectDialog.id, rejectDialog.action, rejectDialog.reason)}
                disabled={!rejectDialog.reason.trim()}>
                確認退回
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
