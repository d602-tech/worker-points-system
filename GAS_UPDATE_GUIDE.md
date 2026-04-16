# GAS 更新指引 v3.0

> v3.0 起採用**單一檔案架構**：`gas/Code.gs` 取代原本的 Init.gs / API.gs / DriveUpload.gs / TestAccounts.gs。

---

## 更新步驟

1. 前往 Google Apps Script 編輯器
2. 刪除所有舊檔案（Init.gs、API.gs、DriveUpload.gs、TestAccounts.gs）
3. 建立新檔案 `Code`，貼上 `gas/Code.gs` 全部內容
4. 儲存（Ctrl+S）
5. **部署 → 新增部署 → 網頁應用程式**
   - 執行身份：我
   - 存取：任何人
6. 複製新的 Web App URL
7. 若 URL 有變更，更新 GitHub Secret `GAS_WEB_APP_URL`

> ⚠️ 每次修改程式碼後必須「**新增部署**」，僅儲存不會更新已上線版本。

---

## 重要函式

| 函式 | 說明 | 何時執行 |
|---|---|---|
| `initAll()` | 建立 10 張分頁、種子資料 | 首次部署或 Schema 變更後 |
| `setupTestAccounts()` | 建立 8 個測試帳號（密碼 test1234） | 首次部署後 |
| `generateMonthlyAttendance(email, 'YYYY-MM')` | 產生當月預排差勤 | 每月月初 |
| `finalizeAttendance(email, 'YYYY-MM')` | 鎖定差勤 + 自動計算 S/P | 請款前 |

---

## v3.0 Schema 變更摘要（相較舊版）

| 項目 | 舊版 | v3.0 |
|---|---|---|
| 分頁數 | 8 張 | 10 張（新增月結快照、操作日誌） |
| 人員資料 | 工號、Email、帳號類型 | 人員編號、電子信箱、角色（English enum） |
| 差勤模型 | 事件式（假別+時數） | 每日一列（上午狀態 + 下午狀態） |
| 點數 ID 前綴 | G- / O- / S- / E- | GEN- / OFF- / SAF- / ENV- |
| 點數筆數 | 49 筆 | 51 筆 |
| 月度點數 | 每人每月一列彙總 | 每項目一列明細 |
| 審核動作 | approve / reject | 初審通過 / 退回修改 / 廠商確認 / 廠商退回 / 已請款 |

---

*v3.0 | 2026-04-13*
