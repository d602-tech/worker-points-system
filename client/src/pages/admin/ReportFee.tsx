import { useState, useEffect, useCallback, useMemo } from "react";
import { Printer, TrendingUp, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toChineseAmount } from "@/lib/exportExcel";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";

const MONTHS_LIST = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"];
const TARGET_USERS = ["USR001", "USR002", "USR003", "USR004", "USR005", "USR006", "USR007", "USR008", "USR009", "USR010", "USR011"];

// 115/116 年度國定假日表
const HOLIDAYS = [
  "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", "2026-02-20", "2026-02-27", "2026-04-03", "2026-04-06", "2026-05-01", "2026-06-19", "2026-09-25", "2026-10-09",
  "2027-01-01", "2027-02-05", "2027-02-08", "2027-02-09", "2027-02-10", "2027-04-05", "2027-06-09", "2027-09-15", "2027-10-10"
];

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
  const [year, month] = yearMonth.split("-").map(Number);
  const dTotal = new Date(year, month, 0).getDate();
  let dContract = dTotal;
  
  if (yearMonth === "2026-04") dContract = 9; // 4/22 to 4/30
  else if (yearMonth === "2027-06") dContract = 21; // 6/1 to 6/21
  else if (year < 2026 || (year === 2026 && month < 4)) dContract = 0;
  else if (year > 2027 || (year === 2027 && month > 6)) dContract = 0;
  
  return { dContract, dTotal };
}

interface WorkerData {
  id: string;
  type: string;
  a: number;
  b: number;
  c: number;
  d: number;
  s: number;
  p: number;
  workDays: number;
  leaveHours: number;
}

export default function ReportFee() {
  const { user } = useGasAuthContext();
  const [selectedMonth, setSelectedMonth] = useState("2026-04");
  const [reportData, setReportData] = useState<WorkerData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customFees, setCustomFees] = useState({
    edu: 0,
    cloud: 1000,
    ppe: 0,
  });

  const loadData = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const res = await gasGet<any>("getReport", {
        callerEmail: user.email,
        type: "5",
        yearMonth: selectedMonth
      });
      if (res.success && res.data) {
        const { workers, snapshots } = res.data;
        const validWorkers = (workers || []).filter((w: any) => TARGET_USERS.includes(w["人員編號"]));
        
        const mapped = validWorkers.map((w: any) => {
          const wId = String(w["人員編號"]);
          const snap = (snapshots || []).find((s: any) => s["人員編號"] === wId && s["年月"] === selectedMonth);
          return {
            id: wId,
            type: String(w["職務類型"] || ""),
            a: Number(snap?.["A類小計"] || 0),
            b: Number(snap?.["B類小計"] || 0),
            c: Number(snap?.["C類金額"] || 0),
            d: Number(snap?.["D類小計"] || 0),
            s: Number(snap?.["S類金額"] || 0),
            p: Number(snap?.["P類扣款"] || 0),
            workDays: Number(snap?.["出勤天數"] || 0),
            leaveHours: Number(snap?.["特休時數"] || 0),
          };
        });
        setReportData(mapped);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, selectedMonth]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => {
    const data = { general: 0, offshore: 0, safety: 0, environment: 0, leaveS: 0, penaltyP: 0, actualWorkHoursSum: 0, actualWorkerCount: 0 };
    reportData.forEach(w => {
      const regPoints = w.a + w.b + w.c + w.d;
      if (w.type === "一般協助員" || w.type === "general") data.general += regPoints;
      else if (w.type === "離島地區協助員" || w.type === "offshore") data.offshore += regPoints;
      else if (w.type === "職安管理協助員" || w.type === "safety") data.safety += regPoints;
      else if (w.type === "環保管理協助員" || w.type === "environment") data.environment += regPoints;
      
      data.leaveS += w.s;
      data.penaltyP += w.p;
      data.actualWorkHoursSum += (w.workDays * 8) + w.leaveHours; // Update: workhours include leave hours? wait, actual work hours should be just workDays * 8. I will stick to formula.
      data.actualWorkHoursSum += (w.workDays * 8); // Molecular

      if (w.workDays > 0 || w.leaveHours > 0) {
        data.actualWorkerCount++;
      }
    });
    return data;
  }, [reportData]);

  const { dContract, dTotal } = getContractDaysInfo(selectedMonth);
  const workDaysInMonth = getWorkDaysInMonth(selectedMonth);
  const totalExpectedHours = 11 * workDaysInMonth * 8; // Denominator
  
  const attendanceRate = totalExpectedHours > 0 ? (stats.actualWorkHoursSum / totalExpectedHours) : 0;
  const proratedRatio = dContract / dTotal;

  const fee_gen = Math.round(stats.general * proratedRatio);
  const fee_off = Math.round(stats.offshore * proratedRatio);
  const fee_saf = Math.round(stats.safety * proratedRatio);
  const fee_env = Math.round(stats.environment * proratedRatio);

  const fixedFee = Math.round((1632400 / 14) * (stats.actualWorkerCount / 11) * proratedRatio);
  const adminFee = Math.round((805000 / 14) * attendanceRate * proratedRatio);

  const total_direct = fee_gen + fee_off + fee_saf + fee_env + fixedFee;
  const total_manage = customFees.edu + adminFee + customFees.cloud + customFees.ppe;
  const subtotal = total_direct + total_manage + stats.leaveS - stats.penaltyP;
  const tax = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + tax;

  const handleCustomFeeChange = (key: keyof typeof customFees, value: string) => {
    setCustomFees(prev => ({ ...prev, [key]: Number(value) || 0 }));
  };

  return (
    <div className="space-y-6 print:space-y-4 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-xl font-semibold text-foreground">服務費統計表</h1>
          <p className="text-sm text-muted-foreground mt-0.5">系統自動計算 USR001~USR011 之請款費用</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5">
            <Printer className="w-4 h-4" />列印
          </Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap print:hidden">
        {MONTHS_LIST.map(m => (
          <button key={m} onClick={() => setSelectedMonth(m)}
            className={cn("px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
              selectedMonth === m ? "bg-blue-700 text-white border-blue-700" : "bg-white text-muted-foreground border-border hover:border-muted-foreground")}>
            {m}
          </button>
        ))}
      </div>

      {proratedRatio < 1 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg flex gap-2 items-start text-sm print:hidden">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>非足月比例計算提醒</strong>
            <p className="text-xs mt-1">本月為合約首尾月，固定費用與行政管理費將乘以比例：<strong>{dContract} / {dTotal}</strong> ({Math.round(proratedRatio * 100)}%)。</p>
          </div>
        </div>
      )}

      {/* ===== 列印報表區域 ===== */}
      <div className="bg-white rounded-xl print:shadow-none shadow-elegant border border-border/50 p-8 print:p-0">
        
        {/* 表頭 */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold tracking-widest text-foreground">115年度 綜合施工處職安環保協助員量化工作整合系統</h1>
          <h2 className="text-lg font-semibold mt-2">每月服務費統計表</h2>
          <div className="text-right text-sm text-foreground mt-2 font-medium">申請計價月份：{selectedMonth}</div>
        </div>

        {/* 表格主體 */}
        <table className="w-full text-sm border-collapse border border-foreground print-table">
          <tbody>
            {/* 一、直接費用 */}
            <tr>
              <td colSpan={2} className="border border-foreground bg-muted/20 font-bold p-2">一、直接費用</td>
              <td className="border border-foreground font-bold text-right p-2 w-32 bg-muted/20">{total_direct.toLocaleString()}</td>
              <td className="border border-foreground p-2 w-48 text-muted-foreground text-xs bg-muted/20"></td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6 w-1/2">(一) 一般協助員</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground w-16">式</td>
              <td className="border border-foreground text-right p-2">{fee_gen.toLocaleString()}</td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground"></td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(二) 離島地區協助員</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-2">{fee_off.toLocaleString()}</td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground"></td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(三) 職安管理協助員</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-2">{fee_saf.toLocaleString()}</td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground"></td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(四) 環保管理協助員</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-2">{fee_env.toLocaleString()}</td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground"></td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(五) 雇主應負擔之固定費用</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-2">{fixedFee.toLocaleString()}</td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground">
                人數比例: {stats.actualWorkerCount}/11<br/>
                天數比例: {dContract}/{dTotal}
              </td>
            </tr>

            {/* 二、乙方管理費用 */}
            <tr>
              <td colSpan={2} className="border border-foreground bg-muted/20 font-bold p-2">二、乙方管理費用</td>
              <td className="border border-foreground font-bold text-right p-2 bg-muted/20">{total_manage.toLocaleString()}</td>
              <td className="border border-foreground bg-muted/20"></td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(一) 職業安全衛生宣導暨教育訓練費用</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-0 relative group">
                <input type="number" className="w-full h-full text-right p-2 outline-none bg-transparent hover:bg-blue-50 focus:bg-blue-50 transition-colors print:appearance-none print:bg-transparent"
                  value={customFees.edu} onChange={e => handleCustomFeeChange('edu', e.target.value)} />
              </td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground">手動輸入</td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(二) 行政管理費用及利潤</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-2">{adminFee.toLocaleString()}</td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground">
                出勤率: {(attendanceRate * 100).toFixed(2)}%<br/>
                分子: {stats.actualWorkHoursSum} / 分母: {totalExpectedHours}<br/>
                天數比例: {dContract}/{dTotal}
              </td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(三) 具AI功能之雲端空間月租費用</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-0 relative">
                <input type="number" className="w-full h-full text-right p-2 outline-none bg-transparent hover:bg-blue-50 focus:bg-blue-50 transition-colors print:appearance-none print:bg-transparent"
                  value={customFees.cloud} onChange={e => handleCustomFeeChange('cloud', e.target.value)} />
              </td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground">手動輸入</td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(四) 個人安全防護器具</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-0 relative">
                <input type="number" className="w-full h-full text-right p-2 outline-none bg-transparent hover:bg-blue-50 focus:bg-blue-50 transition-colors print:appearance-none print:bg-transparent"
                  value={customFees.ppe} onChange={e => handleCustomFeeChange('ppe', e.target.value)} />
              </td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground">手動輸入</td>
            </tr>

            {/* 三、特休費用 */}
            <tr>
              <td colSpan={2} className="border border-foreground bg-muted/20 font-bold p-2">三、特休費用</td>
              <td className="border border-foreground font-bold text-right p-2 bg-muted/20">{stats.leaveS.toLocaleString()}</td>
              <td className="border border-foreground bg-muted/20"></td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6">(一) 不扣薪假與特休費用 (含特休代付款)</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-2">{stats.leaveS.toLocaleString()}</td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground">系統代入</td>
            </tr>

            {/* 四、扣款項目 */}
            <tr>
              <td colSpan={2} className="border border-foreground bg-red-50 font-bold text-red-800 p-2">四、扣款項目</td>
              <td className="border border-foreground font-bold text-right text-red-800 p-2 bg-red-50">{stats.penaltyP.toLocaleString()}</td>
              <td className="border border-foreground bg-red-50"></td>
            </tr>
            <tr>
              <td className="border border-foreground p-2 pl-6 text-red-700">(一) 懲罰性違約金 (未指派人員)</td>
              <td className="border border-foreground p-2 text-center text-muted-foreground">式</td>
              <td className="border border-foreground text-right p-2 text-red-700">{stats.penaltyP.toLocaleString()}</td>
              <td className="border border-foreground p-2 text-xs text-muted-foreground">系統代入</td>
            </tr>

            {/* 小計與稅額 */}
            <tr>
              <td colSpan={2} className="border border-foreground p-2 font-bold text-right">小計</td>
              <td className="border border-foreground p-2 text-right font-bold">{subtotal.toLocaleString()}</td>
              <td className="border border-foreground p-2"></td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-foreground p-2 font-bold text-right">加值型營業稅 (5%)</td>
              <td className="border border-foreground p-2 text-right font-bold">{tax.toLocaleString()}</td>
              <td className="border border-foreground p-2"></td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-foreground p-3 font-bold text-lg text-right bg-blue-50">本月總計 (含稅)</td>
              <td className="border border-foreground p-3 text-right font-bold text-lg bg-blue-50 text-blue-700">{grandTotal.toLocaleString()}</td>
              <td className="border border-foreground p-3 bg-blue-50 text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5"/>系統彙算</td>
            </tr>
          </tbody>
        </table>

        {/* 總結與簽核 */}
        <div className="mt-6 space-y-2 text-sm font-medium">
          <div className="flex gap-2">
            <span>本月總計：</span>
            <span className="font-bold underline underline-offset-4">{toChineseAmount(grandTotal)}</span>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 text-center print:mt-32">
          <div>
            <div className="border-b border-foreground/50 pb-8 mb-2 font-semibold">製表</div>
            <div className="text-sm text-muted-foreground">(請款申請人)</div>
          </div>
          <div>
            <div className="border-b border-foreground/50 pb-8 mb-2 font-semibold">複核</div>
            <div className="text-sm text-muted-foreground">(專案經理)</div>
          </div>
          <div>
            <div className="border-b border-foreground/50 pb-8 mb-2 font-semibold">核准</div>
            <div className="text-sm text-muted-foreground">(負責人)</div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * { visibility: hidden; }
          .print-hidden { display: none !important; }
          .bg-white { background: transparent !important; }
          .border-border\\/50 { border: none !important; }
          
          /* Show only the report container */
          .bg-white.print\\:shadow-none { 
            visibility: visible; 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            margin: 0;
            padding: 0;
          }
          .bg-white.print\\:shadow-none * { visibility: visible; }
          
          @page {
            size: A4 portrait;
            margin: 15mm;
          }
          
          input[type=number] {
            border: none;
            box-shadow: none;
            -moz-appearance: textfield;
          }
          input[type=number]::-webkit-inner-spin-button, 
          input[type=number]::-webkit-outer-spin-button { 
            -webkit-appearance: none; 
            margin: 0; 
          }
          
          .bg-blue-50 { background-color: #eff6ff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-muted\\/20 { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .bg-red-50 { background-color: #fef2f2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .text-blue-700 { color: #1d4ed8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .text-red-700, .text-red-800 { color: #b91c1c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}} />
    </div>
  );
}
