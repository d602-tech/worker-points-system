# 115年度協助員點數管理系統 — 建置與部署說明

> 本文件說明如何從零開始完整建置、設定並部署此系統。  
> 系統架構：React 19 + Express + tRPC（前後端）+ Google Sheets（資料庫）+ Google Drive（檔案存儲）+ GitHub（版本控制與部署）

---

## 目錄

1. [系統架構概覽](#1-系統架構概覽)
2. [前置準備](#2-前置準備)
3. [Google Sheets 初始化](#3-google-sheets-初始化)
4. [Google Apps Script 部署](#4-google-apps-script-部署)
5. [本機開發環境設定](#5-本機開發環境設定)
6. [GitHub 儲存庫建立與部署](#6-github-儲存庫建立與部署)
7. [系統設定頁面操作](#7-系統設定頁面操作)
8. [Google Sheets 分頁結構說明](#8-google-sheets-分頁結構說明)
9. [功能使用說明](#9-功能使用說明)
10. [常見問題排除](#10-常見問題排除)

---

## 1. 系統架構概覽

```
┌─────────────────────────────────────────────────────────────┐
│                     使用者端（瀏覽器）                        │
│                                                             │
│  手機端（Mobile-first）          桌面端（Admin Dashboard）   │
│  ┌──────────────────────┐       ┌──────────────────────┐   │
│  │ 今日任務 / 日曆總覽   │       │ 人員管理 / 差勤管理   │   │
│  │ 月報填報 / 個人資料   │       │ 審核中心 / 三種報表   │   │
│  └──────────────────────┘       └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Express + tRPC 後端                        │
│              (Manus 平台 / 自行部署 Node.js)                 │
└─────────────────────────────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Google Apps Script Web App                      │
│                  (GAS API 中介層)                            │
└──────────────┬──────────────────────────┬───────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────┐    ┌─────────────────────────────────┐
│    Google Sheets     │    │         Google Drive            │
│                      │    │                                 │
│  ・系統設定          │    │  115年度協助員點數管理系統/      │
│  ・人員名冊          │    │    ├── 2026-01/                 │
│  ・差勤紀錄          │    │    ├── 2026-02/                 │
│  ・每日點數明細      │    │    └── ...                      │
│  ・月度點數明細      │    │                                 │
│  ・審核紀錄          │    └─────────────────────────────────┘
│  ・點數定義表        │
│  ・佐證檔案索引      │
└──────────────────────┘
```

---

## 2. 前置準備

### 2.1 必要帳號與工具

| 項目 | 說明 |
|------|------|
| Google 帳號 | 用於 Google Sheets、Drive、Apps Script |
| GitHub 帳號 | 用於版本控制與部署 |
| Node.js 18+ | 本機開發環境 |
| pnpm | 套件管理工具（`npm install -g pnpm`） |

### 2.2 安裝 Node.js 與 pnpm

```bash
# 安裝 Node.js（建議使用 nvm）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# 安裝 pnpm
npm install -g pnpm
```

---

## 3. Google Sheets 初始化

### 3.1 建立新的 Google Sheets

1. 前往 [Google Sheets](https://sheets.google.com)
2. 建立新的試算表，命名為「**115年度協助員點數管理系統**」
3. 記下試算表的 **ID**（URL 中 `/d/` 與 `/edit` 之間的字串）

```
https://docs.google.com/spreadsheets/d/【這裡是 Sheet ID】/edit
```

### 3.2 執行初始化腳本

1. 在 Google Sheets 中，點選「**擴充功能**」→「**Apps Script**」
2. 刪除預設的 `function myFunction() {}` 程式碼
3. 複製 `gas/Init.gs` 的全部內容並貼上
4. 點選「**儲存**」（Ctrl+S）
5. 在函式選擇器中選擇 `initAll`，點選「**執行**」
6. 首次執行需授權 Google 帳號存取權限，請依提示完成授權
7. 執行完成後，試算表將自動建立 **8 張分頁** 並填入種子資料

> **預期結果：** 試算表中出現以下 8 個分頁：
> 系統設定、人員名冊、差勤紀錄、每日點數明細、月度點數明細、審核紀錄、點數定義表、佐證檔案索引

---

## 4. Google Apps Script 部署

### 4.1 部署為 Web App

1. 在 Apps Script 編輯器中，點選右上角「**部署**」→「**新增部署作業**」
2. 選擇類型：**網頁應用程式**
3. 設定如下：

| 設定項目 | 設定值 |
|----------|--------|
| 說明 | 115年度協助員點數管理系統 API v1 |
| 執行身份 | **我**（您的 Google 帳號） |
| 誰可以存取 | **任何人** |

4. 點選「**部署**」
5. 複製產生的 **Web App URL**（格式如下）：

```
https://script.google.com/macros/s/AKfycby.../exec
```

> **重要：** 此 URL 即為系統後端 API 的端點，請妥善保存。

### 4.2 測試 API 連線

在瀏覽器中開啟以下 URL，若回傳 JSON 則表示部署成功：

```
https://script.google.com/macros/s/【您的部署ID】/exec?action=ping
```

預期回應：
```json
{
  "status": "ok",
  "message": "GAS API 運作正常",
  "timestamp": "2026-04-09T..."
}
```

---

## 5. 本機開發環境設定

### 5.1 Clone 專案

```bash
git clone https://github.com/【您的帳號】/worker-points-system.git
cd worker-points-system
```

### 5.2 安裝相依套件

```bash
pnpm install
```

### 5.3 設定環境變數

複製環境變數範本：

```bash
cp .env.example .env
```

編輯 `.env` 填入必要設定：

```env
# Manus OAuth（由平台自動注入，本機開發可留空）
VITE_APP_ID=your_app_id
JWT_SECRET=your_jwt_secret

# Google Sheets 設定（可透過系統設定頁面設定，也可在此預設）
VITE_GAS_URL=https://script.google.com/macros/s/AKfycby.../exec
VITE_SHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
VITE_DRIVE_FOLDER_ID=1abc123def456...
```

### 5.4 啟動開發伺服器

```bash
pnpm dev
```

開啟瀏覽器前往 `http://localhost:3000`

---

## 6. GitHub 儲存庫建立與部署

### 6.1 建立 GitHub 儲存庫

```bash
# 初始化 Git
git init
git add .
git commit -m "feat: 初始化 115年度協助員點數管理系統"

# 在 GitHub 建立新儲存庫（使用 GitHub CLI）
gh repo create worker-points-system --private --push --source=.

# 或手動建立後推送
git remote add origin https://github.com/【您的帳號】/worker-points-system.git
git branch -M main
git push -u origin main
```

### 6.2 設定 GitHub Secrets

前往 GitHub 儲存庫 → Settings → Secrets and variables → Actions，新增以下 Secrets：

| Secret 名稱 | 說明 |
|-------------|------|
| `VITE_GAS_URL` | GAS Web App URL |
| `VITE_SHEET_ID` | Google Sheets ID |
| `VITE_DRIVE_FOLDER_ID` | Google Drive 資料夾 ID |

### 6.3 建立 GitHub Actions 自動部署

建立 `.github/workflows/deploy.yml`：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 10

      - name: Install dependencies
        run: pnpm install

      - name: Build
        env:
          VITE_GAS_URL: ${{ secrets.VITE_GAS_URL }}
          VITE_SHEET_ID: ${{ secrets.VITE_SHEET_ID }}
          VITE_DRIVE_FOLDER_ID: ${{ secrets.VITE_DRIVE_FOLDER_ID }}
        run: pnpm build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist/public'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 6.4 啟用 GitHub Pages

1. 前往 GitHub 儲存庫 → Settings → Pages
2. Source 選擇「**GitHub Actions**」
3. 推送程式碼後，等待 Actions 完成部署
4. 部署完成後，系統將可透過以下 URL 存取：

```
https://【您的帳號】.github.io/worker-points-system/
```

> **注意：** GitHub Pages 為靜態網站，僅適合前端展示。若需完整後端功能（tRPC、資料庫），請使用 Manus 平台部署或其他 Node.js 主機服務（如 Railway、Render）。

---

## 7. 系統設定頁面操作

部署完成後，請依以下步驟完成系統設定：

1. 以管理員身份登入系統
2. 前往「**管理端**」→「**系統設定**」→「**API 連線**」分頁
3. 填入以下資訊：

| 欄位 | 說明 | 範例 |
|------|------|------|
| GAS Web App URL | 步驟 4.1 取得的 URL | `https://script.google.com/macros/s/.../exec` |
| Google Sheets ID | 步驟 3.1 取得的 ID | `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms` |
| Google Drive 資料夾 ID | 步驟 3.2 自動建立的 ID | `1abc123def456...` |

4. 點選「**測試連線**」確認 GAS API 正常運作
5. 點選「**儲存設定**」

---

## 8. Google Sheets 分頁結構說明

### 分頁一：系統設定

| 欄位 | 說明 |
|------|------|
| 設定項目 | 設定名稱 |
| 設定值 | 設定內容 |
| 說明 | 備註說明 |

### 分頁二：人員名冊

| 欄位 | 說明 |
|------|------|
| 工號 | 唯一識別碼（如 W001） |
| 姓名 | 協助員姓名 |
| Email | 電子郵件 |
| 部門 | 所屬部門 |
| 服務區域 | 大潭/林口/通霄/總部 |
| 協助員類型 | 一般工地/機電/行政 |
| 到職日期 | YYYY-MM-DD |
| 離職日期 | YYYY-MM-DD（在職者留空） |
| 狀態 | 在職/離職/停職 |
| 小計經驗天數 | 到職前累計天數 |

### 分頁三：差勤紀錄

記錄每日差勤狀態，假別包含：上班、特休、病假、事假、婚假、喪假、公假、代理、曠職。

### 分頁四：每日點數明細

每筆工作項目的點數記錄，含審核狀態流轉：草稿 → 已送出 → 已通過/已退回。

### 分頁五：月度點數明細

每月彙總統計，含各類別點數小計與服務費換算。

### 分頁六：審核紀錄

完整審核歷程，包含審核人、審核時間、退回原因等。

### 分頁七：點數定義表

共 51 筆預設點數定義，涵蓋 A/B/C/D/S/P 六大類別。

### 分頁八：佐證檔案索引

記錄所有上傳至 Google Drive 的佐證檔案資訊。

---

## 9. 功能使用說明

### 9.1 協助員手機端

**今日任務**
- 勾選當日完成的工作項目
- 點擊「上傳佐證」可上傳照片（支援 HEIC 自動轉 JPEG）
- 完成後點選「送出月報」提交審核

**日曆總覽**
- 月曆視圖顯示每日工作狀態
- 彩色圓點代表不同審核狀態
- 點擊日期可查看當日明細

**月報填報**
- 查看當月工作量統計
- 確認各類別點數加總
- 提交月報前可預覽完整清單

**個人資料**
- 查看個人基本資訊
- 查看累計點數與服務費
- 修改個人設定

### 9.2 管理端桌面介面

**人員管理**
- 新增、編輯、查詢協助員資料
- 依部門、區域、類型篩選
- 匯出人員名冊 Excel

**差勤管理**
- 月曆視圖點擊格子編輯差勤
- 支援假別：上班/特休/病假/事假/婚假/喪假/公假/代理/曠職/清除
- 時數選擇：1h/2h/3h/4h/8h
- 代理假需填入代理人姓名

**審核中心**
- 查看待審核項目
- 點擊「通過」或「退回」
- 退回時需填寫退回原因（協助員可見）

**報表匯出**
- 工作量彙總表：各人月度點數統計
- 出勤暨特休統計表：假別天數統計
- 服務費統計表：點數換算服務費

---

## 10. 常見問題排除

### Q1：GAS 連線測試失敗

**可能原因：**
- Web App 未正確部署（執行身份或存取權限設定錯誤）
- URL 複製不完整
- 網路防火牆阻擋

**解決方式：**
1. 確認 Web App 設定：執行身份「我」、存取「任何人」
2. 重新部署並取得新 URL
3. 在瀏覽器直接開啟 URL 測試

### Q2：初始化後分頁未出現

**可能原因：**
- 腳本執行未完成
- 授權未完成

**解決方式：**
1. 查看 Apps Script 執行記錄（檢視 → 記錄）
2. 確認所有 Google 服務授權已完成
3. 重新執行 `initAll()`

### Q3：佐證檔案上傳失敗

**可能原因：**
- Drive 資料夾 ID 未設定
- GAS 未取得 Drive 存取權限

**解決方式：**
1. 確認系統設定中的 Drive 資料夾 ID 正確
2. 在 Apps Script 中手動執行 `createDriveFolders()` 重新建立資料夾
3. 確認 GAS 已授權 Drive 存取

### Q4：GitHub Pages 部署後頁面空白

**可能原因：**
- 靜態資源路徑問題
- 環境變數未設定

**解決方式：**
在 `vite.config.ts` 中設定正確的 base 路徑：

```typescript
export default defineConfig({
  base: '/worker-points-system/',
  // ...
})
```

---

## 附錄：GAS API 端點列表

| 方法 | action 參數 | 說明 |
|------|------------|------|
| GET | `ping` | 測試連線 |
| GET | `getWorkers` | 取得人員名冊 |
| GET | `getPointDefs` | 取得點數定義 |
| GET | `getAttendance` | 取得差勤紀錄（需 workerId, month） |
| GET | `getDailyPoints` | 取得每日點數（需 workerId, date） |
| GET | `getMonthlyPoints` | 取得月度點數（需 workerId, month） |
| GET | `getConfig` | 取得系統設定 |
| POST | `saveAttendance` | 儲存差勤紀錄 |
| POST | `saveDailyPoints` | 儲存每日點數 |
| POST | `submitMonthlyReport` | 送出月報 |
| POST | `reviewItem` | 審核項目 |
| POST | `saveFileIndex` | 儲存檔案索引 |
| POST | `upsertWorker` | 新增/更新人員 |

---

*本文件版本：v1.0.0 | 建立日期：2026-04-09 | 115年度協助員點數管理系統*
