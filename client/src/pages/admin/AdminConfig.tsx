import { useState, useEffect } from "react";
import { Save, RefreshCw, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useGasAuthContext } from "@/lib/useGasAuth";
import { gasGet } from "@/lib/gasApi";

interface PointDef {
  code: string;
  category: string;
  name: string;
  points: number;
  unit: string;
}

const CAT_COLORS: Record<string, string> = {
  A: "bg-blue-100 text-blue-700 border-blue-200",
  B: "bg-amber-100 text-amber-700 border-amber-200",
  C: "bg-emerald-100 text-emerald-700 border-emerald-200",
  D: "bg-purple-100 text-purple-700 border-purple-200",
  S: "bg-red-100 text-red-700 border-red-200",
  P: "bg-pink-100 text-pink-700 border-pink-200",
};

export default function AdminConfig() {
  const { user } = useGasAuthContext();
  const [gasUrl, setGasUrl] = useState(localStorage.getItem("gas_url") || "");
  const [sheetId, setSheetId] = useState(localStorage.getItem("sheet_id") || "");
  const [driveFolderId, setDriveFolderId] = useState(localStorage.getItem("drive_folder_id") || "");
  const [pointRate, setPointRate] = useState(localStorage.getItem("point_rate") || "1.0");
  const [gasStatus, setGasStatus] = useState<"idle" | "ok" | "error">("idle");
  const [activeTab, setActiveTab] = useState<"connection" | "points" | "system">("connection");
  const [pointDefs, setPointDefs] = useState<PointDef[]>([]);

  // 1. 載入連線資訊與點數定義
  useEffect(() => {
    if (!user?.email) return;
    
    // 取得點數定義
    gasGet<any[]>("getPointDefs", { callerEmail: user.email }).then(res => {
      if (res.success && Array.isArray(res.data)) {
        setPointDefs(res.data.map(d => ({
          code: String(d["代碼"] || ""),
          category: String(d["類別"] || ""),
          name: String(d["項目名稱"] || ""),
          points: Number(d["基準點數"] || 0),
          unit: String(d["單位"] || "次"),
        })));
      }
    });

    // 取得系統設定
    gasGet<any>("getSystemConfig", { callerEmail: user.email }).then(res => {
      if (res.success && res.data) {
        setSheetId(res.data.sheetId || sheetId);
        setDriveFolderId(res.data.driveFolderId || driveFolderId);
        setPointRate(String(res.data.pointRate || pointRate));
      }
    });
  }, [user?.email]);

  const testConnection = async () => {
    if (!gasUrl) { toast.error("請先輸入 GAS Web App URL"); return; }
    try {
      const res = await fetch(`${gasUrl}?action=ping`);
      if (res.ok) { setGasStatus("ok"); toast.success("GAS 連線成功！"); }
      else { setGasStatus("error"); toast.error("GAS 回應異常"); }
    } catch {
      setGasStatus("error"); toast.error("無法連線 GAS，請檢查 URL");
    }
  };

  const saveSettings = () => {
    localStorage.setItem("gas_url", gasUrl);
    localStorage.setItem("sheet_id", sheetId);
    localStorage.setItem("drive_folder_id", driveFolderId);
    localStorage.setItem("point_rate", pointRate);
    toast.success("設定已儲存到本機");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">系統設定</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Google Sheets / Drive 連線設定與點數定義管理</p>
        </div>
        <Button className="bg-blue-700 hover:bg-blue-800 gap-1.5" onClick={saveSettings}>
          <Save className="w-4 h-4" />儲存設定
        </Button>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit">
        {(["connection", "points", "system"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={cn("px-4 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t === "connection" ? "API 連線" : t === "points" ? "點數定義" : "系統參數"}
          </button>
        ))}
      </div>

      {activeTab === "connection" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-elegant border border-border/50 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">後端 API 設定</h3>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">GAS Web App URL</label>
              <div className="flex gap-2">
                <Input value={gasUrl} onChange={e => setGasUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfy.../exec"
                  className="flex-1 text-sm font-mono" />
                <Button variant="outline" size="sm" onClick={testConnection} className="gap-1.5 whitespace-nowrap">
                  <RefreshCw className="w-3.5 h-3.5" />測試連線
                </Button>
              </div>
              {gasStatus !== "idle" && (
                <div className={cn("mt-2 flex items-center gap-1.5 text-xs",
                  gasStatus === "ok" ? "text-emerald-600" : "text-red-600")}>
                  {gasStatus === "ok" ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                  {gasStatus === "ok" ? "GAS 連線正常" : "GAS 連線失敗"}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Google Sheets ID</label>
              <Input value={sheetId} onChange={e => setSheetId(e.target.value)}
                placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                className="text-sm font-mono" />
              <p className="text-xs text-muted-foreground mt-1">從 Sheets URL 中取得：https://docs.google.com/spreadsheets/d/<span className="font-mono bg-muted px-1 rounded">[ID]</span>/edit</p>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Google Drive 資料夾 ID</label>
              <Input value={driveFolderId} onChange={e => setDriveFolderId(e.target.value)}
                placeholder="1abc123def456..."
                className="text-sm font-mono" />
            </div>

            <div className="pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground mb-2">快速連結</p>
              <div className="flex gap-2 flex-wrap">
                {sheetId && (
                  <a href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs hover:bg-emerald-100 transition-colors">
                    <ExternalLink className="w-3 h-3" />開啟 Google Sheets
                  </a>
                )}
                {driveFolderId && (
                  <a href={`https://drive.google.com/drive/folders/${driveFolderId}`} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs hover:bg-blue-100 transition-colors">
                    <ExternalLink className="w-3 h-3" />開啟 Google Drive
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "points" && (
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/40 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">點數定義表</h3>
            <span className="text-xs text-muted-foreground">共 {pointDefs.length} 項定義</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-muted-foreground uppercase text-left">
                  <th className="px-4 py-3">類別</th>
                  <th className="px-4 py-3">代碼</th>
                  <th className="px-4 py-3">項目名稱</th>
                  <th className="px-4 py-3 text-right">基準點數</th>
                  <th className="px-4 py-3">單位</th>
                </tr>
              </thead>
              <tbody>
                {pointDefs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">載入點數定義中...</td>
                  </tr>
                )}
                {pointDefs.map(p => (
                  <tr key={p.code} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", CAT_COLORS[p.category])}>
                        {p.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-blue-700">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-3 text-right font-black text-blue-700">{p.points.toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground">
            點數定義由 Google Sheets「點數定義表」分頁管理，修改後需重新同步
          </div>
        </div>
      )}

      {activeTab === "system" && (
        <div className="bg-white rounded-2xl shadow-elegant border border-border/50 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">系統參數</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">點數單價（元/點）</label>
              <Input value={pointRate} onChange={e => setPointRate(e.target.value)} type="number" step="0.001" className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">系統年度</label>
              <Input defaultValue="115" className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">機構名稱</label>
              <Input defaultValue="綜合施工處" className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">機構代碼</label>
              <Input defaultValue="CPC" className="text-sm" />
            </div>
          </div>
          <div className="pt-3 border-t border-border/40">
            <p className="text-xs text-muted-foreground">系統版本：v1.0.0 | 建置日期：2026-04-09</p>
          </div>
        </div>
      )}
    </div>
  );
}
