import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Plus, Minus, TrendingUp, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, addMonths, subMonths } from "date-fns";
import { zhTW } from "date-fns/locale";
import { POINTS_CONFIG_SEED } from "../../../../shared/domain";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasPost, gasGet } from "@/lib/gasApi";

function getMonthlyItems(workerType: string) {
  return POINTS_CONFIG_SEED.filter(
    item => item.workerType === workerType && (item.category === "B1" || item.category === "B2" || item.category === "C")
  );
}

interface MonthlyItem {
  itemId: string; name: string; category: string;
  pointsPerUnit: number; unit: string; quantity: number;
  perfLevel: "" | "優" | "佳" | "平";
  status?: string;
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [items, setItems] = useState<MonthlyItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 滑動切換月份邏輯
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 70) {
      if (deltaX > 0) setCurrentMonth(m => subMonths(m, 1)); // 右滑：上個月
      else setCurrentMonth(m => addMonths(m, 1)); // 左滑：下個月
    }
    touchStartX.current = null;
  };

  // 載入月報資料
  useEffect(() => {
    if (!user?.id) return;
    setIsLoading(true);
    const monthStr = format(currentMonth, "yyyy-MM");
    
    const initialItems = monthlyItemDefs.map(def => ({
      itemId: def.itemId, name: def.name, category: def.category,
      pointsPerUnit: def.pointsPerUnit, unit: def.unit, quantity: 0, perfLevel: "" as const,
    }));

    gasGet("getDailyPoints", { workerId: user.id, date: monthStr })
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          const dbItems = res.data as Record<string, any>[];
          setItems(initialItems.map(item => {
            const found = dbItems.find(r => r["項目編號"] === item.itemId || r["點數代碼"] === item.itemId);
            if (found) {
              const qty = Number(found["數量"] || 1);
              const note = String(found["備註"] || "");
              let perf: any = "";
              if (item.category === "C") {
                if (note.includes("優")) perf = "優";
                else if (note.includes("佳")) perf = "佳";
                else if (note.includes("平")) perf = "平";
              }
              return { ...item, quantity: qty, perfLevel: perf, status: "submitted" };
            }
            return item;
          }));
        } else {
          setItems(initialItems);
        }
      })
      .finally(() => setIsLoading(false));
  }, [user?.id, currentMonth, monthlyItemDefs]);

  const totalPoints = items.reduce((sum, item) => {
    if (item.category === "C" && item.perfLevel) {
      const lvl = PERF_LEVELS.find(l => l.value === item.perfLevel);
      return sum + (lvl?.points || 0);
    }
    return sum + (item.pointsPerUnit || 0) * (item.quantity || 0);
  }, 0);

  const setQuantity = (itemId: string, qty: number) => {
    setItems(prev => prev.map(i => (i.itemId === itemId && !i.status) ? { ...i, quantity: Math.max(0, qty) } : i));
  };

  const setPerfLevel = (itemId: string, level: "" | "優" | "佳" | "平") => {
    setItems(prev => prev.map(i => (i.itemId === itemId && !i.status) ? { ...i, perfLevel: level, quantity: level ? 1 : 0 } : i));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const yearMonth = format(currentMonth, "yyyy-MM");
      const toSubmit = items.filter(i => !i.status && (i.quantity > 0 || i.perfLevel));
      
      for (const item of toSubmit) {
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
      toast.success("月報資料已送出！");
      setItems(prev => prev.map(i => (i.quantity > 0 || i.perfLevel) ? { ...i, status: "submitted" } : i));
    } catch { toast.error("送出失敗，請稍後重試"); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="flex flex-col min-h-full bg-background select-none" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-border shadow-elegant">
        <div className="flex items-center justify-between px-4 py-4">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all">
            <ChevronLeft className="w-6 h-6 text-muted-foreground" />
          </button>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{format(currentMonth, "yyyy年M月", { locale: zhTW })}</div>
            <div className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">MONTHLY REPORT</div>
          </div>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-muted active:scale-90 transition-all">
            <ChevronRight className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>
        <div className="px-4 pb-4">
          <div className="bg-slate-900 rounded-[28px] px-6 py-5 flex items-center justify-between shadow-elegant-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest leading-none mb-1">本月預計累計</span>
              <span className="text-3xl font-black text-white">{totalPoints.toLocaleString()}<span className="text-sm font-bold ml-1 text-slate-400">pt</span></span>
            </div>
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
              <TrendingUp className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-4 space-y-4 pb-32">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
             <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
             <div className="text-sm text-muted-foreground font-medium">讀取月報資料中...</div>
          </div>
        ) : items.map(item => {
          const isC = item.category === "C";
          const isSubmitted = !!item.status;
          return (
            <div key={item.itemId} className={cn(
              "bg-white rounded-[32px] shadow-elegant border transition-all duration-300",
              isSubmitted ? "border-emerald-100 bg-emerald-50/5 opacity-90" : "border-border/60 hover:border-blue-200"
            )}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-md text-white leading-none", 
                        item.category === "B1" ? "bg-orange-500" : item.category === "B2" ? "bg-purple-500" : "bg-blue-600")}>
                        {item.category}
                      </span>
                      {isSubmitted && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-md">已送出</span>}
                    </div>
                    <h4 className="text-[15px] font-bold text-foreground leading-snug">{item.name}</h4>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-slate-400">{item.pointsPerUnit.toLocaleString()} pt</div>
                    <div className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">PER {item.unit}</div>
                  </div>
                </div>
                
                {isC ? (
                  <div className="space-y-3">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">本月績效評估</div>
                    <div className="flex gap-2.5">
                      {PERF_LEVELS.map(({ value, label, points, color }) => (
                        <button key={value} disabled={isSubmitted}
                          onClick={() => setPerfLevel(item.itemId, item.perfLevel === value ? "" : value)}
                          className={cn("flex-1 py-3.5 rounded-[20px] border-2 transition-all flex flex-col items-center justify-center gap-0.5 active:scale-95",
                            item.perfLevel === value ? color : "border-slate-50 bg-slate-50 text-slate-400 opacity-60")}>
                          <span className="text-base font-black">{label}</span>
                          <span className="text-[10px] font-bold opacity-80">{points.toLocaleString()}pt</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">填報數量</span>
                      <span className="text-xs font-bold text-slate-600">{item.unit}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <button disabled={isSubmitted} onClick={() => setQuantity(item.itemId, item.quantity - 1)} 
                        className="w-12 h-12 rounded-2xl bg-white shadow-sm border border-border flex items-center justify-center hover:bg-slate-50 active:scale-90 transition-all disabled:opacity-30">
                        <Minus className="w-5 h-5 text-slate-600" />
                      </button>
                      <span className="w-10 text-center text-xl font-black text-slate-900">{item.quantity}</span>
                      <button disabled={isSubmitted} onClick={() => setQuantity(item.itemId, item.quantity + 1)} 
                        className="w-12 h-12 rounded-2xl bg-slate-900 shadow-md flex items-center justify-center hover:bg-black active:scale-90 transition-all disabled:opacity-30">
                        <Plus className="w-5 h-5 text-white" />
                      </button>
                    </div>
                  </div>
                )}
                
                {(item.quantity > 0 || item.perfLevel) && (
                  <div className="mt-4 pt-3 border-t border-dashed border-border/60 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">小計點數</span>
                    <span className="text-sm font-black text-blue-700">
                      +{ (isC ? (PERF_LEVELS.find(l => l.value === item.perfLevel)?.points || 0) : (item.pointsPerUnit * item.quantity)).toLocaleString() } pt
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-[60px] left-1/2 -translate-x-1/2 w-full max-w-[430px] px-4 py-4 bg-white/95 backdrop-blur-md border-t border-border z-[45] pb-safe">
        <Button 
          disabled={isSubmitting || totalPoints === 0 || items.every(i => i.status === "submitted")} 
          onClick={handleSubmit}
          className={cn("w-full h-14 rounded-3xl text-base font-black shadow-elegant-lg transition-all transform active:scale-95 gap-3",
            totalPoints > 0 ? "bg-slate-900 hover:bg-black text-white" : "bg-slate-100 text-slate-400 cursor-not-allowed")}>
          {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-5 h-5" />送出月報累記 ({totalPoints.toLocaleString()} pt)</>}
        </Button>
      </div>
      
      {/* Missing Month/Empty Info */}
      {!isLoading && items.length === 0 && (
         <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 rounded-[40px] flex items-center justify-center text-slate-200">
               <AlertCircle className="w-10 h-10" />
            </div>
            <div className="space-y-1">
               <h3 className="font-bold text-slate-900">目前尚無可填報項目</h3>
               <p className="text-xs text-slate-400 leading-relaxed">此月份或您的身份類型目前沒有對應的月度工作項目。</p>
            </div>
         </div>
      )}
    </div>
  );
}
