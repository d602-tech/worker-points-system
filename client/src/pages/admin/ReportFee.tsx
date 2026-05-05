import { useState, useEffect, useCallback, useMemo } from "react";
import { Printer, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toChineseAmount } from "@/lib/exportExcel";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format, isBefore, isAfter, parseISO } from "date-fns";
import { isAssistant, isPersonActiveInMonth, HOLIDAYS } from "@/lib/utils";

const MONTHS_LIST = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"];


function getWorkDaysInMonth(yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  let workDays = 0;
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const ymd = format(d, "yyyy-MM-dd");
      if (!HOLIDAYS.includes(ymd)) workDays++;
    }
  }
  return workDays;
}

function getContractDaysInfo(yearMonth: string) {
  const startLimit = new Date(2026, 3, 22); // 115/04/22
  const endLimit = new Date(2027, 5, 21);   // 116/06/21
  
  const [year, month] = yearMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const dTotal = monthEnd.getDate();
  const intersectStart = monthStart > startLimit ? monthStart : startLimit;
  const intersectEnd = monthEnd < endLimit ? monthEnd : endLimit;

  if (intersectStart > intersectEnd) return { ratio: 0, dContract: 0, dTotal };

  const dContract = Math.floor((intersectEnd.getTime() - intersectStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return { ratio: dContract / dTotal, dContract, dTotal };
}

interface WorkerData {
  id: string; type: string; a: number; b: number; c: number; d: number; s: number; p: number; workDays: number; leaveHours: number;
}

export default function ReportFee() {
  const { user } = useGasAuthContext();
  const [selectedMonth, setSelectedMonth] = useState("2026-04");
  const [reportData, setReportData] = useState<WorkerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customFees, setCustomFees] = useState({ edu: 0, ppe: 0 });

  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const res = await gasGet<any>("getReport", { callerEmail: user.email, type: "5", yearMonth: selectedMonth });
      if (res.success && res.data) {
        const { workers, snapshots } = res.data;
        const mapped = (workers || []).map((w: any) => {
          const wId = String(w["人員編號"]);
          const onboard = w["到職日"] || "";
          const resign = w["離職日"] || "";
          
          // 過濾白名單
          if (!isAssistant(wId)) return null;

          // 過濾契約區間與入職狀態
          if (onboard && isAfter(parseISO(onboard), new Date(2027, 5, 21))) return null;
          if (resign && isBefore(parseISO(resign), new Date(2026, 3, 22))) return null;
          if (!isPersonActiveInMonth(onboard, selectedMonth)) return null;

          const snap = (snapshots || []).find((s: any) => s["人員編號"] === wId && s["年月"] === selectedMonth);
          return {
            id: wId, type: String(w["職務類型"] || ""),
            a: parseFloat(snap?.["A類小計"]) || 0, 
            b: parseFloat(snap?.["B類小計"]) || 0, 
            c: parseFloat(snap?.["C類金額"]) || 0, 
            d: parseFloat(snap?.["D類小計"]) || 0,
            s: parseFloat(snap?.["S類金額"]) || 0, 
            p: parseFloat(snap?.["P類扣款"]) || 0, 
            workDays: parseFloat(snap?.["出勤天數"]) || 0, 
            leaveHours: parseFloat(snap?.["特休時數"]) || 0,
          };
        }).filter(Boolean);
        setReportData(mapped as WorkerData[]);
      }
    } finally { setIsLoading(false); }
  }, [user?.email, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const { ratio, dContract, dTotal } = getContractDaysInfo(selectedMonth);
  const calendarWorkDays = getWorkDaysInMonth(selectedMonth);

  const stats = useMemo(() => {
    const data = { 
      general: 0, offshore: 0, safety: 0, environment: 0, 
      leaveS: 0, penaltyP: 0, 
      actualWorkHoursSum: 0, 
      totalConfiguredWorkers: reportData.length,
      assistantTotal: 0,
      activeWorkerCount: 0,
      totalLeaveHours: 0
    };
    reportData.forEach(w => {
      const pts = (w.a || 0) + (w.b || 0) + (w.c || 0) + (w.d || 0);
      if (w.type.includes("一般") || w.type === "general") data.general += pts;
      else if (w.type.includes("離島") || w.type === "offshore") data.offshore += pts;
      else if (w.type.includes("職安") || w.type === "safety") data.safety += pts;
      else if (w.type.includes("環保") || w.type === "environment") data.environment += pts;
      data.leaveS += (w.s || 0); 
      data.penaltyP += (w.p || 0);
      
      if (w.workDays > 0) {
        data.activeWorkerCount++;
      }
      data.totalLeaveHours += (w.leaveHours || 0);
    });
    
    // 重新計算實際總時數與出勤率基準
    const expectedTotalHours = data.activeWorkerCount * calendarWorkDays * 8;
    data.actualWorkHoursSum = expectedTotalHours - data.totalLeaveHours;
    
    data.assistantTotal = data.general + data.offshore + data.safety + data.environment;
    return data;
  }, [reportData, calendarWorkDays]);

  const expectedTotalHours = stats.activeWorkerCount * calendarWorkDays * 8;
  const attendRate = expectedTotalHours > 0 ? Math.min(1, stats.actualWorkHoursSum / expectedTotalHours) : 0;

  const fixVal = Math.round((1632400 / 14) * (reportData.length / 11) * ratio);
  const admVal = Math.round((805000 / 14) * ratio * attendRate);
  const cldVal = Math.round(1000 * ratio);

  const subtotal = Math.round(stats.general * ratio) + Math.round(stats.offshore * ratio) + Math.round(stats.safety * ratio) + Math.round(stats.environment * ratio) +
                   fixVal + customFees.edu + admVal + cldVal + customFees.ppe + stats.leaveS;
  const tax = Math.round((subtotal - stats.penaltyP) * 0.05);
  const grandTotal = subtotal - stats.penaltyP + tax;

  return (
    <div className="space-y-6 print:space-y-0 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      
      {/* 操作列 */}
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
        <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 bg-slate-800 text-white hover:bg-slate-700 hover:text-white">
          <Printer className="w-4 h-4" />列印報表
        </Button>
      </div>

      {/* 正式報表內容 */}
      <div className="bg-white rounded-xl shadow-elegant border border-border/50 p-12 print:p-0 print:shadow-none print:border-none max-w-[210mm] mx-auto min-h-[297mm]">
        <div className="text-center mb-8 pt-4">
          <h1 className="text-2xl font-bold border-b-2 border-black inline-block px-4 pb-2 text-center w-full">亮軒企業有限公司</h1><br />
          <h1 className="text-xl font-bold border-b-2 border-black inline-block px-4 pb-1 mt-2">「115年度綜合施工處職安環保協助員量化工作」<br />每月服務費統計表</h1>
        </div>

        <div className="flex justify-between items-end mb-4 px-1 text-sm font-bold">
          <div>廠商名稱：<span className="border-b border-black w-64 text-center inline-block">亮軒企業有限公司</span></div>
          <div>統計年月：<span className="border-b border-black px-4">{selectedMonth.replace("-", "年")}月</span></div>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-gray-100 h-10 font-bold border-b-2 border-black">
              <th className="border border-black w-10">項次</th>
              <th className="border border-black">項目說明</th>
              <th className="border border-black w-24">承攬金額</th>
              <th className="border border-black w-24">本月金額</th>
              <th className="border border-black w-44">備註</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-gray-50 font-bold"><td colSpan={5} className="border border-black px-2 py-1">一、直接費用</td></tr>
            <tr>
              <td className="border border-black text-center">1</td>
              <td className="border border-black px-2">(一) 一般協助員</td>
              <td className="border border-black text-center">1,215,200</td>
              <td className="border border-black text-center font-bold text-blue-700">{stats.general.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">自動加總一般身分人員金額</td>
            </tr>
            <tr>
              <td className="border border-black text-center">2</td>
              <td className="border border-black px-2">(二) 離島地區協助員</td>
              <td className="border border-black text-center">243,600</td>
              <td className="border border-black text-center font-bold text-blue-700">{stats.offshore.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">自動加總離島身分人員金額</td>
            </tr>
            <tr>
              <td className="border border-black text-center">3</td>
              <td className="border border-black px-2">(三) 職安管理協助員</td>
              <td className="border border-black text-center">112,000</td>
              <td className="border border-black text-center font-bold text-blue-700">{stats.safety.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">自動加總職安身分人員金額</td>
            </tr>
            <tr>
              <td className="border border-black text-center">4</td>
              <td className="border border-black px-2">(四) 環保管理協助員</td>
              <td className="border border-black text-center">61,600</td>
              <td className="border border-black text-center font-bold text-blue-700">{stats.environment.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">自動加總環保身分人員金額</td>
            </tr>
            <tr>
              <td className="border border-black text-center">5</td>
              <td className="border border-black px-2">(五) 雇主應負擔之固定費用</td>
              <td className="border border-black text-center">1,632,400</td>
              <td className="border border-black text-center font-mono font-bold text-blue-700">{fixVal.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">比例計給，破月依日曆天折算</td>
            </tr>
            <tr className="bg-blue-50 font-bold">
              <td colSpan={3} className="border border-black text-right px-4 text-blue-800">各協助員點數金額合計 (一~四)</td>
              <td className="border border-black text-center font-mono text-blue-900">
                {Math.round(stats.assistantTotal * ratio).toLocaleString()}
              </td>
              <td className="border border-black"></td>
            </tr>


            <tr className="bg-gray-50 font-bold"><td colSpan={5} className="border border-black px-2 py-1">二、乙方管理費用</td></tr>
            <tr>
              <td className="border border-black text-center">6</td>
              <td className="border border-black px-2">(一) 職業安全衛生宣導暨教育訓練費用</td>
              <td className="border border-black text-center">20,000</td>
              <td className="border border-black text-center p-0">
                <input type="number" step="1000" min="0" value={customFees.edu} onChange={e => setCustomFees(f => ({ ...f, edu: Number(e.target.value) }))} className="w-full text-center py-1 bg-transparent no-print hover:bg-blue-50" />
                <span className="hidden print:inline">{customFees.edu.toLocaleString()}</span>
              </td>
              <td className="border border-black px-2 text-[10px]">依實際發生數計給 (步進: 1,000)</td>
            </tr>
            <tr>
              <td className="border border-black text-center">7</td>
              <td className="border border-black px-2">(二) 行政管理費用及利潤</td>
              <td className="border border-black text-center">805,000</td>
              <td className="border border-black text-center font-mono font-bold text-blue-700">{admVal.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">依出勤率比例計給，破月折算</td>
            </tr>
            <tr>
              <td className="border border-black text-center">8</td>
              <td className="border border-black px-2">(三) 具AI功能之雲端空間月租費用</td>
              <td className="border border-black text-center">14,000</td>
              <td className="border border-black text-center font-mono">{cldVal.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">每月固定1,000元 (依破月折算)</td>
            </tr>
            <tr>
              <td className="border border-black text-center">9</td>
              <td className="border border-black px-2">(四) 個人安全防護器具</td>
              <td className="border border-black text-center">32,000</td>
              <td className="border border-black text-center p-0">
                <input type="number" step="2000" min="0" value={customFees.ppe} onChange={e => setCustomFees(f => ({ ...f, ppe: Number(e.target.value) }))} className="w-full text-center py-1 bg-transparent no-print hover:bg-blue-50" />
                <span className="hidden print:inline">{customFees.ppe.toLocaleString()}</span>
              </td>
              <td className="border border-black px-2 text-[10px]">依實際發生數計給 (步進: 2,000)</td>
            </tr>

            <tr className="bg-gray-50 font-bold"><td colSpan={5} className="border border-black px-2 py-1">三、特休費用</td></tr>
            <tr>
              <td className="border border-black text-center">10</td>
              <td className="border border-black px-2">(一) 特休代付款</td>
              <td className="border border-black text-center">182,800</td>
              <td className="border border-black text-center font-mono">{stats.leaveS.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">依實際核付點數計給</td>
            </tr>

            <tr className="bg-red-50 font-bold text-red-900"><td colSpan={5} className="border border-black px-2 py-1">四、扣款項目</td></tr>
            <tr>
              <td className="border border-black text-center">11</td>
              <td className="border border-black px-2">(一) 懲罰性違約金</td>
              <td className="border border-black text-center">-</td>
              <td className="border border-black text-center font-mono text-red-600">-{stats.penaltyP.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px]">依合約規定計罰</td>
            </tr>

            <tr className="bg-gray-100 font-bold border-t-2 border-black h-10">
              <td colSpan={3} className="border border-black text-right px-4">加值型營業稅 (5%)</td>
              <td className="border border-black text-center font-mono">{tax.toLocaleString()}</td>
              <td className="border border-black px-2 text-[10px] font-normal"> (本月小計 - 扣款) × 5%</td>
            </tr>
            <tr className="bg-gray-200 font-bold border-t-2 border-black h-12">
              <td colSpan={3} className="border border-black text-right px-4 text-base">本月總計 (含稅)</td>
              <td className="border border-black text-center font-mono text-lg text-blue-800">{grandTotal.toLocaleString()}</td>
              <td className="border border-black"></td>
            </tr>
          </tbody>
        </table>

        <div className="mt-4 border border-black p-4 bg-white flex items-center">
          <span className="font-bold text-base whitespace-nowrap">本月實付金額總計 (含稅) 新臺幣：</span>
          <span className="text-lg font-bold ml-2 tracking-widest border-b border-gray-400 flex-1 text-center">{toChineseAmount(grandTotal)}</span>
        </div>

        {/* 簽核區 */}
        <div className="mt-20 grid grid-cols-3 gap-8 text-center print:mt-32">
          <div>
            <div className="border-b border-black pb-12 mb-2 font-bold">製表人</div>
          </div>
          <div>
            <div className="border-b border-black pb-12 mb-2 font-bold">複核</div>
          </div>
          <div>
            <div className="border-b border-black pb-12 mb-2 font-bold">核准</div>
          </div>
        </div>

        {/* 備註說明區 */}
        <div className="mt-12 text-[10px] leading-tight border border-black p-3 bg-gray-50 no-print">
          <p className="font-bold mb-1 underline">【費用與出勤率計算基準】</p>
          <div className="space-y-1 text-blue-800">
            <p>• <b>破月比例 (日曆天)</b> = {dContract}天 / {dTotal}天 = <b>{ratio.toFixed(2)}</b></p>
            <p>• <b>出勤率</b> = 實際總時數 {Math.round(stats.actualWorkHoursSum)}h / (當月上班人員 {stats.activeWorkerCount}人 × {calendarWorkDays}工作天 × 8h) = <b>{attendRate.toFixed(2)}</b></p>
            <p>• <b>實際總時數</b> = (上班人員 {stats.activeWorkerCount}人 × {calendarWorkDays}天 × 8h) - 總請假 {stats.totalLeaveHours}h = <b>{Math.round(stats.actualWorkHoursSum)}h</b></p>
            <p>• <b>固定費用</b> = (1,632,400 ÷ 14) × (實際人數 {reportData.length} / 11) × {ratio.toFixed(2)} = <b>{fixVal.toLocaleString()}</b></p>
            <p>• <b>行政管理費</b> = (805,000 ÷ 14) × {ratio.toFixed(2)} × {attendRate.toFixed(2)}(出勤率) = <b>{admVal.toLocaleString()}</b></p>
          </div>
          <p className="mt-2 text-blue-700 font-bold">※ 破月折算基準：依合約規定，首尾月依實際履約日曆天數佔當月全月日曆天數之比例折算計價。</p>
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
          .bg-gray-100 { background-color: #f3f4f6 !important; }
          .bg-gray-200 { background-color: #e5e7eb !important; }
          .bg-red-50 { background-color: #fef2f2 !important; }
          .bg-blue-50 { background-color: #eff6ff !important; }
        }
      `}} />
    </div>
  );
}
