import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportWorkSummaryReport } from "@/lib/exportExcel";

const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04"];

const MOCK_DATA = [
  { id: "W001", name: "王小明", type: "一般工地協助員", area: "大潭",
    monthly: { "2026-01": 45200, "2026-02": 38600, "2026-03": 52100, "2026-04": 21000 } },
  { id: "W002", name: "李大華", type: "離島工地協助員", area: "林口",
    monthly: { "2026-01": 38000, "2026-02": 41200, "2026-03": 39800, "2026-04": 18500 } },
  { id: "W003", name: "陳美玲", type: "一般工地協助員", area: "大潭",
    monthly: { "2026-01": 51000, "2026-02": 47300, "2026-03": 55600, "2026-04": 24200 } },
  { id: "W004", name: "張志偉", type: "環保業務人員", area: "總部",
    monthly: { "2026-01": 22000, "2026-02": 19500, "2026-03": 23400, "2026-04": 9800 } },
];

export default function ReportSummary() {
  const [selectedMonth, setSelectedMonth] = useState("2026-04");

  const handleExport = () => {
    exportWorkSummaryReport(
      monthData.map(w => ({
        workerId: w.id, workerName: w.name, workerType: w.type, area: w.area,
        catA: Math.round(w.points * 0.3), catB: Math.round(w.points * 0.2),
        catC: Math.round(w.points * 0.2), catD: Math.round(w.points * 0.1),
        catS: Math.round(w.points * 0.1), catP: Math.round(w.points * 0.1),
        total: w.points,
      })),
      selectedMonth
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const monthData = MOCK_DATA.map(w => ({
    ...w,
    points: w.monthly[selectedMonth as keyof typeof w.monthly] || 0,
    total: Object.values(w.monthly).reduce((a, b) => a + b, 0),
  }));

  const grandTotal = monthData.reduce((sum, w) => sum + w.points, 0);

  return (
    <div className="space-y-6 print:space-y-4">
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
        {MONTHS.map(m => (
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {["工號", "姓名", "協助員類型", "區域", ...MONTHS, "合計"].map(h => (
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
                  {MONTHS.map(m => (
                    <td key={m} className={cn(
                      "px-4 py-3 text-right font-medium",
                      m === selectedMonth ? "bg-blue-50 text-blue-700 font-semibold" : "text-foreground"
                    )}>
                      {(w.monthly[m as keyof typeof w.monthly] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right font-bold text-foreground">{w.total.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-foreground">合計</td>
                {MONTHS.map(m => (
                  <td key={m} className={cn(
                    "px-4 py-3 text-right text-sm",
                    m === selectedMonth ? "bg-blue-100 text-blue-800 font-bold" : "text-foreground"
                  )}>
                    {MOCK_DATA.reduce((sum, w) => sum + (w.monthly[m as keyof typeof w.monthly] || 0), 0).toLocaleString()}
                  </td>
                ))}
                <td className="px-4 py-3 text-right text-sm font-bold text-foreground">
                  {MOCK_DATA.reduce((sum, w) => sum + Object.values(w.monthly).reduce((a, b) => a + b, 0), 0).toLocaleString()}
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
