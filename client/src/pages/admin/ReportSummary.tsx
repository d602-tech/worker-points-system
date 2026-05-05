import { useState, useEffect, useCallback, useMemo } from "react";
import { Printer, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportWorkSummaryReport } from "@/lib/exportExcel";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";

const MONTHS_LIST = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"];

interface SummaryRow {
  id: string; name: string; dept: string; area: string;
  reg: number; sp: number; pen: number; total: number;
  catA: number; catB: number; catC: number; catD: number;
  catS: number; catP: number;
}

export default function ReportSummary() {
  const { user } = useGasAuthContext();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [reportData, setReportData] = useState<SummaryRow[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      // 1. 載入彙總資料
      const res = await gasGet<any>("getReport", { callerEmail: user.email, type: "5", yearMonth: selectedMonth });
      if (res.success && res.data) {
        const { workers, snapshots } = res.data;
        const mapped = (workers || []).map((w: any) => {
          const wId = String(w["人員編號"]);
          const snap = (snapshots || []).find((s: any) => s["人員編號"] === wId && s["年月"] === selectedMonth);
          
          const catA = parseFloat(snap?.["A類小計"]) || 0;
          const catB = parseFloat(snap?.["B類小計"]) || 0;
          const catC = parseFloat(snap?.["C類金額"]) || 0;
          const catD = parseFloat(snap?.["D類小計"]) || 0;
          const catS = parseFloat(snap?.["S類金額"]) || 0;
          const catP = parseFloat(snap?.["P類扣款"]) || 0;
          
          const reg = catA + catB + catC + catD;
          
          return {
            id: wId, 
            name: String(w["姓名"] || ""), 
            dept: String(w["用人部門"] || ""), 
            area: String(w["服務區域"] || ""),
            reg, 
            sp: catS, 
            pen: catP, 
            total: reg, // 主管端總計不含罰款
            catA, catB, catC, catD, catS, catP
          };
        });
        setReportData(mapped);
      }

      // 2. 如果是主管，載入每日明細
      if (user.role === "deptMgr") {
        const dRes = await gasGet<any[]>("getDailyPoints", { callerEmail: user.email, yearMonth: selectedMonth });
        if (dRes.success && Array.isArray(dRes.data)) {
          setDailyData(dRes.data);
        }
      }
    } finally { setIsLoading(false); }
  }, [user?.email, user?.role, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = () => {
    exportWorkSummaryReport(reportData.map(r => ({
      workerId: r.id, workerName: r.name, workerType: "", area: r.area,
      catA: r.catA, catB: r.catB, catC: r.catC, catD: r.catD, catS: r.catS, catP: r.catP, total: r.total
    })), selectedMonth);
  };

  return (
    <div className="space-y-6 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      
      <div className="flex items-center justify-between no-print">
        <div className="flex gap-2">
          {MONTHS_LIST.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
                selectedMonth === m ? "bg-blue-700 text-white border-blue-700" : "bg-white text-muted-foreground border-border hover:bg-muted")}>
              {m}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 bg-slate-800 text-white hover:bg-slate-700">
            <Printer className="w-4 h-4" />列印
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="w-4 h-4" />匯出 xlsx
          </Button>
        </div>
      </div>

      {user?.role === "deptMgr" ? (
        <div className="space-y-10">
          {reportData.map((worker) => {
            const wDaily = dailyData.filter(d => String(d["人員編號"]) === worker.id);
            const [year, month] = selectedMonth.split("-").map(Number);
            const daysInMonth = new Date(year, month, 0).getDate();
            const dates = Array.from({ length: daysInMonth }, (_, i) => {
              const d = i + 1;
              const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
              const dayTasks = wDaily.filter(t => String(t["日期"]).startsWith(dateStr));
              return { date: dateStr, day: d, tasks: dayTasks };
            });

            return (
              <div key={worker.id} className="bg-white rounded-xl shadow-elegant border border-border/50 p-10 max-w-[210mm] mx-auto min-h-[297mm] break-after-page print:p-0 print:shadow-none print:border-none">
                <div className="text-center mb-6">
                  <h1 className="text-2xl font-bold border-b-2 border-black inline-block px-8 pb-1 w-full">亮軒企業有限公司</h1>
                  <h2 className="text-lg font-bold mt-2">「115年度綜合施工處職安環保協助員量化工作」 個人工作月報表</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4 text-sm font-bold border border-black p-3">
                  <div className="space-y-1">
                    <p>協助員姓名：<span className="font-mono">{worker.name}</span></p>
                    <p>人員工號：<span className="font-mono">{worker.id}</span></p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p>服務區域：<span>{worker.area}</span></p>
                    <p>統計年月：<span>{selectedMonth.replace("-", "年")}月</span></p>
                  </div>
                </div>

                <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                    <tr className="bg-gray-100 h-8 font-bold text-[11px]">
                      <th className="border border-black w-14">日期</th>
                      <th className="border border-black w-16">類別</th>
                      <th className="border border-black">工作項目摘要</th>
                      <th className="border border-black w-16 text-center">數量</th>
                      <th className="border border-black w-24 text-right px-2">完成點數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dates.map(({ date, day, tasks }) => (
                      <tr key={date} className={cn("h-6", tasks.length === 0 && "text-gray-300")}>
                        <td className="border border-black text-center">{month}/{day}</td>
                        <td className="border border-black text-center">
                          {tasks.map((t, i) => <div key={i}>{t["類別"] || t["itemId"]?.split('-')[1]}</div>)}
                        </td>
                        <td className="border border-black px-2">
                          {tasks.map((t, i) => <div key={i} className="truncate max-w-[350px]">{t["工作項目名稱"] || t["itemName"]}</div>)}
                        </td>
                        <td className="border border-black text-center">
                          {tasks.map((t, i) => <div key={i}>{t["數量"] || t["qty"] || 1}</div>)}
                        </td>
                        <td className="border border-black text-right px-2 font-mono font-bold text-blue-900">
                          {tasks.map((t, i) => <div key={i}>{Math.round(t["點數"] || 0).toLocaleString()}</div>)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-blue-50/50 font-bold h-12 text-sm">
                      <td colSpan={4} className="border border-black text-right px-6 tracking-widest text-xs">
                        本月個人工作點數合計 (A+B+C+D)：
                      </td>
                      <td className="border border-black text-right px-2 font-mono text-blue-700 font-black text-lg">
                        {Math.round(worker.reg).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* 類別彙總 */}
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] font-bold">
                  <div className="border border-black p-1.5"><p>A 類點數</p><p className="text-sm">{worker.catA.toLocaleString()}</p></div>
                  <div className="border border-black p-1.5"><p>B 類點數</p><p className="text-sm">{worker.catB.toLocaleString()}</p></div>
                  <div className="border border-black p-1.5"><p>C 類點數</p><p className="text-sm">{worker.catC.toLocaleString()}</p></div>
                  <div className="border border-black p-1.5"><p>D 類點數</p><p className="text-sm">{worker.catD.toLocaleString()}</p></div>
                </div>
                
                {/* 異動項彙總 (S/P) */}
                <div className="mt-2 grid grid-cols-2 gap-4 text-center text-[10px] font-bold">
                  <div className="border border-black p-1.5 bg-amber-50/30">
                    <p>特休代付 (S)</p>
                    <p className="text-sm text-amber-700">{worker.catS.toLocaleString()}</p>
                  </div>
                  <div className="border border-black p-1.5 bg-red-50/30">
                    <p>懲罰違約金 (P)</p>
                    <p className="text-sm text-red-600">-{worker.catP.toLocaleString()}</p>
                  </div>
                </div>

                <div className="mt-10 grid grid-cols-2 gap-20 text-center">
                  <div className="border-b border-black pb-10 font-bold text-sm">協助員簽章</div>
                  <div className="border-b border-black pb-10 font-bold text-sm">主管核章</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* 財務/管理員視圖：彙總表 */
        <div className="bg-white rounded-xl shadow-elegant border border-border/50 p-10 max-w-[210mm] mx-auto min-h-[297mm]">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold border-b-2 border-black inline-block px-8 pb-1 w-full">亮軒企業有限公司</h1>
            <h2 className="text-lg font-bold mt-2">每月工作量彙總表 (財務端)</h2>
          </div>
          
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-gray-100 h-10 font-bold">
                <th className="border border-black w-10">項次</th>
                <th className="border border-black w-24">姓名</th>
                <th className="border border-black">工作點數 (A~D)</th>
                <th className="border border-black w-24">特休代付 (S)</th>
                <th className="border border-black w-24">罰款扣除 (P)</th>
                <th className="border border-black w-28">機關核付金額(元)</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map((row, idx) => (
                <tr key={row.id} className="h-10 text-center">
                  <td className="border border-black">{idx + 1}</td>
                  <td className="border border-black font-bold">{row.name}</td>
                  <td className="border border-black font-mono">{row.reg.toLocaleString()}</td>
                  <td className="border border-black font-mono text-amber-600">{row.sp.toLocaleString()}</td>
                  <td className="border border-black font-mono text-red-600">-{row.pen.toLocaleString()}</td>
                  <td className="border border-black font-mono font-bold text-blue-700">{(row.reg - row.pen).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          .break-after-page { break-after: page; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
