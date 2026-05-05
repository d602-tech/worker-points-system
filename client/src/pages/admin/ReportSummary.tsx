import { useState, useEffect, useCallback, useMemo } from "react";
import { Printer, Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { exportWorkSummaryReport } from "@/lib/exportExcel";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet } from "@/lib/gasApi";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { format } from "date-fns";
import { isAssistant, isPersonActiveInMonth } from "@/lib/utils";

// ── 資料介面 ──────────────────────────────────────────────────
interface PointDef {
  itemId: string;
  workerType: string;
  category: string;
  name: string;
  pointsPerUnit: number;
  unit: string;
  frequency: string;
  note: string;
}

interface DailyPoint {
  userId: string;
  date: string;
  itemId: string;
  quantity: number;
  points: number;
}

interface MonthlyPoint {
  userId: string;
  yearMonth: string;
  itemId: string;
  quantity: number;
  points: number;
  note: string;
}

interface WorkerInfo {
  userId: string;
  name: string;
  department: string;
  area: string;
  workerType: string;
}

const MONTHS_LIST = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"];

export default function ReportSummary() {
  const { user } = useGasAuthContext();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [isLoading, setIsLoading] = useState(false);

  // 原始雲端數據
  const [pointDefs, setPointDefs] = useState<PointDef[]>([]);
  const [dailyPoints, setDailyPoints] = useState<DailyPoint[]>([]);
  const [monthlyPoints, setMonthlyPoints] = useState<MonthlyPoint[]>([]);
  const [managedWorkers, setManagedWorkers] = useState<WorkerInfo[]>([]);

  // ── 數據獲取邏輯 ──────────────────────────────────────────────
  const fetchDataFromCloud = useCallback(async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      const [defsRes, workersRes, dailyRes, monthlyRes] = await Promise.all([
        gasGet<any[]>("getPointDefs"),
        gasGet<any[]>("getWorkers", { callerEmail: user.email }),
        gasGet<any[]>("getDailyPoints", { callerEmail: user.email, yearMonth: selectedMonth }),
        gasGet<any[]>("getMonthlyPoints", { callerEmail: user.email, yearMonth: selectedMonth })
      ]);

      if (defsRes.success && Array.isArray(defsRes.data)) {
        setPointDefs(defsRes.data.map(d => ({
          itemId: String(d["項目編號"] || ""),
          workerType: String(d["職務類型"] || ""),
          category: String(d["類別"] || ""),
          name: String(d["工作項目名稱"] || ""),
          pointsPerUnit: parseFloat(d["單位點數"]) || 0,
          unit: String(d["計量單位"] || ""),
          frequency: String(d["頻率"] || ""),
          note: String(d["備註"] || ""),
        })));
      }

      if (workersRes.success && Array.isArray(workersRes.data)) {
        setManagedWorkers(workersRes.data
          .map(w => ({
            userId: String(w["人員編號"] || ""),
            name: String(w["姓名"] || ""),
            department: String(w["用人部門"] || w["所屬部門"] || ""),
            area: String(w["服務區域"] || ""),
            workerType: String(w["職務類型"] || "general"),
            onboard: String(w["到職日"] || ""),
          }))
          .filter(w => isAssistant(w.userId) && isPersonActiveInMonth(w.onboard, selectedMonth)) // 白名單 + 入職過濾
        );
      }

      if (dailyRes.success && Array.isArray(dailyRes.data)) {
        setDailyPoints(dailyRes.data.map(d => ({
          userId: String(d["人員編號"] || ""),
          date: String(d["日期"] || ""),
          itemId: String(d["項目編號"] || ""),
          quantity: parseFloat(d["完成數量"]) || 0,
          points: parseFloat(d["點數"]) || 0,
        })));
      }

      if (monthlyRes.success && Array.isArray(monthlyRes.data)) {
        setMonthlyPoints(monthlyRes.data.map(m => ({
          userId: String(m["人員編號"] || ""),
          yearMonth: String(m["年月"] || ""),
          itemId: String(m["項目編號"] || ""),
          quantity: parseFloat(m["完成數量"]) || 0,
          points: parseFloat(m["點數"]) || 0,
          note: String(m["備註"] || ""),
        })));
      }
    } finally {
      setIsLoading(false);
    }
  }, [user?.email, selectedMonth]);

  useEffect(() => { fetchDataFromCloud(); }, [fetchDataFromCloud]);

  // ── 組裝邏輯 ────────────────────────────────────────────────
  const reports = useMemo(() => {
    return managedWorkers.map(worker => {
      // 1. 取得該角色的項目定義
      const workerDefs = pointDefs.filter(d => d.workerType === worker.workerType || d.workerType === "all");
      
      // 2. 組裝每一項目的數值
      const rows = workerDefs.map(def => {
        let qty = 0;
        let points = 0;
        let note = def.note;

        if (def.frequency === "每日") {
          const matched = dailyPoints.filter(d => d.userId === worker.userId && d.itemId === def.itemId);
          qty = matched.reduce((sum, m) => sum + m.quantity, 0);
          points = matched.reduce((sum, m) => sum + m.points, 0);
        } else {
          const matched = monthlyPoints.find(m => m.userId === worker.userId && m.itemId === def.itemId);
          if (matched) {
            qty = matched.quantity;
            points = matched.points;
            if (matched.note) note = matched.note;
          }
        }

        return {
          ...def,
          qty,
          points: Math.round(points),
          subtotal: Math.round(points)
        };
      }).sort((a, b) => a.category.localeCompare(b.category));

      // 3. 計算各類別合計
      const catA = rows.filter(r => r.category.startsWith("A")).reduce((s, r) => s + r.subtotal, 0);
      const catB = rows.filter(r => r.category.startsWith("B")).reduce((s, r) => s + r.subtotal, 0);
      const catC = rows.filter(r => r.category === "C").reduce((s, r) => s + r.subtotal, 0);
      const catD = rows.filter(r => r.category.startsWith("D")).reduce((s, r) => s + r.subtotal, 0);
      const catS = rows.filter(r => r.category === "S").reduce((s, r) => s + r.subtotal, 0);
      const catP = rows.filter(r => r.category === "P").reduce((s, r) => s + r.subtotal, 0);

      const totalWork = catA + catB + catC + catD;

      return {
        worker,
        rows,
        catA, catB, catC, catD, catS, catP,
        totalWork
      };
    });
  }, [managedWorkers, pointDefs, dailyPoints, monthlyPoints]);

  const proration = selectedMonth === "2026-04" ? 0.3 : (selectedMonth === "2027-06" ? 0.7 : 1.0);
  const prorationText = proration < 1.0 ? ` (已套用破月折算比例: ${proration})` : "";

  const handleExport = () => {
    const exportData = reports.map(r => ({
      workerId: r.worker.userId,
      workerName: r.worker.name,
      workerType: r.worker.workerType,
      area: r.worker.area,
      catA: r.catA, catB: r.catB, catC: r.catC, catD: r.catD,
      catS: r.catS, catP: r.catP,
      total: r.totalWork
    }));
    exportWorkSummaryReport(exportData, selectedMonth);
  };

  const isReadOnly = user?.role === "billing";

  return (
    <div className="space-y-6 relative min-h-[400px]">
      <LoadingOverlay isLoading={isLoading} />
      
      {/* 頂部操作列 */}
      <div className="flex items-center justify-between no-print bg-white p-4 rounded-2xl shadow-sm border border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
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
          <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 bg-slate-800 text-white hover:bg-slate-700">
            <Printer className="w-4 h-4" />列印報表
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="w-4 h-4" />匯出 Excel
          </Button>
        </div>
      </div>

      {/* 報表內容區 */}
      <div className="space-y-10">
        {reports.length === 0 && !isLoading && (
          <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-border">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">本月無相關工作紀錄資料</p>
          </div>
        )}

        {reports.map((report) => (
          <div key={report.worker.userId} className="bg-white rounded-xl shadow-elegant border border-border/50 p-10 max-w-[210mm] mx-auto min-h-[297mm] break-after-page print:p-0 print:shadow-none print:border-none">
            {/* 抬頭 */}
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold border-b-2 border-black inline-block px-8 pb-1 w-full text-center">亮軒企業有限公司</h1>
              <h2 className="text-lg font-bold mt-2">「115年度綜合施工處職安環保協助員量化工作」 工作月報表</h2>
            </div>

            {/* 基本資訊 */}
            <div className="grid grid-cols-3 gap-0 mb-4 text-sm font-bold border border-black border-b-0">
              <div className="border-r border-black p-2 flex items-center">姓名：<span className="font-mono">{report.worker.name}</span></div>
              <div className="border-r border-black p-2 flex items-center">部門：<span>{report.worker.department} ({report.worker.area})</span></div>
              <div className="p-2 flex items-center justify-end">統計月份：<span className="font-mono">{selectedMonth.replace("-", "/")}</span></div>
            </div>
            <div className="text-sm font-bold border border-black p-2 mb-4">
              人員類別：<span className="uppercase">{report.worker.workerType}</span>
            </div>

            {/* 表格 */}
            <table className="w-full border-collapse border border-black text-[11px]">
              <thead>
                <tr className="bg-gray-100 h-10 font-bold text-center">
                  <th className="border border-black w-10">項次</th>
                  <th className="border border-black w-12">類別</th>
                  <th className="border border-black px-2 text-left">工作項目名稱（含執行內容）</th>
                  <th className="border border-black w-14">單位</th>
                  <th className="border border-black w-16">點數</th>
                  <th className="border border-black w-16">執行數量</th>
                  <th className="border border-black w-24 text-right px-2">小計</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row, idx) => (
                  <tr key={row.itemId} className={cn("h-8", row.qty === 0 && "text-gray-400")}>
                    <td className="border border-black text-center">{idx + 1}</td>
                    <td className="border border-black text-center">{row.category}</td>
                    <td className="border border-black px-2 py-1 leading-tight">
                      <div className="font-bold">{row.name}</div>
                      {row.note && <div className="text-[9px] text-muted-foreground mt-0.5">{row.note}</div>}
                    </td>
                    <td className="border border-black text-center">{row.unit}</td>
                    <td className="border border-black text-center font-mono">{row.pointsPerUnit.toLocaleString()}</td>
                    <td className="border border-black text-center font-mono">{row.qty > 0 ? row.qty : "0"}</td>
                    <td className="border border-black text-right px-2 font-mono font-bold text-blue-900">
                      {row.subtotal > 0 ? row.subtotal.toLocaleString() : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* 點數合計 (不含罰款) */}
                <tr className="bg-blue-50/50 font-bold h-10 text-sm">
                  <td colSpan={6} className="border border-black text-right px-6 tracking-widest">
                    點數合計（不含罰款）：
                  </td>
                  <td className="border border-black text-right px-2 font-mono text-blue-700 font-black text-lg">
                    {report.totalWork.toLocaleString()}
                  </td>
                </tr>
                {/* 特休代付款 */}
                <tr className="h-8 font-bold">
                  <td colSpan={6} className="border border-black text-right px-6 text-xs">
                    特休代付款 (S)：
                  </td>
                  <td className="border border-black text-right px-2 font-mono text-amber-600">
                    {report.catS.toLocaleString()}
                  </td>
                </tr>
                {/* 懲罰性違約金 */}
                <tr className="h-8 font-bold text-red-600">
                  <td colSpan={6} className="border border-black text-right px-6 text-xs">
                    懲罰性違約金 (P)：
                  </td>
                  <td className="border border-black text-right px-2 font-mono">
                    -{report.catP.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* 頁尾加註 */}
            <div className="mt-4 text-[10px] text-muted-foreground space-y-1">
              <p>* 本報表點數資料直接串接 Google Sheets 原始紀錄進行即時組裝。{prorationText}</p>
              {proration < 1.0 && (
                <p className="text-red-500 font-bold">
                  ! 註：本月份執行天數較少，績效與月固定點數已依規定按比例 ({proration}) 折算。
                </p>
              )}
            </div>

            {/* 簽章區 */}
            <div className="mt-12 grid grid-cols-3 gap-4 text-center items-end">
              <div className="space-y-10">
                <div className="border-b border-black pb-1 mx-4"></div>
                <p className="font-bold text-sm">本人簽章</p>
              </div>
              <div className="space-y-10 relative">
                <div className="border-b border-black pb-1 mx-4"></div>
                <p className="font-bold text-sm">廠商核章</p>
              </div>
              <div className="space-y-10">
                <div className="border-b border-black pb-1 mx-4"></div>
                <p className="font-bold text-sm">用人部門核備</p>
                <p className="text-[10px] text-muted-foreground">(由用人部門主管核定)</p>
              </div>
            </div>
          </div>
        ))}
      </div>

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
