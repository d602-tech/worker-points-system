# GAS 端更新指引 — v3.0 對齊

本文件說明需要在 Google Apps Script 編輯器中手動更新的項目。
前端已更新完成，以下為後端 GAS 需配合的變更。

---

## 1. Init.gs — 新增 `saveDailyPointsBatch` action

在 `doPost` 函式的 `switch (action)` 中，新增以下 case：

```javascript
      case "saveDailyPointsBatch":
        data = saveDailyPointsBatch(body);
        break;
```

然後在 Init.gs 底部（`uploadFileToDrive` 函式之前）新增以下函式：

```javascript
// ============================================================
// 批次儲存每日點數（前端一次送出多筆 A1 項目）
// ============================================================
function saveDailyPointsBatch(body) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.DAILY_POINTS);
  var now = new Date().toISOString();
  var ids = [];
  
  var items = body.items || [];
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var id = generateId("DP");
    sheet.appendRow([
      id, body.workerId, body.workerName, body.date,
      item.pointCode, item.category, item.taskName,
      item.points, item.fileCount || 0, "草稿",
      "", "", "", item.note || "", now
    ]);
    ids.push(id);
  }
  
  return { success: true, ids: ids, count: ids.length };
}
```

---

## 2. Init.gs — 新增 `submitDailyPoints` action

在 `doPost` 函式的 `switch (action)` 中，新增：

```javascript
      case "submitDailyPoints":
        data = submitDailyPointsAction(body);
        break;
```

新增函式：

```javascript
// ============================================================
// 將某人某日所有草稿狀態的點數改為「已送出」
// ============================================================
function submitDailyPointsAction(body) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.DAILY_POINTS);
  var rows = sheet.getDataRange().getValues();
  var headers = rows[0];
  var statusCol = headers.indexOf("審核狀態") + 1;
  var workerIdCol = headers.indexOf("工號");
  var dateCol = headers.indexOf("日期");
  var statusIdx = headers.indexOf("審核狀態");
  var count = 0;

  for (var i = 1; i < rows.length; i++) {
    if (rows[i][workerIdCol] === body.workerId &&
        String(rows[i][dateCol]) === body.date &&
        rows[i][statusIdx] === "草稿") {
      sheet.getRange(i + 1, statusCol).setValue("已送出");
      count++;
    }
  }
  return { success: true, updatedCount: count };
}
```

---

## 3. 建議（非必要）：新增「月結快照」和「操作日誌」分頁

OpenSpec v3 新增了兩個分頁，可在 `SHEET_NAMES` 常數中加入：

```javascript
const SHEET_NAMES = {
  CONFIG:         "系統設定",
  WORKERS:        "人員名冊",
  ATTENDANCE:     "差勤紀錄",
  DAILY_POINTS:   "每日點數明細",
  MONTHLY_PTS:    "月度點數明細",
  REVIEW:         "審核紀錄",
  POINT_DEFS:     "點數定義表",
  FILE_INDEX:     "佐證檔案索引",
  // v3 新增
  MONTHLY_SNAPSHOT: "月結快照",
  ACTIVITY_LOG:     "操作日誌",
};
```

並在 `createAllSheets` 中自動建立這兩個分頁。

---

## 4. 更新步驟

1. 開啟 Google Sheets → 擴充功能 → Apps Script
2. 按上述說明修改 `Init.gs`
3. 點擊「部署」→「管理部署作業」
4. 點擊「新增部署」（不是編輯現有部署）
5. 選擇「網頁應用程式」
6. 執行身份：「我」，存取權限：「所有人」
7. 複製新的 Web App URL
8. 更新 GitHub Secrets 中的 `GAS_WEB_APP_URL`（如果 URL 有變更）

> ⚠️ **重要**：每次修改 GAS 程式碼後，必須「新增部署」才會生效。僅儲存不會更新已部署的版本。
