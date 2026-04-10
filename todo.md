# 115年度協助員點數管理系統 TODO

## 基礎架構
- [x] 初始化 Web 應用程式專案
- [x] 設計系統全域 CSS（elegant and perfect 風格）
- [x] 建立 Drizzle Schema（系統設定、人員、差勤、點數等）
- [x] 建立 tRPC 路由（auth、users、attendance、points、reports）
- [x] Google Sheets API 整合層（CRUD helpers）
- [x] Google Drive API 整合層（檔案上傳、索引）

## 協助員手機端（Mobile-first）
- [x] 底部導覽列元件（BottomNav）
- [x] 今日任務頁（TodayTasks）：卡片式工作項目、勾選、佐證上傳
- [x] 日曆總覽頁（CalendarOverview）：月曆格子、狀態圖示、月度統計
- [x] 月報填報頁（MonthlyReport）：B/C/D 類週月填報
- [x] 個人資料頁（Profile）：點數摘要、離線草稿管理、特休餘額
- [x] 差勤狀態自動連動（全天/半天/請假）
- [x] 補件提醒區（前7天未完成提醒）
- [x] 底部固定操作列（送出/查看/修改按鈕）

## 管理端桌面介面
- [x] 頂部 Tab 導覽列（AdminTabNav）
- [x] Tab 0 人員管理（/admin/users）：CRUD、過往年資、特休計算
- [x] Tab 1 差勤管理（/admin/attendance）：月曆點擊彈窗編輯
- [x] Tab 2 審核中心（/review）：工作月報表 + 審核流程
- [x] Tab 3 工作量彙總表（/reports/summary）
- [x] Tab 4 出勤暨特休統計表（/reports/leave）
- [x] Tab 5 服務費統計表（/reports/fee）
- [x] Tab 6 系統設定（/admin/config）
- [x] 差勤編輯彈窗（假別選擇、時數面板、代理人輸入）

## Google Sheets 整合
- [x] 8 張分頁 CRUD API（系統設定、人員名冊、差勤紀錄、每日點數明細、月度點數明細、審核紀錄、點數定義表、佐證檔案索引）
- [x] GAS API 代理路由（server 端）
- [x] Google OAuth 設定（Sheets + Drive 權限）

## Google Drive 整合
- [x] 佐證檔案上傳至指定 Drive 資料夾
- [x] HEIC 自動轉 JPEG（heic2any）
- [x] 多檔上傳 + 上傳進度條
- [x] 失敗自動重試（最多 2 次）
- [x] 圖片 Lightbox 預覽 + PDF 內嵌 viewer

## 離線草稿機制
- [x] IndexedDB 儲存勾選狀態與待上傳檔案 Blob
- [x] 500ms debounce 自動儲存
- [x] navigator.onLine 復網偵測
- [x] 復網後 Toast 提示上傳草稿
- [x] 衝突處理提示（線上已有更新版本）

## 審核流程
- [x] 四階段狀態流轉：草稿→已送出→初審→廠商確認
- [x] 退回項目紅框 + 退回原因顯示
- [x] 補充佐證（已送出狀態）
- [x] 撤回草稿功能（尚未初審時）

## 報表匯出
- [x] SheetJS xlsx 匯出（差勤統計表、工作月報表、工作量彙總表、出勤暨特休統計表、服務費統計表）
- [x] @media print CSS 列印支援
- [x] 中文大寫金額轉換（服務費統計表）

## RWD 響應式設計
- [x] 手機斷點（< 768px）：底部導覽卡片式
- [x] 平板斷點（768～1024px）：雙欄佈局
- [x] 桌面斷點（> 1024px）：Tab 表格式
- [x] A/B/C/D/S/P 類別色塊系統

## GAS 腳本與部署文件
- [x] Init.gs 初始化腳本（8 張分頁 + 51 筆種子資料 + Drive 資料夾）
- [x] GAS API 端點腳本（doGet/doPost）
- [x] GitHub 部署說明文件（DEPLOYMENT.md）
- [x] Google Sheets 設定說明

## GitHub 部署
- [x] 建立 GitHub 儲存庫（d602-tech/worker-points-system）
- [x] 推送完整程式碼至 main 分支
- [x] GitHub Actions 工作流程（deploy.yml）

## 問題修正（2026-04-10）
- [ ] Bug Fix: GAS API setHeader is not a function 錯誤修正
- [ ] Bug Fix: initAll 建立資料夾時缺少「佐證檔案」子資料夾邏輯
- [ ] Config Fix: 系統設定表補齊 GAS_WEB_APP_URL 欄位
- [ ] Data Setup: 四種角色共 49 筆點數定義資料寫入 Init.gs
- [ ] Frontend: TodayTasks 對應四種角色點數定義結構
- [ ] GitHub: 推送最新修正至 d602-tech/worker-points-system
