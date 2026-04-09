/**
 * 115年度協助員點數管理系統
 * Google Apps Script 初始化腳本
 * 
 * 使用方式：
 * 1. 開啟 Google Sheets → 擴充功能 → Apps Script
 * 2. 貼上此腳本全文
 * 3. 執行 initAll() 函式
 * 4. 部署為 Web App（執行身份：我、存取：任何人）
 * 5. 複製 Web App URL 填入系統設定頁面
 */

// ============================================================
// 全域設定
// ============================================================
const SHEET_NAMES = {
  CONFIG:       "系統設定",
  WORKERS:      "人員名冊",
  ATTENDANCE:   "差勤紀錄",
  DAILY_POINTS: "每日點數明細",
  MONTHLY_PTS:  "月度點數明細",
  REVIEW:       "審核紀錄",
  POINT_DEFS:   "點數定義表",
  FILE_INDEX:   "佐證檔案索引",
};

const DRIVE_FOLDER_NAME = "115年度協助員點數管理系統";

// ============================================================
// 主要初始化入口
// ============================================================
function initAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("=== 開始初始化 115年度協助員點數管理系統 ===");

  // 1. 建立所有分頁
  createAllSheets(ss);

  // 2. 寫入欄位標頭
  setupHeaders(ss);

  // 3. 寫入點數定義種子資料
  seedPointDefinitions(ss);

  // 4. 寫入系統設定種子資料
  seedSystemConfig(ss);

  // 5. 建立 Google Drive 資料夾結構
  const folderId = createDriveFolders();

  // 6. 將 Drive 資料夾 ID 寫回系統設定
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  if (configSheet) {
    configSheet.getRange("B2").setValue(folderId);
  }

  Logger.log("=== 初始化完成！Drive 資料夾 ID: " + folderId + " ===");
  SpreadsheetApp.getUi().alert(
    "初始化完成！\n\n" +
    "Google Drive 資料夾 ID：" + folderId + "\n\n" +
    "請記錄此 ID，並填入系統設定頁面的「Google Drive 資料夾 ID」欄位。\n\n" +
    "接下來請部署此腳本為 Web App，並將 URL 填入系統設定頁面。"
  );
}

// ============================================================
// 建立所有分頁
// ============================================================
function createAllSheets(ss) {
  const existingSheets = ss.getSheets().map(s => s.getName());

  Object.values(SHEET_NAMES).forEach(name => {
    if (!existingSheets.includes(name)) {
      ss.insertSheet(name);
      Logger.log("建立分頁：" + name);
    } else {
      Logger.log("分頁已存在，略過：" + name);
    }
  });

  // 移除預設的 Sheet1（若存在且為空）
  const defaultSheet = ss.getSheetByName("工作表1") || ss.getSheetByName("Sheet1");
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }
}

// ============================================================
// 設定各分頁欄位標頭
// ============================================================
function setupHeaders(ss) {
  const headers = {
    [SHEET_NAMES.CONFIG]: [
      ["設定項目", "設定值", "說明"]
    ],
    [SHEET_NAMES.WORKERS]: [
      ["工號", "姓名", "Email", "部門", "服務區域", "協助員類型", "到職日期",
       "離職日期", "狀態", "小計經驗天數", "備註", "建立時間", "更新時間"]
    ],
    [SHEET_NAMES.ATTENDANCE]: [
      ["紀錄ID", "工號", "姓名", "日期", "假別", "時數", "代理人姓名",
       "建立時間", "更新時間", "備註"]
    ],
    [SHEET_NAMES.DAILY_POINTS]: [
      ["明細ID", "工號", "姓名", "日期", "點數代碼", "類別",
       "項目名稱", "點數", "佐證數量", "審核狀態", "審核人",
       "審核時間", "退回原因", "備註", "建立時間"]
    ],
    [SHEET_NAMES.MONTHLY_PTS]: [
      ["月份", "工號", "姓名", "協助員類型", "服務區域",
       "A類點數", "B類點數", "C類點數", "D類點數", "S類點數", "P類點數",
       "月度總點數", "服務費(元)", "出勤天數", "請假天數", "特休天數",
       "狀態", "廠商確認時間", "備註"]
    ],
    [SHEET_NAMES.REVIEW]: [
      ["審核ID", "明細ID", "工號", "姓名", "日期", "項目名稱", "點數",
       "審核動作", "審核人工號", "審核人姓名", "審核時間", "退回原因", "備註"]
    ],
    [SHEET_NAMES.POINT_DEFS]: [
      ["點數代碼", "類別", "項目名稱", "點數", "單位", "說明",
       "適用協助員類型", "是否需要佐證", "狀態", "建立時間"]
    ],
    [SHEET_NAMES.FILE_INDEX]: [
      ["檔案ID", "明細ID", "工號", "日期", "原始檔名", "Drive檔案ID",
       "Drive檔案URL", "檔案類型", "檔案大小(KB)", "上傳時間", "備註"]
    ],
  };

  Object.entries(headers).forEach(([sheetName, headerRows]) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    // 只在第一行為空時寫入標頭
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, headerRows.length, headerRows[0].length)
           .setValues(headerRows);

      // 設定標頭樣式
      const headerRange = sheet.getRange(1, 1, 1, headerRows[0].length);
      headerRange.setBackground("#1e3a5f");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      headerRange.setFontSize(10);
      sheet.setFrozenRows(1);

      // 自動調整欄寬
      sheet.autoResizeColumns(1, headerRows[0].length);
      Logger.log("設定標頭：" + sheetName);
    }
  });
}

// ============================================================
// 種子資料：點數定義表（51 筆）
// ============================================================
function seedPointDefinitions(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.POINT_DEFS);
  if (!sheet || sheet.getLastRow() > 1) {
    Logger.log("點數定義表已有資料，略過種子資料");
    return;
  }

  const now = new Date().toISOString().split("T")[0];
  const defs = [
    // A 類 — 工地作業協助
    ["A1",  "A", "工地清潔與整理",           1200, "次", "工地環境清潔、廢棄物清除",         "一般工地協助員", true,  "啟用", now],
    ["A2",  "A", "工具整理與歸還",             800, "次", "工具盤點、清潔、歸還工具房",       "一般工地協助員", true,  "啟用", now],
    ["A3",  "A", "材料搜選與進場驗收",        1500, "次", "協助材料驗收、搬運、入庫",         "一般工地協助員", true,  "啟用", now],
    ["A4",  "A", "施工區域圍籬設置",          1800, "次", "安全圍籬架設與拆除",               "一般工地協助員", true,  "啟用", now],
    ["A5",  "A", "廢棄物分類與清運",          1000, "次", "廢棄物分類、袋裝、清運配合",       "一般工地協助員", true,  "啟用", now],
    ["A6",  "A", "臨時設施搭設協助",          2000, "次", "臨時辦公室、倉庫搭設協助",         "一般工地協助員", true,  "啟用", now],
    ["A7",  "A", "施工機具操作協助",          2500, "次", "挖土機、吊車等機具操作輔助",       "一般工地協助員", true,  "啟用", now],
    ["A8",  "A", "混凝土澆置協助",            2200, "次", "混凝土攪拌、澆置、整平協助",       "一般工地協助員", true,  "啟用", now],
    ["A9",  "A", "鋼筋綁紮協助",              2800, "次", "鋼筋裁切、彎折、綁紮協助",         "一般工地協助員", true,  "啟用", now],
    ["A10", "A", "模板組立協助",              2600, "次", "模板組立、拆除、清潔",             "一般工地協助員", true,  "啟用", now],

    // B 類 — 安全衛生
    ["B1",  "B", "安全訓練參與",              3000, "次", "參與工地安全訓練課程（全日）",     "全體協助員",     true,  "啟用", now],
    ["B2",  "B", "安全設備檢查",              2000, "次", "安全帽、安全帶、防護具檢查",       "全體協助員",     true,  "啟用", now],
    ["B3",  "B", "危險區域標示維護",          1500, "次", "警示標誌、護欄維護更新",           "全體協助員",     true,  "啟用", now],
    ["B4",  "B", "急救訓練參與",              3500, "次", "CPR、AED、急救訓練（半日）",       "全體協助員",     true,  "啟用", now],
    ["B5",  "B", "安全巡查協助",              1800, "次", "協助工地安全巡查、紀錄異常",       "全體協助員",     true,  "啟用", now],
    ["B6",  "B", "消防設備檢查",              2000, "次", "滅火器、消防栓等設備定期檢查",     "全體協助員",     true,  "啟用", now],
    ["B7",  "B", "職災通報協助",              2500, "次", "協助職業災害通報、現場保全",       "全體協助員",     false, "啟用", now],
    ["B8",  "B", "安全教育宣導",              1200, "次", "協助安全教育宣導資料發放",         "全體協助員",     false, "啟用", now],

    // C 類 — 機電作業
    ["C1",  "C", "機電設備維護協助",          2500, "次", "馬達、幫浦等設備維護輔助",         "機電協助員",     true,  "啟用", now],
    ["C2",  "C", "電氣配線協助",              3500, "次", "電纜佈線、接線、測試協助",         "機電協助員",     true,  "啟用", now],
    ["C3",  "C", "儀表校正協助",              3000, "次", "壓力錶、流量計等儀表校正輔助",     "機電協助員",     true,  "啟用", now],
    ["C4",  "C", "管路安裝協助",              2800, "次", "管路切割、套絲、安裝協助",         "機電協助員",     true,  "啟用", now],
    ["C5",  "C", "設備試運轉協助",            4000, "次", "新裝設備試運轉測試輔助",           "機電協助員",     true,  "啟用", now],
    ["C6",  "C", "電氣盤體維護",              3200, "次", "配電盤、控制盤清潔維護",           "機電協助員",     true,  "啟用", now],
    ["C7",  "C", "接地電阻量測協助",          2000, "次", "接地系統電阻值量測輔助",           "機電協助員",     true,  "啟用", now],
    ["C8",  "C", "機電圖說整理",              1500, "次", "機電竣工圖、維護手冊整理歸檔",     "機電協助員",     false, "啟用", now],

    // D 類 — 行政作業
    ["D1",  "D", "行政文件處理",              1000, "次", "公文收發、歸檔、影印",             "行政協助員",     false, "啟用", now],
    ["D2",  "D", "會議記錄協助",              1500, "次", "工地會議記錄、整理、發送",         "行政協助員",     false, "啟用", now],
    ["D3",  "D", "採購作業協助",              1200, "次", "材料採購詢價、比價、訂購協助",     "行政協助員",     true,  "啟用", now],
    ["D4",  "D", "工程照片整理",               800, "次", "施工照片拍攝、整理、歸檔",         "行政協助員",     false, "啟用", now],
    ["D5",  "D", "進度報告協助",              2000, "次", "工程進度報告製作協助",             "行政協助員",     false, "啟用", now],
    ["D6",  "D", "廠商聯繫協助",              1000, "次", "廠商電話聯繫、訪廠記錄",           "行政協助員",     false, "啟用", now],
    ["D7",  "D", "合約文件管理",              1500, "次", "合約文件建檔、追蹤、管理",         "行政協助員",     false, "啟用", now],
    ["D8",  "D", "費用核銷協助",              1200, "次", "差旅費、材料費核銷單據整理",       "行政協助員",     true,  "啟用", now],
    ["D9",  "D", "人員出勤統計",               800, "次", "協助員出勤紀錄統計製表",           "行政協助員",     false, "啟用", now],
    ["D10", "D", "倉庫盤點協助",              1000, "次", "材料、工具倉庫定期盤點協助",       "行政協助員",     true,  "啟用", now],

    // S 類 — 特殊貢獻
    ["S1",  "S", "特殊貢獻加分",              5000, "項", "對工程品質有特殊貢獻（主管核定）", "全體協助員",     true,  "啟用", now],
    ["S2",  "S", "緊急搶修協助",              6000, "項", "非工作時間緊急搶修參與",           "全體協助員",     true,  "啟用", now],
    ["S3",  "S", "技術傳承貢獻",              4000, "項", "協助新進人員技術指導",             "全體協助員",     false, "啟用", now],
    ["S4",  "S", "改善提案採用",              3500, "項", "提出並獲採用之工作改善提案",       "全體協助員",     true,  "啟用", now],
    ["S5",  "S", "優良工作表現",              3000, "項", "月度優良工作表現獎勵",             "全體協助員",     false, "啟用", now],
    ["S6",  "S", "跨部門支援",                2500, "項", "跨部門緊急支援協助",               "全體協助員",     true,  "啟用", now],
    ["S7",  "S", "客戶滿意度貢獻",            4500, "項", "獲客戶書面肯定之工作表現",         "全體協助員",     true,  "啟用", now],

    // P 類 — 專案協助
    ["P1",  "P", "專案協助加分",              4000, "項", "重要專案協助（專案主管核定）",     "全體協助員",     true,  "啟用", now],
    ["P2",  "P", "試運轉專案協助",            5000, "項", "機組試運轉專案全程協助",           "全體協助員",     true,  "啟用", now],
    ["P3",  "P", "環保稽查協助",              3000, "項", "環保主管機關稽查配合協助",         "全體協助員",     true,  "啟用", now],
    ["P4",  "P", "職安衛稽查協助",            3000, "項", "職安衛主管機關稽查配合協助",       "全體協助員",     true,  "啟用", now],
    ["P5",  "P", "重大維修專案",              6000, "項", "機組大修或重大維修專案協助",       "全體協助員",     true,  "啟用", now],
    ["P6",  "P", "ISO 稽核協助",              2500, "項", "ISO 系統稽核文件準備協助",         "行政協助員",     true,  "啟用", now],
    ["P7",  "P", "節能減碳專案",              3500, "項", "節能減碳相關專案協助",             "全體協助員",     true,  "啟用", now],
  ];

  sheet.getRange(2, 1, defs.length, defs[0].length).setValues(defs);
  Logger.log("寫入點數定義種子資料：" + defs.length + " 筆");
}

// ============================================================
// 種子資料：系統設定
// ============================================================
function seedSystemConfig(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  if (!sheet || sheet.getLastRow() > 1) {
    Logger.log("系統設定已有資料，略過種子資料");
    return;
  }

  const configs = [
    ["系統年度",    "115",    "系統適用年度"],
    ["Drive資料夾ID", "",     "佐證檔案上傳目標資料夾（由 initAll 自動填入）"],
    ["點數單價",    "0.01",   "每點換算服務費（元）"],
    ["機構名稱",    "綜合施工處", "機構名稱"],
    ["機構代碼",    "CPC",    "機構代碼"],
    ["系統版本",    "1.0.0",  "系統版本號"],
    ["初始化時間",  new Date().toISOString(), "系統初始化時間"],
  ];

  sheet.getRange(2, 1, configs.length, 3).setValues(configs);
  Logger.log("寫入系統設定種子資料");
}

// ============================================================
// 建立 Google Drive 資料夾結構
// ============================================================
function createDriveFolders() {
  const root = DriveApp.getRootFolder();
  let mainFolder;

  // 檢查是否已存在
  const existing = root.getFoldersByName(DRIVE_FOLDER_NAME);
  if (existing.hasNext()) {
    mainFolder = existing.next();
    Logger.log("Drive 主資料夾已存在：" + mainFolder.getId());
  } else {
    mainFolder = root.createFolder(DRIVE_FOLDER_NAME);
    Logger.log("建立 Drive 主資料夾：" + mainFolder.getId());
  }

  // 建立子資料夾（按年月）
  const subFolders = ["2026-01", "2026-02", "2026-03", "2026-04",
                      "2026-05", "2026-06", "2026-07", "2026-08",
                      "2026-09", "2026-10", "2026-11", "2026-12"];

  subFolders.forEach(name => {
    const existing = mainFolder.getFoldersByName(name);
    if (!existing.hasNext()) {
      mainFolder.createFolder(name);
      Logger.log("建立子資料夾：" + name);
    }
  });

  return mainFolder.getId();
}

// ============================================================
// Web App 入口：doGet / doPost
// ============================================================
function doGet(e) {
  const action = e.parameter.action || "";

  if (action === "ping") {
    return ContentService.createTextOutput(
      JSON.stringify({ status: "ok", message: "GAS API 運作正常", timestamp: new Date().toISOString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  if (action === "getWorkers") {
    return jsonResponse(getWorkers());
  }

  if (action === "getPointDefs") {
    return jsonResponse(getPointDefs());
  }

  if (action === "getAttendance") {
    const workerId = e.parameter.workerId;
    const month = e.parameter.month;
    return jsonResponse(getAttendance(workerId, month));
  }

  if (action === "getDailyPoints") {
    const workerId = e.parameter.workerId;
    const date = e.parameter.date;
    return jsonResponse(getDailyPoints(workerId, date));
  }

  if (action === "getMonthlyPoints") {
    const workerId = e.parameter.workerId;
    const month = e.parameter.month;
    return jsonResponse(getMonthlyPoints(workerId, month));
  }

  if (action === "getConfig") {
    return jsonResponse(getConfig());
  }

  return jsonResponse({ error: "Unknown action: " + action });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse({ error: "Invalid JSON" });
  }

  const action = body.action || "";

  if (action === "saveAttendance") {
    return jsonResponse(saveAttendance(body.data));
  }

  if (action === "saveDailyPoints") {
    return jsonResponse(saveDailyPoints(body.data));
  }

  if (action === "submitMonthlyReport") {
    return jsonResponse(submitMonthlyReport(body.data));
  }

  if (action === "reviewItem") {
    return jsonResponse(reviewItem(body.data));
  }

  if (action === "saveFileIndex") {
    return jsonResponse(saveFileIndex(body.data));
  }

  if (action === "upsertWorker") {
    return jsonResponse(upsertWorker(body.data));
  }

  return jsonResponse({ error: "Unknown action: " + action });
}

// ============================================================
// 輔助函式
// ============================================================
function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

function generateId(prefix) {
  return prefix + "_" + new Date().getTime() + "_" + Math.floor(Math.random() * 1000);
}

// ============================================================
// 資料查詢函式
// ============================================================
function getWorkers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.WORKERS);
  return { success: true, data: sheetToObjects(sheet) };
}

function getPointDefs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.POINT_DEFS);
  return { success: true, data: sheetToObjects(sheet) };
}

function getAttendance(workerId, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ATTENDANCE);
  const all = sheetToObjects(sheet);
  const filtered = all.filter(r =>
    (!workerId || r["工號"] === workerId) &&
    (!month || String(r["日期"]).startsWith(month))
  );
  return { success: true, data: filtered };
}

function getDailyPoints(workerId, date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DAILY_POINTS);
  const all = sheetToObjects(sheet);
  const filtered = all.filter(r =>
    (!workerId || r["工號"] === workerId) &&
    (!date || r["日期"] === date)
  );
  return { success: true, data: filtered };
}

function getMonthlyPoints(workerId, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.MONTHLY_PTS);
  const all = sheetToObjects(sheet);
  const filtered = all.filter(r =>
    (!workerId || r["工號"] === workerId) &&
    (!month || r["月份"] === month)
  );
  return { success: true, data: filtered };
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  const rows = sheetToObjects(sheet);
  const config = {};
  rows.forEach(r => { config[r["設定項目"]] = r["設定值"]; });
  return { success: true, data: config };
}

// ============================================================
// 資料寫入函式
// ============================================================
function saveAttendance(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ATTENDANCE);
  const now = new Date().toISOString();
  const id = generateId("ATT");

  sheet.appendRow([
    id, data.workerId, data.workerName, data.date,
    data.leaveType, data.hours, data.proxyName || "",
    now, now, data.note || ""
  ]);

  return { success: true, id };
}

function saveDailyPoints(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DAILY_POINTS);
  const now = new Date().toISOString();
  const id = generateId("DP");

  sheet.appendRow([
    id, data.workerId, data.workerName, data.date,
    data.pointCode, data.category, data.taskName,
    data.points, data.fileCount || 0, "草稿",
    "", "", "", data.note || "", now
  ]);

  return { success: true, id };
}

function submitMonthlyReport(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.DAILY_POINTS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const statusCol = headers.indexOf("審核狀態") + 1;

  // 更新該工號該月份所有草稿狀態為「已送出」
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (row[headers.indexOf("工號")] === data.workerId &&
        String(row[headers.indexOf("日期")]).startsWith(data.month) &&
        row[headers.indexOf("審核狀態")] === "草稿") {
      sheet.getRange(i + 1, statusCol).setValue("已送出");
    }
  }

  return { success: true };
}

function reviewItem(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dpSheet = ss.getSheetByName(SHEET_NAMES.DAILY_POINTS);
  const rvSheet = ss.getSheetByName(SHEET_NAMES.REVIEW);
  const rows = dpSheet.getDataRange().getValues();
  const headers = rows[0];
  const now = new Date().toISOString();

  // 找到對應明細並更新狀態
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf("明細ID")] === data.itemId) {
      const statusCol = headers.indexOf("審核狀態") + 1;
      const reviewerCol = headers.indexOf("審核人") + 1;
      const reviewTimeCol = headers.indexOf("審核時間") + 1;
      const rejectReasonCol = headers.indexOf("退回原因") + 1;

      dpSheet.getRange(i + 1, statusCol).setValue(data.action === "approve" ? "已通過" : "已退回");
      dpSheet.getRange(i + 1, reviewerCol).setValue(data.reviewerName);
      dpSheet.getRange(i + 1, reviewTimeCol).setValue(now);
      if (data.action === "reject") {
        dpSheet.getRange(i + 1, rejectReasonCol).setValue(data.reason || "");
      }
      break;
    }
  }

  // 寫入審核紀錄
  const rvId = generateId("RV");
  rvSheet.appendRow([
    rvId, data.itemId, data.workerId, data.workerName,
    data.date, data.taskName, data.points,
    data.action === "approve" ? "通過" : "退回",
    data.reviewerId, data.reviewerName, now,
    data.reason || "", ""
  ]);

  return { success: true, reviewId: rvId };
}

function saveFileIndex(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.FILE_INDEX);
  const now = new Date().toISOString();
  const id = generateId("FI");

  sheet.appendRow([
    id, data.itemId, data.workerId, data.date,
    data.originalName, data.driveFileId, data.driveFileUrl,
    data.fileType, data.fileSizeKb || 0, now, data.note || ""
  ]);

  return { success: true, id };
}

function upsertWorker(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.WORKERS);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const now = new Date().toISOString();

  // 查找現有工號
  let found = false;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf("工號")] === data.id) {
      // 更新現有記錄
      const updateMap = {
        "姓名": data.name, "Email": data.email, "部門": data.department,
        "服務區域": data.area, "協助員類型": data.workerType,
        "到職日期": data.onboardDate, "狀態": data.status,
        "小計經驗天數": data.pastExpDays, "備註": data.note || "",
        "更新時間": now
      };
      Object.entries(updateMap).forEach(([key, val]) => {
        const col = headers.indexOf(key) + 1;
        if (col > 0) sheet.getRange(i + 1, col).setValue(val);
      });
      found = true;
      break;
    }
  }

  if (!found) {
    // 新增記錄
    sheet.appendRow([
      data.id, data.name, data.email, data.department,
      data.area, data.workerType, data.onboardDate, "",
      data.status || "在職", data.pastExpDays || 0, data.note || "",
      now, now
    ]);
  }

  return { success: true, found };
}
