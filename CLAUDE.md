# CLAUDE.md — 協助員點數管理系統 AI 開發規則

## 📋 專案概覽

- **專案名稱**：115年度 綜合施工處職安環保協助員點數管理系統
- **技術棧**：React (GitHub Pages) + Google Apps Script (GAS) + Google Sheets + Google Drive
- **規格書**：OpenSpec v3.0（本規格書為唯一正式來源）
- **語言**：繁體中文（程式碼註解、Git commit、PR 描述皆使用繁體中文）

---

## 🚨 最高優先規則（違反即退回）

1. **點數定義不可更改**：51 筆點數定義（13.1~13.4）的項目編號、名稱、點數值均為契約內容，任何程式碼不得硬編碼修改這些數值。僅 Admin 可透過系統設定介面調整，且必須留存審核紀錄。

2. **四種身分名稱必須完整**：一般工地協助員、離島工地協助員、職安業務兼管理員、環保業務人員。不得自行簡化為「一般」、「離島」等縮寫。UI 顯示時必須使用完整名稱。

3. **工作項目名稱必須完整**：如「危害告知與高風險作業管制與監督」，不得簡化為「危害告知」。

4. **Google Sheets 欄位名稱使用繁體中文**：所有分頁名稱與欄位標頭必須使用 COLUMNS / SHEETS 常數中定義的繁體中文名稱，程式碼中透過常數引用，不得硬編碼中文字串。

5. **GAS 檔案架構**：目前採用多檔案分離架構（Init.gs / API.gs / DriveUpload.gs / TestAccounts.gs），以 `// ========== [區塊名稱] ==========` 分隔各功能模組。

---

## 📁 專案結構

```
📁 project-root/
├── CLAUDE.md                    # ← 本檔案（AI 必讀）
├── README.md                    # 專案說明
├── DEPLOYMENT.md                # 部署指南
├── GAS_UPDATE_GUIDE.md          # GAS 端更新指引
├── 📁 gas/                      # Google Apps Script
│   ├── Init.gs                  # 初始化 + 路由分發 (doGet/doPost)
│   ├── API.gs                   # API handler 輔助函式
│   ├── DriveUpload.gs           # Google Drive 檔案上傳
│   └── TestAccounts.gs          # 測試帳號建立
├── 📁 client/                   # React 前端（Vite 建置）
│   ├── index.html               # 入口 HTML（含 SPA 路由還原）
│   ├── 📁 public/               # 靜態資源
│   │   ├── manifest.json        # PWA 配置
│   │   └── 404.html             # GitHub Pages SPA fallback
│   └── 📁 src/
│       ├── App.tsx              # 路由設定
│       ├── main.tsx             # React 入口
│       ├── index.css            # Tailwind + 自訂樣式
│       ├── 📁 components/       # 共用元件
│       ├── 📁 pages/            # 頁面元件（對應路由）
│       │   ├── 📁 worker/       # 協助員手機端頁面
│       │   └── 📁 admin/        # 管理端桌面頁面
│       ├── 📁 layouts/          # 佈局元件
│       ├── 📁 contexts/         # React Context
│       ├── 📁 hooks/            # 自訂 Hooks
│       └── 📁 lib/              # 工具函式與 API 封裝
├── 📁 shared/                   # 前後端共用型別定義
│   └── domain.ts                # 業務領域型別 + 51 筆點數種子資料
├── 📁 .github/
│   └── 📁 workflows/
│       └── deploy.yml           # GitHub Pages 自動部署
└── package.json
```

---

## 🔧 程式碼規範

### GAS (Init.gs / API.gs)

- 函式命名：camelCase（如 `handleLogin`, `getDailyPoints`）
- 區塊順序：常數 → 路由 → 初始化 → 登入 → 使用者 → 差勤 → 點數 → 審核 → 報表 → 檔案 → 通知 → 遷移 → 日誌 → 設定 → 工具
- 所有 Sheet 操作必須透過 `SHEET_NAMES.XXX` 常數取得分頁名稱，不得硬編碼
- 錯誤處理：所有 API 端點必須 try-catch，回傳 `{ success, error?, data? }` 格式
- 併發控制：寫入操作必須使用 `LockService.getScriptLock()`
- 權限檢查：敏感端點需呼叫 `checkPermission(e, allowedRoles)`
- doGet / doPost 統一定義於 Init.gs，API.gs 僅包含 handler 輔助函式

### React 前端

- 框架：React 19 + TypeScript + Vite
- 樣式：Tailwind CSS v4（Mobile-First）
- 狀態管理：React Context + useGasAuth hook
- 路由：wouter（輕量 SPA 路由）
- API 層：統一封裝於 `src/lib/gasApi.ts`，自動帶入 callerEmail
- 認證：`src/lib/useGasAuth.ts` 提供 Google OAuth + 帳號密碼雙軌
- UI 元件庫：shadcn/ui (Radix UI) + lucide-react 圖示
- 表單驗證：前端驗證 + 後端二次驗證（雙重保護）
- 檔案上傳：僅接受 PDF/JPG/PNG，前端 MIME + 副檔名雙重檢查
- 圖片壓縮：上傳前自動壓縮至 1920px / 80% 品質
- 離線支援：localStorage 儲存草稿

---

## 🔒 安全規則

1. **永遠不要在前端暴露 Google Sheets ID 或 Drive Folder ID**（透過 GitHub Secrets 和 Vite 環境變數注入）
2. **密碼雜湊**：前端使用 Web Crypto API 的 SHA-256，GAS 端使用 `Utilities.computeDigest`
3. **Session 管理**：localStorage 存放使用者資訊，GAS 端透過 callerEmail 驗證身份
4. **角色權限**：後端每個端點必須檢查角色權限，前端隱藏按鈕不是安全措施
5. **檔案上傳**：後端必須二次驗證 MIME type，不信任前端
6. **輸入驗證**：所有輸入須做 sanitization

---

## 📊 業務邏輯規則

### 差勤計算
- 「／」= 出勤（4 小時）
- 「特N」= 特休 N 小時
- 「代_姓名」= 代理出勤（視同出勤）
- 半天出勤 = 各項 A1 × 0.5
- 連續缺勤緩衝期：一般/職安/環保 2 天、離島 3 天

### 點數計算
- A1 類：每日 × 出勤狀態
- A2 類：事件觸發（颱風假等）
- B1/B2 類：每月填報
- C 類：部門管理員評核（優/佳/平）
- D1/D2 類：環保專屬
- S 類：特休時數 × 單位點數（自動）
- P 類：連續缺勤超過緩衝期 → 每天罰 8h × 單位點數（自動）

### 審核流程
- 草稿 → 已提交 → 部門初審通過 → 廠商確認 → 已請款
- 任何退回都回到「已提交」狀態
- 廠商確認時自動產生月結快照

---

## 🧪 測試要求

1. **GAS 端**：每個 API 端點至少一個正常流程測試 + 一個權限拒絕測試
2. **前端**：關鍵計算邏輯（點數、差勤、違約金）必須有單元測試
3. **整合測試**：每個 Phase 完成後，執行完整的使用者流程測試
4. **遷移驗證**：遷移前後的數據總計必須完全一致

---

## 📝 Git 規範

- Commit 格式：`[Phase X] 功能描述`（如 `[Phase 0] 完成系統初始化腳本`）
- 分支策略：`main` (穩定版) / `dev` (開發中) / `feature/xxx` (功能開發)
- PR 必須包含：變更說明、測試結果截圖、影響範圍

---

## ⚠️ 常見陷阱提醒

1. **GAS doPost 只能回傳 TextOutput**：不能直接回傳 JSON 物件，必須用 `ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON)`
2. **GAS 時區**：所有日期處理使用 `Utilities.formatDate(date, 'Asia/Taipei', pattern)`
3. **Google Sheets 的 getRange 是 1-based**：不是 0-based
4. **CacheService 最大值 100KB**：Session 資料要精簡
5. **GAS Web App 更新後需重新部署**：每次修改 GAS 後必須「新增部署」而非只是儲存
6. **CORS**：GAS Web App 天然支援 CORS，前端必須使用 `fetch` 的 `redirect: 'follow'`
7. **Google OAuth redirect**：GitHub Pages 為 HTTPS，OAuth redirect URI 必須一致
8. **GitHub Pages SPA 路由**：需要 404.html 重導機制，已在 index.html 中實作
9. **Vite 環境變數**：必須以 `VITE_` 前綴命名才能在前端使用
10. **部署路徑**：GitHub Pages 子路徑 `/worker-points-system/`，透過 `VITE_BASE_URL` 設定

---

## 🏗️ 部署架構

```
┌─────────────────┐     HTTPS API      ┌──────────────────┐
│   GitHub Pages  │ ◄─── fetch ────►   │  Google Apps     │
│   (React SPA)   │                    │  Script Web App  │
│                 │                    │                  │
│  - 靜態 HTML/JS │                    │  - doGet/doPost  │
│  - PWA 支援     │                    │  - Google Sheets │
│  - 手機優先 RWD │                    │  - Google Drive  │
└─────────────────┘                    └──────────────────┘
```

### GitHub Secrets（部署需要設定）
- `GAS_WEB_APP_URL` → VITE_GAS_URL
- `SPREADSHEET_ID` → VITE_SHEET_ID
- `DRIVE_FOLDER_ID` → VITE_DRIVE_FOLDER_ID
- `GOOGLE_CLIENT_ID` → VITE_GOOGLE_CLIENT_ID
