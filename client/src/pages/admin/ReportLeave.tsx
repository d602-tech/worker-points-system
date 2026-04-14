import { useState } from "react";
import { Download, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportLeaveStatReport } from "@/lib/exportExcel";

const MONTHS = ["2026-01", "2026-02", "2026-03", "2026-04"];
const LEAVE_TYPES = ["上班", "特休", "病假", "事假", "婚假", "喪假", "公假", "代理", "曠職"];

const MOCK_DATA = [
  { id: "W001", name: "王小明", type: "一般工地協助員",
    leave: { "上班": 18, "特休": 2, "病假": 1, "事假": 0, "婚假": 0, "喪假": 0, "公假": 0, "代理": 0, "曠職": 0 } },
  { id: "W002", name: "李大華", type: "離島工地協助員",
    leave: { "上班": 20, "特休": 0, "病假": 0, "事假": 1, "婚假": 0, "喪假": 0, "公假": 0, "代理": 0, "曠職": 0 } },
  { id: "W003", name: "陳美玲", type: "一般工地協助員",
    leave: { "上班": 19, "特休": 1, "病假": 0, "事假": 0, "婚假": 0, "喪假": 0, "公假": 1, "代理": 0, "曠職": 0 } },
  { id: "W004", name: "張志偉", type: "職安業務兼管理員",
    leave: { "上班": 15, "特休": 3, "病假": 2, "事假": 0, "婚假": 0, "喪假": 0, "公假": 0, "代理": 0, "曠職": 0 } },
];

export default function ReportLeave() {
  const [selectedMonth, setSelectedMonth] = useState("2026-04");

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-foreground">出勤暨特休統計表</h1>
          <p className="text-sm text-muted-foreground mt-0.5">協助員出勤與請假統計</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" />列印
          </Button>
          <Button size="sm" className="bg-blue-700 hover:bg-blue-800 gap-1.5" onClick={() => exportLeaveStatReport(
            MOCK_DATA.map(w => ({
              workerId: w.id, workerName: w.name, department: w.type, onboardDate: '2024-01-01',
              expDays: 365, annualLeaveEntitled: 7, annualLeaveUsed: w.leave['特休'],
              annualLeaveRemaining: 7 - w.leave['特休'], workDays: w.leave['上班'],
              totalLeaveDays: Object.entries(w.leave).filter(([k]) => k !== '上班').reduce((s, [,v]) => s + v, 0),
            })),
            selectedMonth
          )}>
            <Download className="w-4 h-4" />匯出 xlsx
          </Button>
        </div>
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
        <h3 className="text-base">出勤暨特休統計表 — {selectedMonth}</h3>
      </div>

      <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden print:shadow-none print:border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm report-table">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30">
                {["工號", "姓名", "協助員類型", ...LEAVE_TYPES, "應出勤天數"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_DATA.map((w, idx) => {
                const workDays = w.leave["上班"];
                const totalDays = Object.values(w.leave).reduce((a, b) => a + b, 0);
                return (
                  <tr key={w.id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", idx % 2 === 0 ? "" : "bg-muted/10")}>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{w.id}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{w.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{w.type}</td>
                    {LEAVE_TYPES.map(lt => (
                      <td key={lt} className={cn("px-4 py-3 text-center",
                        lt === "上班" ? "font-semibold text-emerald-700" :
                        lt === "曠職" && w.leave["曠職"] > 0 ? "text-red-600 font-semibold" :
                        w.leave[lt as keyof typeof w.leave] > 0 ? "text-amber-700" : "text-muted-foreground/40")}>
                        {w.leave[lt as keyof typeof w.leave] || "-"}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center font-semibold text-foreground">{totalDays}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-foreground">合計</td>
                {LEAVE_TYPES.map(lt => (
                  <td key={lt} className="px-4 py-3 text-center text-sm font-bold text-foreground">
                    {MOCK_DATA.reduce((sum, w) => sum + (w.leave[lt as keyof typeof w.leave] || 0), 0)}
                  </td>
                ))}
                <td className="px-4 py-3 text-center text-sm font-bold text-foreground">
                  {MOCK_DATA.reduce((sum, w) => sum + Object.values(w.leave).reduce((a, b) => a + b, 0), 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground print:hidden">
          資料來源：Google Sheets「差勤紀錄」分頁
        </div>
      </div>
    </div>
  );
}
