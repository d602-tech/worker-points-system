import { useState } from "react";
import { Download, Printer, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportServiceFeeReport, toChineseAmount } from "@/lib/exportExcel";

const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04"];

// Point unit price: 1 point = 0.01 NTD (example)
const POINT_RATE = 0.01;

const MOCK_DATA = [
  { id: "W001", name: "王小明", type: "一般工地協助員", area: "大潭",
    monthly: { "2026-01": 45200, "2026-02": 38600, "2026-03": 52100, "2026-04": 21000 } },
  { id: "W002", name: "李大華", type: "離島工地協助員", area: "林口",
    monthly: { "2026-01": 38000, "2026-02": 41200, "2026-03": 39800, "2026-04": 18500 } },
  { id: "W003", name: "陳美玲", type: "一般工地協助員", area: "大潭",
    monthly: { "2026-01": 51000, "2026-02": 47300, "2026-03": 55600, "2026-04": 24200 } },
  { id: "W004", name: "張志偉", type: "職安業務兼管理員", area: "總部",
    monthly: { "2026-01": 22000, "2026-02": 19500, "2026-03": 23400, "2026-04": 9800 } },
];

export default function ReportFee() {
  const [selectedMonth, setSelectedMonth] = useState("2026-04");

  const monthData = MOCK_DATA.map(w => {
    const pts = w.monthly[selectedMonth as keyof typeof w.monthly] || 0;
    const fee = Math.round(pts * POINT_RATE);
    const totalPts = Object.values(w.monthly).reduce((a, b) => a + b, 0);
    const totalFee = Math.round(totalPts * POINT_RATE);
    return { ...w, pts, fee, totalPts, totalFee };
  });

  const grandPts = monthData.reduce((s, w) => s + w.pts, 0);
  const grandFee = monthData.reduce((s, w) => s + w.fee, 0);

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-foreground">服務費統計表</h1>
          <p className="text-sm text-muted-foreground mt-0.5">點數轉換服務費統計（單價：{POINT_RATE} 元/點）</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" />列印
          </Button>
          <Button size="sm" className="bg-blue-700 hover:bg-blue-800 gap-1.5" onClick={() => exportServiceFeeReport(
            monthData.map(w => ({ workerId: w.id, workerName: w.name, workerType: w.type, area: w.area, totalPoints: w.pts, pointRate: POINT_RATE, serviceFee: w.fee })),
            selectedMonth
          )}>
            <Download className="w-4 h-4" />匯出 xlsx
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
        {[
          { label: "本月總點數", value: grandPts.toLocaleString(), unit: "pt", color: "text-blue-700 bg-blue-50" },
          { label: "本月服務費", value: grandFee.toLocaleString(), unit: "元", color: "text-emerald-700 bg-emerald-50" },
          { label: "協助員人數", value: MOCK_DATA.length.toString(), unit: "人", color: "text-purple-700 bg-purple-50" },
          { label: "平均點數", value: Math.round(grandPts / MOCK_DATA.length).toLocaleString(), unit: "pt", color: "text-amber-700 bg-amber-50" },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className={cn("rounded-2xl p-4", color)}>
            <div className="text-2xl font-bold">{value} <span className="text-sm font-normal">{unit}</span></div>
            <div className="text-xs mt-1 opacity-80">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 print:hidden">
        {MONTHS.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
              selectedMonth === m ? "bg-blue-700 text-white border-blue-700" : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
            {m}
          </button>
        ))}
      </div>

      <div className="hidden print:block text-center mb-4">
        <h2 className="text-lg font-bold">115年度協助員點數管理系統</h2>
        <h3 className="text-base">服務費統計表 — {selectedMonth}</h3>
      </div>

      <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden print:shadow-none print:border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {["工號", "姓名", "協助員類型", "區域", "本月點數", "本月服務費(元)", "年度總點數", "年度服務費(元)"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
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
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">{w.pts.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{w.fee.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-foreground">{w.totalPts.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground">{w.totalFee.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-muted/20">
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-foreground">合計</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-blue-700">{grandPts.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-emerald-700">{grandFee.toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-foreground">
                  {MOCK_DATA.reduce((s, w) => s + Object.values(w.monthly).reduce((a, b) => a + b, 0), 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-sm font-bold text-foreground">
                  {Math.round(MOCK_DATA.reduce((s, w) => s + Object.values(w.monthly).reduce((a, b) => a + b, 0), 0) * POINT_RATE).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border/30 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground print:hidden">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>資料來源：Google Sheets「服務費統計表」分頁 | 點數單價：{POINT_RATE} 元/點</span>
          </div>
          <div className="text-xs font-medium text-foreground">
            本月服務費合計：<span className="font-bold text-emerald-700">{toChineseAmount(grandFee)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
