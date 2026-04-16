# 115年度協助員點數管理系統

**綜合施工處職安環保協助員點數管理系統 v3.0**

> 技術棧：React 19 + Vite + TypeScript + Tailwind CSS v4 → GitHub Pages  
> 後端：Google Apps Script (單一 Code.gs) → Google Sheets + Google Drive

---

## 系統架構

```
瀏覽器（GitHub Pages）
    │  HTTPS fetch
    ▼
Google Apps Script Web App（Code.gs）
    ├── Google Sheets（10 張分頁）
    └── Google Drive（佐證資料夾）
```

**四種角色**

| 角色 | 說明 | 主要功能 |
|---|---|---|
| admin | 系統管理員 | 全部功能 + 初始化 + 人員管理 |
| deptMgr | 部門管理員 | 差勤管理、初審、部門報表 |
| billing | 請款人員 | 廠商確認、鎖定差勤、服務費報表 |
| worker | 協助員 | 今日任務填報、月報、佐證上傳 |

---

## 快速開始

### 一、初次部署（GAS 後端）

1. 開啟現有 Google Sheets → **擴充功能 → Apps Script**
2. 刪除所有舊檔案，新增檔案命名 `Code`
3. 貼上 `gas/Code.gs` 全部內容 → 儲存
4. 執行 `initAll()` → 授權 → 等待完成  
   ✓ Sheets 應出現 **10 張分頁**（見下方清單）
5. 執行 `setupTestAccounts()` → 建立 8 個測試帳號
6. **部署 → 新增部署 → 網頁應用程式**  
   執行身份：我 ／ 存取：任何人  
   複製 Web App URL

### 二、設定 GitHub Secrets

前往 `Settings → Secrets and variables → Actions`：

| Secret | 值 |
|---|---|
| `GAS_WEB_APP_URL` | 步驟一取得的 Web App URL（必填） |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID（選填） |
| `SPREADSHEET_ID` | Google Sheets ID（選填） |
| `DRIVE_FOLDER_ID` | Drive 資料夾 ID（由 initAll 自動建立，選填） |

### 三、部署前端

```bash
git push origin main
```

GitHub Actions 自動觸發 → 約 2 分鐘完成  
前往 `https://github.com/d602-tech/worker-points-system/actions` 確認

**系統 URL：** `https://d602-tech.github.io/worker-points-system/`

### 四、更新 GAS（程式碼有變更時）

1. 貼上新的 `gas/Code.gs` 內容
2. **部署 → 新增部署**（⚠️ 不是編輯現有部署）
3. 若 URL 有變更，更新 GitHub Secret `GAS_WEB_APP_URL`

---

## Google Sheets 分頁結構（v3.0）

| # | 分頁名稱 | 說明 |
|---|---|---|
| 1 | 系統設定 | 設定鍵 / 設定值 / 備註 |
| 2 | 人員資料 | 人員編號、姓名、電子信箱、角色、職務類型… |
| 3 | 差勤紀錄 | 人員編號、日期、上午狀態、下午狀態、有效工時… |
| 4 | 每日點數 | 紀錄編號、人員編號、日期、項目編號、完成數量… |
| 5 | 每月點數 | 紀錄編號、人員編號、年月、項目編號、績效等級… |
| 6 | 審核紀錄 | 審核動作、審核者、時間戳、變更明細 |
| 7 | 點數定義 | 51 筆（GEN-/OFF-/SAF-/ENV- 前綴） |
| 8 | 檔案索引 | 雲端檔案編號（Google Drive file ID） |
| 9 | 月結快照 | 廠商確認時自動產生（不可修改） |
| 10 | 操作日誌 | 所有寫入操作的稽核軌跡 |

---

## 點數定義（51 筆）

| 職務類型 | Enum | 項目前綴 | 筆數 |
|---|---|---|---|
| 一般工地協助員 | general | GEN- | 13 |
| 離島工地協助員 | offshore | OFF- | 13 |
| 職安業務兼管理員 | safety | SAF- | 12 |
| 環保業務人員 | environment | ENV- | 13 |

類別：A1（每日）/ A2（事件）/ B1/B2（每月）/ C（評核）/ D1/D2（環保）/ S（特休）/ P（違約金）

---

## 差勤狀態碼

| 碼 | 說明 | 有效工時 |
|---|---|---|
| `／` | 出勤 | 4h（上午或下午各計） |
| `代_姓名` | 代理出勤 | 4h |
| `特N` | 特休 N 小時 | 0h（計入特休時數） |
| `病N` / `事N` 等 | 各類請假 | 0h |
| `曠` | 曠職 | 0h |

---

## 審核流程

```
協助員送出  →  [已提交]
  部門管理員  →  初審通過  →  [dept_approved]
              →  退回修改  →  [rejected]
  請款人員    →  廠商確認  →  [billing_confirmed]（自動產生月結快照）
              →  廠商退回  →  [rejected]
              →  已請款    →  [billed]
```

---

## 本機開發

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

於「系統設定」頁面填入 GAS Web App URL 即可連線。

---

## 測試帳號（執行 setupTestAccounts 後）

| Email | 密碼 | 角色 | 職務類型 |
|---|---|---|---|
| admin@test.com | test1234 | admin | — |
| deptmgr@test.com | test1234 | deptMgr | — |
| billing@test.com | test1234 | billing | — |
| worker_gen@test.com | test1234 | worker | general |
| worker_off@test.com | test1234 | worker | offshore |
| worker_saf@test.com | test1234 | worker | safety |
| worker_env@test.com | test1234 | worker | environment |
| worker_test@test.com | test1234 | worker | general |

---

## GAS API 端點

### GET

| action | 參數 | 說明 |
|---|---|---|
| `ping` | — | 健康檢查 |
| `getMyProfile` | `callerEmail` | 取得登入使用者資料 |
| `getWorkers` | `callerEmail` | 取得人員列表 |
| `getPointDefs` | `workerType`（選） | 取得點數定義 |
| `getAttendance` | `callerEmail`, `workerId`, `yearMonth` | 取得差勤紀錄 |
| `getDailyPoints` | `callerEmail`, `workerId`, `date` | 取得每日點數 |
| `getMonthlyPoints` | `callerEmail`, `workerId`, `yearMonth` | 取得月度點數 |
| `getMonthlySnapshot` | `callerEmail`, `workerId`, `yearMonth` | 取得月結快照 |
| `getReviewList` | `callerEmail`, `status`（選）, `yearMonth`（選） | 取得審核列表 |
| `getConfig` | — | 取得系統設定 |

### POST (body: `{ action, ...params }`)

| action | 說明 |
|---|---|
| `passwordLogin` | 帳號密碼登入 |
| `upsertWorker` | 新增/更新人員 |
| `setWorkerPassword` | 設定密碼（Admin） |
| `generateAttendance` | 產生當月預排差勤（Admin） |
| `upsertAttendance` | 更新差勤紀錄 |
| `finalizeAttendance` | 鎖定差勤 + 觸發 S/P 計算（Billing/Admin） |
| `saveDailyPoints` | 儲存單筆每日點數 |
| `saveDailyPointsBatch` | 批次儲存每日點數 |
| `saveMonthlyPoints` | 儲存月度點數 |
| `submitMonthlyReport` | 送出月報（草稿→已提交） |
| `reviewMonthlyReport` | 審核（action2: 初審通過/退回修改/廠商確認/廠商退回/已請款） |
| `uploadFileToDrive` | 上傳佐證檔案（PDF/JPG/PNG） |
| `saveFileIndex` | 寫入檔案索引 |
| `updateConfig` | 更新系統設定（Admin） |

---

## 相關文件

- [DEPLOYMENT.md](DEPLOYMENT.md) — 完整建置與部署說明
- [CLAUDE.md](CLAUDE.md) — AI 開發規則
- OpenSpec 系統規格書 v3.0（本目錄）

---

*v3.0 | 2026-04-13 | 綜合施工處職安環保協助員點數管理系統*
