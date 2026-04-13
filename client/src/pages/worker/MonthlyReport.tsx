import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus, Minus, TrendingUp, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import { zhTW } from "date-fns/locale";
import { POINTS_CONFIG_SEED } from "../../../../shared/domain";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasPost } from "@/lib/gasApi";

function getMonthlyItems(workerType: string) {
  return POINTS_CONFIG_SEED.filter(
    item => item.workerType === workerType && (item.category === "B1" || item.category === "B2" || item.category === "C")
  );
}

interface MonthlyItem {
  itemId: string; name: string; category: string;
  pointsPerUnit: number; unit: string; quantity: number;
  perfLevel: "" | "優" | "佳" | "平";
}

const PERF_LEVELS = [
  { value: "優" as const, label: "優", points: 5000, color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { value: "佳" as const, label: "佳", points: 3000, color: "bg-blue-100 text-blue-700 border-blue-300" },
  { value: "平" as const, label: "平", points: 2000, color: "bg-slate-100 text-slate-700 border-slate-300" },
];

export default function MonthlyReport() {
  const { user } = useGasAuthContext();
  const workerType = useMemo(() => user?.workerType || "一般工地協助員", [user?.workerType]);
  const monthlyItemDefs = useMemo(() => getMonthlyItems(workerType), [workerType]);
  const [currentMonth, setCurrentMonth] = useState(new Date(2026, 3, 1));
  const [items, setItems] = useState<MonthlyItem[]>(() =>
    getMonthlyItems("一般工地協助員").map(item => ({
      itemId: item.itemId, name: item.name, category: item.category,
      pointsPerUnit: item.pointsPerUnit, unit: item.unit, quantity: 0, perfLevel: "" as const,
    }))
  );

  // 當 workerType 變化時重置項目清單
  useMemo(() => {
    setItems(monthlyItemDefs.map(item => ({
      itemId: item.itemId, name: item.name, category: item.category,
      pointsPerUnit: item.pointsPerUnit, unit: item.unit, quantity: 0, perfLevel: "" as const,
    })));
  }, [monthlyItemDefs]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPoints = items.reduce((sum, item) => {
    if (item.category === "C" && item.perfLevel) {
      const lvl = PERF_LEVELS.find(l => l.value === item.perfLevel);
      return sum + (lvl?.points || 0);
    }
    return sum + item.pointsPerUnit * item.quantity;
  }, 0);

  const setQuantity = (itemId: string, qty: number) => {
    setItems(prev => prev.map(i => i.itemId === itemId ? { ...i, quantity: Math.max(0, qty) } : i));
  };

  const setPerfLevel = (itemId: string, level: "" | "優" | "佳" | "平") => {
    setItems(prev => prev.map(i => i.itemId === itemId ? { ...i, perfLevel: level, quantity: level ? 1 : 0 } : i));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const yearMonth = format(currentMonth, "yyyy-MM");
      // 送出每一筆有填寫的月度項目
      for (const item of items) {
        if (item.quantity > 0 || item.perfLevel) {
          await gasPost("saveDailyPoints", {
            workerId: user?.id || "",
            workerName: user?.name || "",
            date: yearMonth,
            pointCode: item.itemId,
            category: item.category,
            taskName: item.name,
            points: item.category === "C" ? (PERF_LEVELS.find(l => l.value === item.perfLevel)?.points || 0) : item.pointsPerUnit * item.quantity,
            fileCount: 0,
            note: item.perfLevel ? `績效等級：${item.perfLevel}` : "",
          });
        }
      }
      toast.success("月報已送出！", { duration: 3000 });
    } catch { toast.error("送出失敗，請稍後重試"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col min-h-full bg-background">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="text-center">
            <div className="text-base font-semibold text-foreground">{format(currentMonth, "yyyy年M月", { locale: zhTW })}</div>
            <div className="text-xs text-muted-foreground mt-0.5">月報填報</div>
          </div>
          <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700">本月累計點數</span>
            </div>
            <span className="text-xl font-bold text-blue-700">{totalPoints.toLocaleString()} pt</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-3">
        {monthlyItemDefs.map(def => {
          const item = items.find(i => i.itemId === def.itemId)!;
          const isC = def.category === "C";
          return (
            <div key={def.itemId} className="bg-white rounded-2xl shadow-elegant border border-border/60 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1">
                    <span className="inline-block cat-b text-[10px] font-bold px-1.5 py-0.5 rounded mr-1.5 border border-gray-200">{def.category}</span>
                    <span className="text-sm font-medium text-foreground">{def.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{def.pointsPerUnit.toLocaleString()} pt/{def.unit}</span>
                </div>
                {isC ? (
                  <div>
                    <div className="text-xs text-muted-foreground mb-2">選擇績效等級</div>
                    <div className="flex gap-2">
                      {PERF_LEVELS.map(({ value, label, points, color }) => (
                        <button key={value} onClick={() => setPerfLevel(def.itemId, item.perfLevel === value ? "" : value)}
                          className={cn("flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all",
                            item.perfLevel === value ? color : "border-border text-muted-foreground hover:border-muted-foreground")}>
                          <div>{label}</div>
                          <div className="text-[10px] font-normal">{points.toLocaleString()}pt</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">數量（{def.unit}）</span>
                    <div className="flex items-center gap-3">
                      <button onClick={() => setQuantity(def.itemId, item.quantity - 1)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
                        <Minus className="w-4 h-4 text-foreground" />
                      </button>
                      <span className="w-8 text-center text-base font-semibold text-foreground">{item.quantity}</span>
                      <button onClick={() => setQuantity(def.itemId, item.quantity + 1)} className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center hover:bg-blue-700 transition-colors">
                        <Plus className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                )}
                {(item.quantity > 0 || item.perfLevel) && (
                  <div className="mt-2 text-right text-xs font-medium text-blue-600">
                    +{isC ? (PERF_LEVELS.find(l => l.value === item.perfLevel)?.points || 0).toLocaleString() : (item.pointsPerUnit * item.quantity).toLocaleString()} pt
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-3 bg-white/95 backdrop-blur-md border-t border-border z-[45] pb-safe">
        <Button className="w-full h-12 text-base font-medium rounded-xl bg-blue-700 hover:bg-blue-800 shadow-elegant-md gap-2 active:scale-[0.98]"
          disabled={isSubmitting || totalPoints === 0} onClick={handleSubmit}>
          <Send className="w-4 h-4" />
          {isSubmitting ? "送出中..." : `送出月報（${totalPoints.toLocaleString()} pt）`}
        </Button>
      </div>
    </div>
  );
}
