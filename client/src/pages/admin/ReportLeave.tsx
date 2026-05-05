import { useState, useEffect, useCallback, useMemo } from "react";
import { Printer, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportLeaveStatReport } from "@/lib/exportExcel";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { differenceInDays, parseISO } from "date-fns";
import { isAssistant, toMinguoDate } from "@/lib/utils";

const MONTHS_LIST = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"];

function calculateAnnualLeave(tenureYears: number) {
  if (tenureYears < 0.5) return 0;
  if (tenureYears < 1) return 3;
  if (tenureYears < 2) return 7;
  if (tenureYears < 3) return 10;
  if (tenureYears < 5) return 14;
  if (tenureYears < 10) return 15;
  const extra = Math.floor(tenureYears - 10);
  return Math.min(30, 15 + extra);
}

interface WorkerLeaveData {
  id: string; name: string; dept: string; onboard: string; pastExp: number;
  workDays: number; thisMonthLeaveHours: number; totalUsedHours: number;
  leaveDetails: string;
}

export default function ReportLeave() {
  const { user } = useGasAuthContext();
  const [selectedMonth, setSelectedMonth] = useState("2026-04");
  const [reportData, setReportData] = useState<WorkerLeaveData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const res = await gasGet<any>("getReport", { callerEmail: user.email, type: "5", yearMonth: selectedMonth });
      if (res.success && res.data) {
        const { workers, snapshots, yearSnapshots, attendance } = res.data;
        const mapped = (workers || []).map((w: any) => {
          const wId = String(w["人員編號"]);
          const snap = (snapshots || []).find((s: any) => s["人員編號"] === wId && s["年月"] === selectedMonth);
          const ySnaps = (yearSnapshots || []).filter((s: any) => s["人員編號"] === wId);
          const atts = (attendance || []).filter((a: any) => a["人員編號"] === wId);

          const totalUsedHours = ySnaps.reduce((sum: number, s: any) => sum + (parseFloat(s["特休時數"]) || 0), 0);
          
          const details = atts
            .filter((a: any) => a["上午狀態"] === "特休" || a["下午狀態"] === "特休" || (parseFloat(a["特休時數"]) || 0) > 0)
            .map((a: any) => {
              const d = String(a["日期"]).split("-").slice(1).join("/");
              const h = parseFloat(a["特休時數"]) || 0;
              return `${d}(特休${h}h)`;
            })
            .join(", ");

          return {
            id: wId, name: String(w["姓名"] || ""), dept: String(w["用人部門"] || ""), 
            onboard: String(w["到職日"] || ""), pastExp: parseFloat(w["過往年資天數"]) || 0,
            workDays: parseFloat(snap?.["出勤天數"]) || 0, 
            thisMonthLeaveHours: parseFloat(snap?.["特休時數"]) || 0,
            leaveDetails: details,
            ytdLeaveHours: Number(w["累計至上月已休時數"] || w["ytdLeaveHours"] || 0)
          };
        }).filter((w: any) => isAssistant(w.id) && isPersonActiveInMonth(w.onboard, selectedMonth)); // 白名單 + 入職過濾
        setReportData(mapped);
      }
    } finally { setIsLoading(false); }
  }, [user?.email, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const isReadOnly = user?.role === "billing";

  const tableData = useMemo(() => {
    const today = new Date();
    return reportData.map(w => {
      let tenureDays = w.pastExp;
      if (w.onboard) {
        try { tenureDays += differenceInDays(today, parseISO(w.onboard)); } catch(e) {}
      }
      const tenureYears = tenureDays / 365;
      const entitledDays = calculateAnnualLeave(tenureYears);
      const entitledHours = entitledDays * 8;
      // B (截至上月已休) + C (本月請休) = 總已休
      const totalUsedHours = (w as any).ytdLeaveHours || w.totalUsedHours;
      return { ...w, tenureYears, entitledHours, totalUsedHours, remainingHours: entitledHours - totalUsedHours };
    });
  }, [reportData]);

  return (
    <div className="space-y-6 print:space-y-0 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5 bg-slate-100 p-1 rounded-lg">
            {MONTHS_LIST.map(m => (
              <button key={m} onClick={() => setSelectedMonth(m)}
                className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-all",
                  selectedMonth === m ? "bg-white text-blue-700 shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                {m}
              </button>
            ))}
          </div>
          {isReadOnly && <span className="text-xs text-muted-foreground italic">(計價人員唯讀模式)</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">
            <Printer className="w-4 h-4" />列印報表
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportLeaveStatReport(tableData, selectedMonth)} className="gap-1.5">
            <Download className="w-4 h-4" />匯出 Excel
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-elegant border border-border/50 p-8 print:p-0 print:shadow-none print:border-none max-w-[297mm] mx-auto min-h-[210mm]">
        <div className="text-center mb-6 pt-4">
          <h1 className="text-2xl font-bold border-b-2 border-black inline-block px-4 pb-1 text-center w-full">亮軒企業有限公司</h1><br />
          <h1 className="text-xl font-bold border-b-2 border-black inline-block px-4 pb-1 mt-2">「115年度綜合施工處職安環保協助員量化工作」<br />每月出勤暨特休統計表</h1>
        </div>

        <div className="flex justify-end items-center mb-2 px-1 text-base font-bold">
          統計年月：<span className="border-b border-black px-4">{selectedMonth.replace("-", "年")}月</span>
        </div>

        <table className="w-full border-collapse border border-black text-[11px]">
          <thead>
            <tr className="bg-gray-100 h-10 font-bold">
              <th className="border border-black w-8">項次</th>
              <th className="border border-black w-20">姓名</th>
              <th className="border border-black w-20">到職日期</th>
              <th className="border border-black w-20">年資<br />(含併計)</th>
              <th className="border border-black w-20">應有特休<br />(小時)</th>
              <th className="border border-black w-20">累計已休 (B)<br />(小時)</th>
              <th className="border border-black w-20">剩餘時數<br />(小時)</th>
              <th className="border border-black w-20">本月出勤<br />(天數)</th>
              <th className="border border-black w-20">本月請休 (C)<br />(小時)</th>
              <th className="border border-black">出勤/請假日期詳列</th>
            </tr>
          </thead>
          <tbody>
            {tableData.map((row, idx) => (
              <tr key={row.id} className="h-10">
                <td className="border border-black text-center">{idx + 1}</td>
                <td className="border border-black text-center font-bold">{row.name}<br /><span className="text-[9px] text-gray-400 font-normal">{row.id}</span></td>
                <td className="border border-black text-center">{toMinguoDate(row.onboard)}</td>
                <td className="border border-black text-center">{row.tenureYears.toFixed(1)}年</td>
                <td className="border border-black text-center font-mono">{row.entitledHours}</td>
                <td className="border border-black text-center font-mono text-amber-700">{row.totalUsedHours}</td>
                <td className="border border-black text-center font-mono font-bold text-emerald-700">{row.remainingHours}</td>
                <td className="border border-black text-center font-bold">{row.workDays}</td>
                <td className="border border-black text-center font-mono text-blue-700 font-bold">{row.thisMonthLeaveHours}</td>
                <td className="border border-black px-2 py-1 leading-tight text-[9px] text-gray-600">
                  {row.leaveDetails || <span className="text-gray-300 italic">無請假紀錄</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 text-[10px] border border-black p-4 bg-gray-50">
          <p className="font-bold underline mb-1">備註說明：</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>特休計算依《勞基法》規定核算，年資包含過往併計天數。</li>
            <li>「本月出勤」定義為實際到工天數 (不含請假天數)。</li>
            <li>「本月請休」為本月核定發放點數之特休/補休時數。</li>
            <li className="text-blue-700 font-bold">廠商應確保所屬人員之出勤紀錄與本表一致，作為費用核付之佐證。</li>
          </ul>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 text-center print:mt-24">
          <div><div className="border-b border-black pb-8 mb-2 font-bold">製表人</div></div>
          <div><div className="border-b border-black pb-8 mb-2 font-bold">複核</div></div>
          <div><div className="border-b border-black pb-8 mb-2 font-bold">核准</div></div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          .shadow-elegant { box-shadow: none !important; }
          .border-border\\/50 { border: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-50 { background-color: #f9fafb !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
        }
      `}} />
    </div>
  );
}
