import { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type ReviewStatus = "pending" | "approved" | "rejected";

interface ReviewItem {
  id: string; workerId: string; workerName: string;
  date: string; category: string; taskName: string;
  points: number; status: ReviewStatus;
  files: number; note: string; rejectionReason?: string;
}

const MOCK_ITEMS: ReviewItem[] = [
  { id: "R001", workerId: "W001", workerName: "王小明", date: "2026-04-08", category: "A1", taskName: "工地清潔與整理", points: 1200, status: "pending", files: 2, note: "已完成全區清潔" },
  { id: "R002", workerId: "W001", workerName: "王小明", date: "2026-04-08", category: "A1", taskName: "工具整理與歸還", points: 800, status: "pending", files: 1, note: "" },
  { id: "R003", workerId: "W002", workerName: "李大華", date: "2026-04-07", category: "B1", taskName: "安全訓練參與", points: 3000, status: "approved", files: 3, note: "已參加全日訓練" },
  { id: "R004", workerId: "W003", workerName: "陳美玲", date: "2026-04-06", category: "A1", taskName: "材料搜選與進場驗收", points: 1500, status: "rejected", files: 0, note: "無佐證", rejectionReason: "缺少進場單佐證，請補傳相關文件" },
  { id: "R005", workerId: "W002", workerName: "李大華", date: "2026-04-09", category: "A2", taskName: "機電設備維護協助", points: 2000, status: "pending", files: 4, note: "已完成定期保養" },
];

const STATUS_CONFIG = {
  pending:  { label: "待審核", color: "bg-amber-50 text-amber-700 border-amber-200",   icon: AlertTriangle },
  approved: { label: "已通過", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "已退回", color: "bg-red-50 text-red-700 border-red-200",           icon: XCircle },
};

export default function ReviewCenter() {
  const [items, setItems] = useState<ReviewItem[]>(MOCK_ITEMS);
  const [filterStatus, setFilterStatus] = useState<ReviewStatus | "all">("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: string; reason: string } | null>(null);

  const filtered = filterStatus === "all" ? items : items.filter(i => i.status === filterStatus);
  const pendingCount = items.filter(i => i.status === "pending").length;

  const approve = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: "approved" } : i));
    toast.success("已通過審核");
  };

  const reject = (id: string, reason: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status: "rejected", rejectionReason: reason } : i));
    toast.error("已退回審核項目");
    setRejectDialog(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">審核中心</h1>
          <p className="text-sm text-muted-foreground mt-0.5">待審核 {pendingCount} 項</p>
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                filterStatus === s ? "bg-blue-700 text-white border-blue-700" : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
              {s === "all" ? "全部" : STATUS_CONFIG[s].label}
              {s === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-elegant border border-border/50 p-12 text-center text-muted-foreground">
            目前沒有{filterStatus === "all" ? "" : STATUS_CONFIG[filterStatus as ReviewStatus].label}的項目
          </div>
        ) : filtered.map(item => {
          const isExpanded = expandedId === item.id;
          const StatusIcon = STATUS_CONFIG[item.status].icon;
          return (
            <div key={item.id} className={cn(
              "bg-white rounded-2xl shadow-elegant border overflow-hidden transition-all",
              item.status === "rejected" ? "border-red-200" : "border-border/50"
            )}>
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">{item.id}</span>
                      <span className="cat-a text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200">{item.category}</span>
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_CONFIG[item.status].color)}>
                        <StatusIcon className="w-3 h-3" />{STATUS_CONFIG[item.status].label}
                      </span>
                    </div>
                    <div className="mt-1.5 text-sm font-medium text-foreground">{item.taskName}</div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.workerName}</span>
                      <span>{item.date}</span>
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
                    {item.status === "pending" && (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-8 px-3 text-xs gap-1" onClick={() => approve(item.id)}>
                          <CheckCircle2 className="w-3.5 h-3.5" />通過
                        </Button>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-8 px-3 text-xs gap-1" onClick={() => setRejectDialog({ id: item.id, reason: "" })}>
                          <XCircle className="w-3.5 h-3.5" />退回
                        </Button>
                      </>
                    )}
                    <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
                    <div className="text-xs text-muted-foreground"><span className="font-medium">備註：</span>{item.note || "無"}</div>
                    <div className="text-xs text-muted-foreground"><span className="font-medium">工號：</span>{item.workerId}</div>
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

      {rejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-foreground mb-3">退回審核</h3>
            <p className="text-sm text-muted-foreground mb-3">請輸入退回原因（協助員可看到）</p>
            <textarea
              rows={3} placeholder="請說明退回原因..."
              value={rejectDialog.reason}
              onChange={e => setRejectDialog(prev => prev ? { ...prev, reason: e.target.value } : null)}
              className="w-full text-sm border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setRejectDialog(null)}>取消</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => reject(rejectDialog.id, rejectDialog.reason)} disabled={!rejectDialog.reason.trim()}>確認退回</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
