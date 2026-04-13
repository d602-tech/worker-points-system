import { cn } from "@/lib/utils";
import { CheckCircle2, Wrench, Plus, ArrowUpCircle, BookOpen, FileText } from "lucide-react";

// ============================================================
// 型別
// ============================================================

type ChangeType = "fix" | "new" | "improve" | "rule" | "export" | "note";

interface ChangeEntry {
  type: ChangeType;
  text: string;
}

interface VersionRecord {
  version: string;
  date: string;
  title: string;
  entries: ChangeEntry[];
}

// ============================================================
// 資料
// ============================================================

const VERSIONS: VersionRecord[] = [
  {
    version: "v3.1",
    date: "2026-04-14",
    title: "1140413 第2次修正",
    entries: [
      { type: "fix",     text: "Bug：每日任務上傳後記錄消失（根本原因：blob 從未實際寫入 Google Drive，修正為先 uploadFileToDrive → saveFileIndex → saveDailyPointsBatch 正確循序）" },
      { type: "new",     text: "日曆總覽串接真實 API（getAttendance），依差勤狀態推導色點，月份切換自動重新載入" },
      { type: "new",     text: "歷史紀錄 Bottom Drawer：點擊任意日期顯示差勤 AM/PM、工作項目列表、已上傳佐證檔案連結" },
      { type: "new",     text: "協助員請假功能：選擇時段（全天/上午/下午）+ 假別（特休/病假/事假/婚假/喪假/公假）+ 上傳假單佐證 → 寫入 upsertAttendance" },
      { type: "improve", text: "人員新增/編輯表單：部門欄位改為 8 個選項下拉、服務區域改為 7 個選項下拉（處本部/大潭/通霄/興達/大林/金門/琉球）" },
      { type: "improve", text: "區域自動連動職務類型：金門/琉球 → 離島工地協助員（唯讀）；大潭等本島 → 一般工地協助員（唯讀）；處本部 → 顯示職安/環保兩個選項" },
      { type: "improve", text: "小計經驗天數：支援多筆起迄區間，各區間可各自上傳佐證，加總自動填入 pastExpDays，明細以 JSON 存入 pastExpDetail 欄位" },
      { type: "rule",    text: "計價單位全面改為「元」（1點=1元），修正 POINT_RATE = 1，影響 ReportFee、exportExcel、MonthlyReport、ReportSummary" },
      { type: "rule",    text: "月報每個 B1/B2 項目各限送出一次，填報數量後須上傳至少一個佐證文件，未附檔時送出按鈕 disabled" },
      { type: "rule",    text: "月報退回後（status = rejected）解除鎖定，允許重新填報與重新上傳佐證" },
      { type: "export",  text: "PDF 列印強化：@media print 補充 A4 頁面設定、隱藏導覽列與按鈕、強制表格框線、保留狀態標籤底色" },
      { type: "new",     text: "GAS Code.gs 新增 COLUMNS.USERS.PAST_EXP_DETAIL 欄位，upsertWorker 與 setupTestAccounts 同步更新" },
      { type: "new",     text: "gasApi.ts 補充三個函式：uploadFileToDrive / saveFileIndex / getFileIndexByDate" },
      { type: "new",     text: "更新歷程頁面（本頁面），僅 Admin 可見，側邊欄新增「更新歷程」tab" },
    ],
  },
  {
    version: "v3.0",
    date: "2026-04-13",
    title: "1140413 第1次修正",
    entries: [
      { type: "improve", text: "GAS 後端合併為單一 Code.gs 架構，移除 Init.gs / API.gs / DriveUpload.gs / TestAccounts.gs 多檔案結構" },
      { type: "rule",    text: "Schema 完整對齊 OpenSpec v3.0：角色欄位改為 admin/deptMgr/billing/worker、職務類型改為 general/offshore/safety/environment" },
      { type: "rule",    text: "點數 ID 前綴由 G-/O-/S-/E- 統一改為 GEN-/OFF-/SAF-/ENV-" },
      { type: "improve", text: "差勤改為 AM/PM 每日模型（amStatus / pmStatus），取代舊的單一 status 欄位" },
      { type: "improve", text: "前端所有欄位名稱對齊規格書：人員編號/電子信箱/角色/職務類型/所屬部門/服務區域" },
      { type: "improve", text: "CLAUDE.md 更新：修正 GAS 架構說明、補充 Schema enum 規則（第5、6條最高優先規則）" },
    ],
  },
  {
    version: "v2.x",
    date: "2026-03 ～ 2026-04",
    title: "Phase 1～4 初版功能",
    entries: [
      { type: "new",     text: "React 前端建置（Vite + TypeScript + Tailwind CSS v4 + wouter）" },
      { type: "new",     text: "手機端：今日任務填報（TodayTasks）、月報填報（MonthlyReport）、個人資料（Profile）" },
      { type: "new",     text: "管理端：人員管理、差勤管理、審核中心、工作量彙總、出勤暨特休、服務費統計、系統設定" },
      { type: "new",     text: "GAS Web App 後端：人員 CRUD、差勤、點數、審核、報表、檔案上傳 API" },
      { type: "new",     text: "Google OAuth + 帳號密碼雙軌登入，SHA-256 密碼雜湊" },
      { type: "export",  text: "Excel 匯出：工作月報、工作量彙總、服務費統計、出勤統計" },
      { type: "new",     text: "GitHub Pages 自動部署（deploy.yml），GitHub Secrets 注入環境變數" },
    ],
  },
];

// ============================================================
// 常數
// ============================================================

const TYPE_CONFIG: Record<ChangeType, { icon: typeof CheckCircle2; label: string; cls: string }> = {
  fix:     { icon: Wrench,         label: "修",  cls: "bg-red-100 text-red-700 border-red-200"     },
  new:     { icon: Plus,           label: "新",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  improve: { icon: ArrowUpCircle,  label: "改",  cls: "bg-blue-100 text-blue-700 border-blue-200"  },
  rule:    { icon: BookOpen,       label: "規",  cls: "bg-orange-100 text-orange-700 border-orange-200" },
  export:  { icon: FileText,       label: "出",  cls: "bg-purple-100 text-purple-700 border-purple-200" },
  note:    { icon: CheckCircle2,   label: "注",  cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const VERSION_COLORS: string[] = [
  "border-l-blue-600",
  "border-l-slate-500",
  "border-l-slate-300",
];

// ============================================================
// 元件
// ============================================================

export default function Changelog() {
  return (
    <div className="max-w-3xl space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-foreground">更新歷程</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          系統版本記錄 — 115年度協助員點數管理系統
        </p>
      </div>

      {/* Type legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(TYPE_CONFIG) as [ChangeType, (typeof TYPE_CONFIG)[ChangeType]][]).map(
          ([, cfg]) => (
            <span
              key={cfg.label}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border",
                cfg.cls,
              )}
            >
              <cfg.icon className="w-3 h-3" />
              {cfg.label}
            </span>
          ),
        )}
        <span className="text-xs text-muted-foreground self-center ml-1">
          修=修復 / 新=新功能 / 改=改進 / 規=業務規則 / 出=匯出/列印
        </span>
      </div>

      {/* Timeline */}
      <div className="space-y-8">
        {VERSIONS.map((ver, idx) => (
          <div
            key={ver.version}
            className={cn(
              "bg-white rounded-2xl shadow-elegant border-l-4 border border-border/50 overflow-hidden",
              VERSION_COLORS[idx] ?? "border-l-slate-200",
            )}
          >
            {/* Version header */}
            <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={cn(
                  "text-lg font-black tabular-nums",
                  idx === 0 ? "text-blue-700" : "text-slate-500",
                )}>
                  {ver.version}
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{ver.title}</div>
                  <div className="text-xs text-muted-foreground">{ver.date}</div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {ver.entries.length} 項變更
              </span>
            </div>

            {/* Entries */}
            <ul className="divide-y divide-border/30">
              {ver.entries.map((entry, ei) => {
                const cfg = TYPE_CONFIG[entry.type];
                return (
                  <li key={ei} className="flex items-start gap-3 px-6 py-3 hover:bg-muted/20 transition-colors">
                    <span className={cn(
                      "flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black border",
                      cfg.cls,
                    )}>
                      {cfg.label}
                    </span>
                    <span className="text-sm text-foreground leading-relaxed">{entry.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="text-xs text-muted-foreground pb-4">
        規格書來源：OpenSpec v3.0（唯一正式來源）／ 系統版本由 AI 輔助開發，所有業務邏輯以規格書為準。
      </div>
    </div>
  );
}
