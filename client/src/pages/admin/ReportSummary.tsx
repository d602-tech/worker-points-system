import { useState, useEffect, useCallback } from "react";
import { Download, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportWorkSummaryReport } from "@/lib/exportExcel";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format, startOfYear, eachMonthOfInterval } from "date-fns";

interface WorkerRow {
  id: string;
  name: string;
  type: string;
  area: string;
  monthly: Record<string, number>;
}

// 動態產生年度月份
const CURRENT_YEAR_MONTHS = eachMonthOfInterval({
  start: startOfYear(new Date()),
  end: new Date()
}).map(d => format(d, "yyyy-MM"));

export default function ReportSummary() {
  const { user } = useGasAuthContext();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [reportData, setReportData] = useState<WorkerRow[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const res = await gasGet<any>("getReport", {
        callerEmail: user.email,
        type: "3",
        yearMonth: selectedMonth
      });
      if (res.success && res.data) {
        const { workers, snapshots: ss } = res.data;
        setSnapshots(ss || []);
        
        // 僅篩選協助員 (worker)
        const filteredWorkers = (workers || []).filter((w: any) => String(w["角色"]) === "worker");

        const mapped = filteredWorkers.map((w: any) => {
          const wId = String(w["人員編號"] || "");
          const monthly: Record<string, number> = {};
          // 如果有跨月份的快照資料，可以在此處展開
          const snap = (ss || []).find((s: any) => s["人員編號"] === wId && s["年月"] === selectedMonth);
          monthly[selectedMonth] = Number(snap?.["本月總計"] || 0);

          return {
            id: wId,
            name: String(w["姓名"] || ""),
            type: String(w["職務類型"] || ""),
            area: String(w["服務區域"] || ""),
            monthly
          };
        });
        setReportData(mapped);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = () => {
    exportWorkSummaryReport(
      monthData.map(w => {
        const snap = snapshots.find(s => s["人員編號"] === w.id && s["年月"] === selectedMonth);
        return {
          workerId: w.id, workerName: w.name, workerType: w.type, area: w.area,
          catA: Number(snap?.["A類小計"] || 0),
          catB: Number(snap?.["B類小計"] || 0),
          catC: Number(snap?.["C類金額"] || 0),
          catD: Number(snap?.["D類小計"] || 0),
          catS: Number(snap?.["S類金額"] || 0),
          catP: Number(snap?.["P類扣款"] || 0),
          total: w.points,
        };
      }),
      selectedMonth
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const monthData = reportData.map(w => ({
    ...w,
    points: w.monthly[selectedMonth] || 0,
    total: Object.values(w.monthly).reduce((a, b) => a + b, 0),
  }));

  const grandTotal = monthData.reduce((sum, w) => sum + w.points, 0);

  return (
    <div className="space-y-6 print:space-y-4 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-foreground">工作量彙總表</h1>
          <p className="text-sm text-muted-foreground mt-0.5">協助員每月點數工作量彙總</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="w-4 h-4" />列印
          </Button>
          <Button size="sm" className="bg-blue-700 hover:bg-blue-800 gap-1.5" onClick={handleExport}>
            <Download className="w-4 h-4" />匯出 xlsx
          </Button>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex gap-2 print:hidden">
        {CURRENT_YEAR_MONTHS.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
              selectedMonth === m ? "bg-blue-700 text-white border-blue-700" : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
            {m}
          </button>
        ))}
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h2 className="text-lg font-bold">115年度協助員點數管理系統</h2>
        <h3 className="text-base">工作量彙總表 — {selectedMonth}</h3>
      </div>

      {/* Summary table */}
      <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden print:shadow-none print:border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm report-table">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {["工號", "姓名", "協助員類型", "區域", ...CURRENT_YEAR_MONTHS, "合計"].map(h => (
                  <th key={h} className={cn(
                    "text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap",
                    h === selectedMonth && "bg-blue-50 text-blue-700"
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthData.map((w, idx) => (
                <tr key={w.id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", idx % 2 === 0 ? "" : "bg-muted/10")}>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.id}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{w.area}</td>
                  {CURRENT_YEAR_MONTHS.map(m => (
                    <td key={m} className={cn(
                      "px-4 py-3 text-right font-medium",
                      m === selectedMonth ? "bg-blue-50 text-blue-700 font-semibold" : "text-foreground"
                    )}>
                      {(w.monthly[m] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-foreground">{w.total.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-foreground">合計</td>
                {CURRENT_YEAR_MONTHS.map(m => (
                  <td key={m} className={cn(
                    "px-4 py-3 text-right text-sm",
                    m === selectedMonth ? "bg-blue-100 text-blue-800 font-bold" : "text-foreground"
                  )}>
                    {reportData.reduce((sum, w) => sum + (w.monthly[m] || 0), 0).toLocaleString()}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-sm font-bold text-foreground">
                  {reportData.reduce((sum, w) => sum + Object.values(w.monthly).reduce((a, b) => a + b, 0), 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between text-xs text-muted-foreground print:hidden">
          <span>{selectedMonth} 共計：{grandTotal.toLocaleString()} 元</span>
          <span>資料來源：Google Sheets「月度點數明細」分頁</span>
        </div>
      </div>
    </div>
  );
}
