# 115年度協助員點數管理系統 — 完整部署說明 v3.0

> **架構：** React 19 (GitHub Pages) + Google Apps Script (單一 Code.gs) + Google Sheets + Google Drive  
> **版本：** v3.0（OpenSpec v3.0 對齊版）

---

## 目錄

1. [前置準備](#1-前置準備)
2. [Google Sheets 建立](#2-google-sheets-建立)
3. [GAS 部署](#3-gas-部署)
4. [GitHub 設定](#4-github-設定)
5. [前端部署](#5-前端部署)
6. [系統驗證](#6-系統驗證)
7. [日常維護](#7-日常維護)
8. [常見問題](#8-常見問題)

---

## 1. 前置準備

### 必要工具

| 項目 | 需求 | 取得方式 |
|---|---|---|
| Google 帳號 | Sheets + Drive + Apps Script 存取 | — |
| GitHub 帳號 | 版本控制與 Pages 部署 | github.com |
| Node.js 18+ | 本機開發（選用） | nodejs.org |
| pnpm | 套件管理（選用） | `npm i -g pnpm` |

---

## 2. Google Sheets 建立

### 2.1 建立新試算表

1. 前往 [Google Sheets](https://sheets.google.com) → 新增試算表
2. 命名：`115年度協助員點數管理系統`
3. 記錄 **試算表 ID**（URL 中 `/d/` 與 `/edit` 之間的字串）

### 2.2 開啟 Apps Script

1. 試算表上方 → **擴充功能 → Apps Script**
2. 預設的 `Code.gs` 可保留，接下來步驟 3 會處理

---

## 3. GAS 部署

### 3.1 上傳 Code.gs

1. 在 Apps Script 編輯器左側，刪除所有現有檔案（Init.gs、API.gs 等）
2. 新增檔案 → 命名 `Code`（自動加 .gs 副檔名）
3. 複製專案中 `gas/Code.gs` 的**全部內容**貼入
4. `Ctrl+S` 儲存

### 3.2 執行初始化

1. 頂部函式選單選擇 **`initAll`** → 點「執行」
2. 首次執行需授權：Google Sheets + Google Drive + Gmail
3. 等待約 30–60 秒，執行完成後會彈出確認視窗

**確認 Google Sheets 出現以下 10 張分頁：**

| 分頁 | 說明 |
|---|---|
| 系統設定 | 設定鍵 / 設定值 / 備註 |
| 人員資料 | 人員編號、電子信箱、角色、職務類型… |
| 差勤紀錄 | 日期、上午狀態、下午狀態、有效工時… |
| 每日點數 | 紀錄編號、項目編號、完成數量、狀態… |
| 每月點數 | 年月、項目編號、績效等級、狀態… |
| 審核紀錄 | 審核動作、審核者、時間戳… |
| 點數定義 | 51 筆（GEN-/OFF-/SAF-/ENV- 前綴，8 欄） |
| 檔案索引 | 雲端檔案編號（Drive file ID）… |
| 月結快照 | 廠商確認時自動產生 |
| 操作日誌 | 全系統操作稽核軌跡 |

**確認「點數定義」分頁：** 51 筆，項目編號格式 `GEN-A1-01` / `OFF-A1-01` / `SAF-A1-01` / `ENV-A1-01`

### 3.3 建立測試帳號

函式選單選 **`setupTestAccounts`** → 執行

預設密碼：`test1234`（SHA-256 雜湊後儲存）

| Email | 角色 | 職務類型 |
|---|---|---|
| admin@test.com | admin | safety |
| deptmgr@test.com | deptMgr | safety |
| billing@test.com | billing | safety |
| worker_gen@test.com | worker | general |
| worker_off@test.com | worker | offshore |
| worker_saf@test.com | worker | safety |
| worker_env@test.com | worker | environment |
| worker_test@test.com | worker | general |

### 3.4 部署為 Web App

1. 右上角 → **「部署」→「新增部署」**
2. 類型選「**網頁應用程式**」
3. 設定：

| 項目 | 設定值 |
|---|---|
| 說明 | 115年度協助員點數管理系統 v3.0 |
| 執行身份 | **我**（您的 Google 帳號） |
| 誰可以存取 | **任何人** |

4. 點「部署」→ **複製 Web App URL**

```
https://script.google.com/macros/s/【部署ID】/exec
```

### 3.5 驗證 GAS 連線

瀏覽器開啟以下 URL，應回傳 JSON：

```
https://script.google.com/macros/s/【部署ID】/exec?action=ping
```

預期回應：
```json
{ "status": "ok", "message": "GAS API 運作正常", "version": "3.0.0" }
```

---

## 4. GitHub 設定

### 4.1 GitHub Secrets

前往儲存庫 → **Settings → Secrets and variables → Actions** → 新增：

| Secret 名稱 | 說明 | 必填 |
|---|---|---|
| `GAS_WEB_APP_URL` | 步驟 3.4 取得的 Web App URL | ✓ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | 選填 |
| `SPREADSHEET_ID` | Google Sheets ID | 選填 |
| `DRIVE_FOLDER_ID` | Drive 佐證資料夾 ID（initAll 輸出） | 選填 |

> `GAS_WEB_APP_URL` 未設定時，前端仍可部署，但使用者需在「系統設定」頁面手動填入。

### 4.2 啟用 GitHub Pages

1. Settings → **Pages**
2. Source 選「**GitHub Actions**」
3. 儲存

---

## 5. 前端部署

### 5.1 推送觸發自動部署

```bash
git push origin main
```

GitHub Actions 執行流程（約 2–3 分鐘）：
1. Checkout → Setup Node.js 18 + pnpm 10
2. `pnpm install`
3. `pnpm vite build`（注入環境變數）
4. 上傳 `dist/public/` → 部署至 GitHub Pages

**監控：** `https://github.com/d602-tech/worker-points-system/actions`

### 5.2 系統 URL

```
https://d602-tech.github.io/worker-points-system/
```

### 5.3 本機開發

```bash
git clone https://github.com/d602-tech/worker-points-system.git
cd worker-points-system
pnpm install
pnpm dev   # http://localhost:5173
```

登入後前往「系統設定」頁面 → 填入 GAS Web App URL → 測試連線。

---

## 6. 系統驗證

依序完成以下測試：

### 6.1 基礎連線

- 前端載入正常（無白畫面）
- 系統設定頁面 → 輸入 GAS URL → 測試連線 → 顯示 `ok v3.0.0`

### 6.2 登入測試（四種角色）

| 測試帳號 | 預期結果 |
|---|---|
| admin@test.com | 看到完整管理選單 |
| deptmgr@test.com | 看到差勤管理、審核中心 |
| billing@test.com | 看到廠商確認、報表 |
| worker_gen@test.com | 看到今日任務（GEN- 項目）|
| worker_env@test.com | 看到今日任務（ENV- 項目）|

### 6.3 協助員完整流程

1. `worker_gen@test.com` 登入 → 今日任務
2. 勾選項目 → 上傳 PDF/JPG 佐證 → 送出
3. 月報頁面 → 填寫 B1 項目 → 送出月報

### 6.4 審核流程 + 月結快照

1. `deptmgr@test.com` → 審核中心 → 「初審通過」
2. `billing@test.com` → 審核中心 → 「廠商確認」
3. Google Sheets「月結快照」分頁 → 確認自動產生一筆記錄

### 6.5 差勤管理

1. admin 登入 → 差勤管理
2. 點擊格子 → 設定上午狀態 `特4`、下午狀態 `／` → 儲存
3. Google Sheets「差勤紀錄」分頁 → 確認上午狀態、有效工時 = 4、特休時數 = 4

---

## 7. 日常維護

### 每月開始

```
Admin → 差勤管理 → 執行「產生當月預排差勤」（generateMonthlyAttendance）
```

### GAS 程式碼更新

1. Apps Script 編輯器 → 貼上新版 `gas/Code.gs`
2. **部署 → 新增部署**（不是編輯現有）
3. 若 URL 有變更 → 更新 GitHub Secret `GAS_WEB_APP_URL`

> ⚠️ 僅儲存不會更新已部署版本，**每次修改必須「新增部署」**

### 前端更新

```bash
git push origin main   # Actions 自動部署
```

### 資料備份

定期下載 Google Sheets 為 .xlsx 格式存檔。

---

## 8. 常見問題

### GAS 連線測試失敗

**原因：** Web App 未正確部署 / URL 不完整 / 存取設定錯誤  
**解決：**
1. 確認 Web App 設定：執行身份「我」、存取「任何人」
2. 重新「新增部署」取得新 URL
3. 瀏覽器直接開啟 URL?action=ping 測試

### GitHub Actions Build 失敗

**解決：**
1. 點選 Actions → 查看失敗步驟的錯誤訊息
2. 常見原因：pnpm-lock.yaml 版本不符 → 本機執行 `pnpm install` 後重新推送

### 初始化後分頁未出現

**解決：**
1. Apps Script → 檢視 → 執行記錄
2. 確認 Google 授權（Sheets + Drive）已完成
3. 重新執行 `initAll()`（已有資料的分頁會跳過，不會覆寫）

### 佐證上傳失敗

**解決：**
1. 確認 `gas/Code.gs` 已正確部署
2. 系統設定 → Drive 資料夾 ID 已填入（或重新執行 `createDriveFolders()`）
3. 只接受 PDF / JPG / PNG，其他格式會被後端拒絕

### 月結快照未產生

**解決：**
確認審核動作使用的是「廠商確認」（不是「初審通過」），月結快照只在廠商確認時自動觸發。

---

*v3.0 | 2026-04-13 | 115年度協助員點數管理系統*
