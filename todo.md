# 115年度協助員點數管理系統 TODO

## 基礎架構
- [x] 初始化 Web 應用程式專案
- [ ] 設計系統全域 CSS（elegant and perfect 風格）
- [ ] 建立 Drizzle Schema（系統設定、人員、差勤、點數等）
- [ ] 建立 tRPC 路由（auth、users、attendance、points、reports）
- [ ] Google Sheets API 整合層（CRUD helpers）
- [ ] Google Drive API 整合層（檔案上傳、索引）

## 協助員手機端（Mobile-first）
- [ ] 底部導覽列元件（BottomNav）
- [ ] 今日任務頁（TodayTasks）：卡片式工作項目、勾選、佐證上傳
- [ ] 日曆總覽頁（CalendarOverview）：月曆格子、狀態圖示、月度統計
- [ ] 月報填報頁（MonthlyReport）：B/C/D 類週月填報
- [ ] 個人資料頁（Profile）：點數摘要、離線草稿管理、特休餘額
- [ ] 差勤狀態自動連動（全天/半天/請假）
- [ ] 補件提醒區（前7天未完成提醒）
- [ ] 底部固定操作列（送出/查看/修改按鈕）

## 管理端桌面介面
- [ ] 頂部 Tab 導覽列（AdminTabNav）
- [ ] Tab 0 人員管理（/admin/users）：CRUD、過往年資、特休計算
- [ ] Tab 1 差勤管理（/admin/attendance）：月曆點擊彈窗編輯
- [ ] Tab 2 審核中心（/review）：工作月報表 + 審核流程
- [ ] Tab 3 工作量彙總表（/reports/summary）
- [ ] Tab 4 出勤暨特休統計表（/reports/leave）
- [ ] Tab 5 服務費統計表（/reports/fee）
- [ ] Tab 6 系統設定（/admin/config）
- [ ] 差勤編輯彈窗（假別選擇、時數面板、代理人輸入）

## Google Sheets 整合
- [ ] 8 張分頁 CRUD API（系統設定、人員名冊、差勤紀錄、每日點數明細、月度點數明細、審核紀錄、點數定義表、佐證檔案索引）
- [ ] GAS API 代理路由（server 端）
- [ ] Google OAuth 設定（Sheets + Drive 權限）

## Google Drive 整合
- [ ] 佐證檔案上傳至指定 Drive 資料夾
- [ ] HEIC 自動轉 JPEG（heic2any）
- [ ] 多檔上傳 + 上傳進度條
- [ ] 失敗自動重試（最多 2 次）
- [ ] 圖片 Lightbox 預覽 + PDF 內嵌 viewer

## 離線草稿機制
- [ ] IndexedDB 儲存勾選狀態與待上傳檔案 Blob
- [ ] 500ms debounce 自動儲存
- [ ] navigator.onLine 復網偵測
- [ ] 復網後 Toast 提示上傳草稿
- [ ] 衝突處理提示（線上已有更新版本）

## 審核流程
- [ ] 四階段狀態流轉：草稿→已送出→初審→廠商確認
- [ ] 退回項目紅框 + 退回原因顯示
- [ ] 補充佐證（已送出狀態）
- [ ] 撤回草稿功能（尚未初審時）

## 報表匯出
- [ ] SheetJS xlsx 匯出（差勤統計表、工作月報表、工作量彙總表、出勤暨特休統計表、服務費統計表）
- [ ] @media print CSS 列印支援
- [ ] 中文大寫金額轉換（服務費統計表）

## RWD 響應式設計
- [ ] 手機斷點（< 768px）：底部導覽卡片式
- [ ] 平板斷點（768～1024px）：雙欄佈局
- [ ] 桌面斷點（> 1024px）：Tab 表格式
- [ ] A/B/C/D/S/P 類別色塊系統

## GAS 腳本與部署文件
- [ ] Init.gs 初始化腳本（8 張分頁 + 51 筆種子資料 + Drive 資料夾）
- [ ] GAS API 端點腳本（doGet/doPost）
- [ ] GitHub 部署說明文件（README.md）
- [ ] Google Sheets 設定說明
