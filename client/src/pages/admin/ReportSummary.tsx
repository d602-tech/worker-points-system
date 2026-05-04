import { useState, useEffect, useCallback, useMemo } from "react";
import { Printer, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportWorkSummaryReport } from "@/lib/exportExcel";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";

const MONTHS_LIST = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"];

interface SummaryRow {
  id: string; name: string; dept: string; area: string;
  reg: number; sp: number; pen: number; total: number;
}

export default function ReportSummary() {
  const { user } = useGasAuthContext();
  const [selectedMonth, setSelectedMonth] = useState("2026-04");
  const [reportData, setReportData] = useState<SummaryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const res = await gasGet<any>("getReport", { callerEmail: user.email, type: "5", yearMonth: selectedMonth });
      if (res.success && res.data) {
        const { workers, snapshots } = res.data;
        const mapped = (workers || []).map((w: any) => {
          const wId = String(w["人員編號"]);
          const snap = (snapshots || []).find((s: any) => s["人員編號"] === wId && s["年月"] === selectedMonth);
          const reg = (parseFloat(snap?.["A類小計"]) || 0) + (parseFloat(snap?.["B類小計"]) || 0) + (parseFloat(snap?.["C類金額"]) || 0) + (parseFloat(snap?.["D類小計"]) || 0);
          const sp = parseFloat(snap?.["S類金額"]) || 0;
          const pen = parseFloat(snap?.["P類扣款"]) || 0;
          return {
            id: wId, name: String(w["姓名"] || ""), dept: String(w["用人部門"] || ""), area: String(w["服務區域"] || ""),
            reg, sp, pen, total: reg - pen
          };
        });
        setReportData(mapped);
      }
    } finally { setIsLoading(false); }
  }, [user?.email, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const grandTotals = useMemo(() => {
    return reportData.reduce((acc, row) => ({
      reg: acc.reg + row.reg,
      sp: acc.sp + row.sp,
      pen: acc.pen + row.pen,
      total: acc.total + row.total,
      amount: acc.amount + row.reg
    }), { reg: 0, sp: 0, pen: 0, total: 0, amount: 0 });
  }, [reportData]);

  const handleExport = () => {
    exportWorkSummaryReport(reportData.map(r => ({
      workerId: r.id, workerName: r.name, workerType: "", area: r.area,
      catA: r.reg, catB: 0, catC: 0, catD: 0, catS: r.sp, catP: r.pen, total: r.total
    })), selectedMonth);
  };

  return (
    <div className="space-y-6 print:space-y-0 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      
      <div className="flex items-center justify-between no-print">
        <div className="flex gap-2">
          {MONTHS_LIST.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                selectedMonth === m ? "bg-blue-700 text-white border-blue-700 shadow-sm" : "bg-white text-muted-foreground border-border hover:bg-muted")}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">
            <Printer className="w-4 h-4" />列印
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="w-4 h-4" />匯出 xlsx
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-elegant border border-border/50 p-12 print:p-0 print:shadow-none print:border-none max-w-[210mm] mx-auto min-h-[297mm]">
        <div className="text-center mb-8 pt-4">
          <h1 className="text-2xl font-bold border-b-2 border-black inline-block px-4 pb-2 text-center w-full">亮軒企業有限公司</h1><br />
          <h1 className="text-xl font-bold border-b-2 border-black inline-block px-4 pb-2 mt-2">「115年度綜合施工處職安環保協助員量化工作」<br />每月工作量彙總表</h1>
        </div>

        <div className="flex justify-end items-center mb-2 px-1 text-base font-bold">
          統計年月：<span className="border-b border-black px-4">{selectedMonth.replace("-", "年")}月</span>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 h-10 font-bold">
              <th className="border border-black w-10">項次</th>
              <th className="border border-black w-24">姓名</th>
              <th className="border border-black w-32">工地<br />(用人部門)</th>
              <th className="border border-black w-20">一般點數</th>
              <th className="border border-black w-20">特休代付</th>
              <th className="border border-black w-20">懲罰扣款</th>
              <th className="border border-black w-20">總計點數</th>
              <th className="border border-black w-24">機關核付金額<br />(元)</th>
              <th className="border border-black">備註</th>
            </tr>
          </thead>
          <tbody>
            {reportData.map((row, idx) => (
              <tr key={row.id} className="h-10">
                <td className="border border-black text-center">{idx + 1}</td>
                <td className="border border-black text-center font-bold">{row.name}<br /><span className="text-[10px] text-gray-500">{row.id}</span></td>
                <td className="border border-black text-center text-[10px] leading-tight">{row.area}<br />({row.dept})</td>
                <td className="border border-black text-center font-mono">{Math.round(row.reg).toLocaleString()}</td>
                <td className="border border-black text-center font-mono text-amber-700">{Math.round(row.sp).toLocaleString()}</td>
                <td className="border border-black text-center font-mono text-red-600">{row.pen > 0 ? `-${Math.round(row.pen).toLocaleString()}` : '0'}</td>
                <td className="border border-black text-center font-mono font-bold">{Math.round(row.total).toLocaleString()}</td>
                <td className="border border-black text-center font-mono text-blue-700 font-bold">{Math.round(row.reg).toLocaleString()}</td>
                <td className="border border-black"></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="h-12 bg-gray-50 font-bold text-sm">
              <td colSpan={3} className="border border-black text-right px-4">本月合計：</td>
              <td className="border border-black text-center font-mono">{grandTotals.reg.toLocaleString()}</td>
              <td className="border border-black text-center font-mono text-amber-700">{grandTotals.sp.toLocaleString()}</td>
              <td className="border border-black text-center font-mono text-red-600">{grandTotals.pen > 0 ? `-${grandTotals.pen.toLocaleString()}` : '0'}</td>
              <td className="border border-black text-center font-mono font-bold">{grandTotals.total.toLocaleString()}</td>
              <td className="border border-black text-center font-mono text-blue-700 font-bold">{grandTotals.amount.toLocaleString()}</td>
              <td className="border border-black"></td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 text-xs leading-relaxed border border-black p-4 space-y-2">
          <p className="font-bold underline">備註：</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>每 1 點換算為新臺幣 1 元。</li>
            <li>機關核付金額：為廠商勞務人員每月總計點數 (不含特休代付款) 經機關核定後之換算金額。</li>
            <li className="text-blue-700 font-bold">破月折算基準：依合約規定，首尾月依實際履約日曆天數佔當月全月日曆天數之比例折算計價。</li>
          </ol>
        </div>

        <div className="mt-20 grid grid-cols-3 gap-8 text-center print:mt-32">
          <div><div className="border-b border-black pb-12 mb-2 font-bold">製表人</div></div>
          <div><div className="border-b border-black pb-12 mb-2 font-bold">複核</div></div>
          <div><div className="border-b border-black pb-12 mb-2 font-bold">核准</div></div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          .shadow-elegant { box-shadow: none !important; }
          .border-border\\/50 { border: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-gray-50 { background-color: #f9fafb !important; }
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-gray-200 { background-color: #e5e7eb !important; }
          .bg-red-50 { background-color: #fef2f2 !important; }
        }
      `}} />
    </div>
  );
}
