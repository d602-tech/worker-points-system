/**
 * 115年度協助員點數管理系統
 * Google Apps Script 初始化腳本 v1.2
 *
 * 修正紀錄：
 *   v1.0 - 初始版本
 *   v1.1 - 修正 CORS header 寫法（移除不支援的 setHeader()）
 *        - 修正 createDriveFolders 補齊「佐證檔案」子資料夾
 *        - 補齊 seedSystemConfig 中的 GAS_WEB_APP_URL 欄位
 *        - 更新 seedPointDefinitions 為四種角色共 49 筆真實資料
 *   v1.2 - 人員名冊新增「帳號類型」欄位（共 14 欄）
 *        - upsertWorker 函式對應 14 欄欄位順序（含帳號類型）
 *        - 修正 E-D1-03 點數項目名稱與點數值
 *        - TestAccounts.gs 分離為獨立檔案
 *        - initAll() 提示訊息補充 TestAccounts 執行步驟
 *
 * 使用方式：
 * 1. 開啟 Google Sheets → 擴充功能 → Apps Script
 * 2. 在同一個 GAS 專案中建立四個指令碼檔案：
 *    Init.gs / API.gs / DriveUpload.gs / TestAccounts.gs
 * 3. 將本檔案內容貼入 Init.gs（取代舊版內容）
 * 4. 執行 initAll() 函式
 * 5. 部署為 Web App（執行身份：我、存取：任何人）
 * 6. 複製 Web App URL，填入系統設定頁面的 GAS_WEB_APP_URL 欄位
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
  Logger.log("=== 開始初始化 115年度協助員點數管理系統 v1.2 ===");

  // 1. 建立所有分頁
  createAllSheets(ss);

  // 2. 寫入欄位標頭
  setupHeaders(ss);

  // 3. 寫入點數定義種子資料（四種角色 49 筆）
  seedPointDefinitions(ss);

  // 4. 寫入系統設定種子資料（含 GAS_WEB_APP_URL 欄位）
  seedSystemConfig(ss);

  // 5. 建立 Google Drive 資料夾結構（含「佐證檔案」子資料夾）
  const result = createDriveFolders();

  // 6. 將 Drive 資料夾 ID 寫回系統設定
  updateConfigValue(ss, "Drive資料夾ID", result.folderId);

  Logger.log("=== 初始化完成！Drive 佐證資料夾 ID: " + result.folderId + " ===");
  SpreadsheetApp.getUi().alert(
    "✅ 初始化完成！\n\n" +
    "【重要】請記錄以下資訊：\n\n" +
    "① Google Drive 佐證資料夾 ID：\n" + result.folderId + "\n\n" +
    "② 主資料夾 ID：\n" + result.mainFolderId + "\n\n" +
    "接下來請：\n" +
    "1. 部署此腳本為 Web App（部署 → 新增部署作業 → 網頁應用程式）\n" +
    "2. 執行身份選「我」、存取選「所有人」\n" +
    "3. 複製 Web App URL\n" +
    "4. 在系統設定頁面填入 GAS_WEB_APP_URL 欄位\n" +
    "5. 執行 TestAccounts.gs 中的 setupTestAccounts() 建立測試帳號"
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
    try { ss.deleteSheet(defaultSheet); } catch(e) {}
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
      ["工號", "姓名", "帳號類型", "Email", "部門", "服務區域", "協助員類型", "到職日期",
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
      ["點數代碼", "類別", "工作項目名稱", "點數", "備註說明",
       "適用角色", "是否需要佐證", "狀態", "建立時間"]
    ],
    [SHEET_NAMES.FILE_INDEX]: [
      ["檔案ID", "明細ID", "工號", "日期", "原始檔名", "Drive檔案ID",
       "Drive檔案URL", "檔案類型", "檔案大小(KB)", "上傳時間", "備註"]
    ],
  };

  Object.entries(headers).forEach(([sheetName, headerRows]) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, headerRows.length, headerRows[0].length)
           .setValues(headerRows);

      const headerRange = sheet.getRange(1, 1, 1, headerRows[0].length);
      headerRange.setBackground("#1e3a5f");
      headerRange.setFontColor("#ffffff");
      headerRange.setFontWeight("bold");
      headerRange.setFontSize(10);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headerRows[0].length);
      Logger.log("設定標頭：" + sheetName);
    }
  });
}

// ============================================================
// 種子資料：點數定義表
// 四種角色共 49 筆（依使用者提供之真實資料）
// 欄位順序：點數代碼, 類別, 工作項目名稱, 點數, 備註說明, 適用角色, 是否需要佐證, 狀態, 建立時間
// ============================================================
function seedPointDefinitions(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.POINT_DEFS);
  if (!sheet) return;
  if (sheet.getLastRow() > 1) {
    Logger.log("點數定義表已有資料，略過種子資料（若需重置請先清除第2列以後的資料）");
    return;
  }

  const now = new Date().toISOString().split("T")[0];

  // ── 1. 一般工地協助員 (General) ──────────────────────────
  const general = [
    ["G-A1-01", "A1", "自動檢查與工地巡檢",                       800,  "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-A1-02", "A1", "危害告知與高風險作業管制與監督",             400,  "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-A1-03", "A1", "承攬商每日作業安全循環之監督與協調",         200,  "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-A1-04", "A1", "工地監看與職安環保管控",                     150,  "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-A2-01", "A2", "天然災害停止上班遠端作業(颱風假、豪雨假等)", 1400, "",                                       "一般工地協助員", false, "啟用", now],
    ["G-B1-01", "B1", "進場資格與16專卷審查",                      4000, "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-B1-02", "B1", "設備設施安全稽核",                          3000, "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-B1-03", "B1", "協議組織運作與績效分析",                    3000, "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-B1-04", "B1", "職安衛文書作業與水平展開",                  2900, "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-B2-01", "B2", "春節期間強化作業",                          5000, "",                                       "一般工地協助員", true,  "啟用", now],
    ["G-C-01",  "C",  "臨時交辦與績效",                            5000, "評核標準：優 5000 / 佳 3000 / 平 2000",  "一般工地協助員", false, "啟用", now],
    ["G-S-01",  "S",  "特休代付款",                                 220, "單位：小時",                             "一般工地協助員", false, "啟用", now],
    ["G-P-01",  "P",  "懲罰性違約金 (未派員履約)",                  220, "單位：小時",                             "一般工地協助員", false, "啟用", now],
  ];

  // ── 2. 離島工地協助員 (Offshore) ─────────────────────────
  const offshore = [
    ["O-A1-01", "A1", "自動檢查與工地巡檢",                       1060, "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-A1-02", "A1", "危害告知與高風險作業管制與監督",             530,  "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-A1-03", "A1", "承攬商每日作業安全循環之監督與協調",         300,  "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-A1-04", "A1", "工地監看與職安環保管控",                     210,  "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-A2-01", "A2", "天然災害停止上班遠端作業(颱風假、豪雨假等)", 1800, "",                                       "離島工地協助員", false, "啟用", now],
    ["O-B1-01", "B1", "進場資格與16專卷審查",                      5000, "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-B1-02", "B1", "設備設施安全稽核",                          4000, "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-B1-03", "B1", "協議組織運作與績效分析",                    4000, "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-B1-04", "B1", "職安衛文書作業與水平展開",                  3600, "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-B2-01", "B2", "春節期間強化作業",                          7000, "",                                       "離島工地協助員", true,  "啟用", now],
    ["O-C-01",  "C",  "臨時交辦與績效",                            7200, "評核標準：優 7200 / 佳 5200 / 平 4200",  "離島工地協助員", false, "啟用", now],
    ["O-S-01",  "S",  "特休代付款",                                 290, "單位：小時",                             "離島工地協助員", false, "啟用", now],
    ["O-P-01",  "P",  "懲罰性違約金 (未派員履約)",                  290, "單位：小時",                             "離島工地協助員", false, "啟用", now],
  ];

  // ── 3. 職安業務兼管理員 (Safety) ─────────────────────────
  const safety = [
    ["S-A1-01", "A1", "確認協助員每日上傳狀況並追蹤",              600,  "",                                       "職安業務兼管理員", true,  "啟用", now],
    ["S-A1-02", "A1", "走動管理及工安查核追蹤",                    500,  "",                                       "職安業務兼管理員", true,  "啟用", now],
    ["S-A2-01", "A2", "天然災害停止上班遠端作業(颱風假、豪雨假等)", 1000, "",                                       "職安業務兼管理員", false, "啟用", now],
    ["S-B1-01", "B1", "缺失或宣導製作簡報",                        2000, "",                                       "職安業務兼管理員", true,  "啟用", now],
    ["S-B1-02", "B1", "職安類週/月/季及年報彙整",                 10800, "",                                       "職安業務兼管理員", true,  "啟用", now],
    ["S-B1-03", "B1", "職安管理系統文件統計分析",                  1000, "",                                       "職安業務兼管理員", true,  "啟用", now],
    ["S-B1-04", "B1", "廠商管理人每月計價作業",                    4500, "",                                       "職安業務兼管理員", true,  "啟用", now],
    ["S-B1-05", "B1", "出勤調度與差勤抽查",                         500, "",                                       "職安業務兼管理員", true,  "啟用", now],
    ["S-B2-01", "B2", "春節期間防護檢核資料彙整",                  4000, "",                                       "職安業務兼管理員", true,  "啟用", now],
    ["S-C-01",  "C",  "臨時交辦與績效",                            5000, "評核標準：優 5000 / 佳 3000 / 平 2000",  "職安業務兼管理員", false, "啟用", now],
    ["S-S-01",  "S",  "特休代付款",                                 200, "單位：小時",                             "職安業務兼管理員", false, "啟用", now],
    ["S-P-01",  "P",  "懲罰性違約金 (未派員履約)",                  200, "單位：小時",                             "職安業務兼管理員", false, "啟用", now],
  ];

  // ── 4. 環保業務人員 (Environment) ────────────────────────
  const environment = [
    ["E-A1-01", "A1", "環保行政業務",                               500, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-A2-01", "A2", "天然災害停止上班遠端作業(颱風假、豪雨假等)",  400, "",                                       "環保業務人員", false, "啟用", now],
    ["E-B1-01", "B1", "行政文書核心",                             29500, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-B2-01", "B2", "春節期間防護檢核資料彙整",                  2000, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-C-01",  "C",  "臨時交辦與績效",                            2000, "評核標準：優 2000 / 佳 1000 / 平 500",   "環保業務人員", false, "啟用", now],
    ["E-D1-01", "D1", "環境管理方案執行績效管制",                   100, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-D1-02", "D1", "監督與量測計畫及實施",                       100, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-D1-03", "D1", "不符合事項矯正與預防措施",                     100, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-D2-01", "D2", "環境審查作業程序書作業",                     800, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-D2-02", "D2", "管理階層審查會議資料準備",                   400, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-D2-03", "D2", "內部稽核文件整理準備",                       900, "",                                       "環保業務人員", true,  "啟用", now],
    ["E-S-01",  "S",  "特休代付款",                                 190, "單位：小時",                             "環保業務人員", false, "啟用", now],
    ["E-P-01",  "P",  "懲罰性違約金 (未派員履約)",                  190, "單位：小時",                             "環保業務人員", false, "啟用", now],
  ];

  const allDefs = [...general, ...offshore, ...safety, ...environment];
  sheet.getRange(2, 1, allDefs.length, allDefs[0].length).setValues(allDefs);
  Logger.log("寫入點數定義種子資料：" + allDefs.length + " 筆（四種角色）");
}

// ============================================================
// 種子資料：系統設定（含 GAS_WEB_APP_URL 欄位）
// ============================================================
function seedSystemConfig(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  if (!sheet) return;
  if (sheet.getLastRow() > 1) {
    Logger.log("系統設定已有資料，略過種子資料");
    return;
  }

  const configs = [
    ["系統年度",        "115",                       "系統適用年度（民國）"],
    ["Drive資料夾ID",   "",                          "佐證檔案上傳目標資料夾（由 initAll 自動填入）"],
    ["GAS_WEB_APP_URL", "",                          "GAS 部署後的 Web App URL（部署完成後請手動填入）"],
    ["點數單價",        "0.01",                      "每點換算服務費（元）"],
    ["機構名稱",        "綜合施工處",                "機構名稱"],
    ["機構代碼",        "CPC",                       "機構代碼"],
    ["系統版本",        "1.2.0",                     "系統版本號"],
    ["初始化時間",      new Date().toISOString(),    "系統初始化時間"],
    ["一般工地協助員_月薪基準", "220",               "一般工地協助員每小時費率（元）"],
    ["離島工地協助員_月薪基準", "290",               "離島工地協助員每小時費率（元）"],
    ["職安業務兼管理員_月薪基準","200",              "職安業務兼管理員每小時費率（元）"],
    ["環保業務人員_月薪基準",   "190",               "環保業務人員每小時費率（元）"],
  ];

  sheet.getRange(2, 1, configs.length, 3).setValues(configs);
  Logger.log("寫入系統設定種子資料：" + configs.length + " 筆（含 GAS_WEB_APP_URL）");
}

// ============================================================
// 更新系統設定中的單一欄位值
// ============================================================
function updateConfigValue(ss, key, value) {
  const sheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      Logger.log("更新設定：" + key + " = " + value);
      return;
    }
  }
  // 若不存在則新增
  sheet.appendRow([key, value, ""]);
  Logger.log("新增設定：" + key + " = " + value);
}

// ============================================================
// 建立 Google Drive 資料夾結構
// 修正：在主資料夾下先建立「佐證檔案」子資料夾，再在其下建立月份資料夾
// 回傳：{ mainFolderId, folderId }
//   mainFolderId = 主資料夾 ID
//   folderId     = 「佐證檔案」資料夾 ID（寫入系統設定）
// ============================================================
function createDriveFolders() {
  const root = DriveApp.getRootFolder();
  let mainFolder;

  // 建立或取得主資料夾
  const existingMain = root.getFoldersByName(DRIVE_FOLDER_NAME);
  if (existingMain.hasNext()) {
    mainFolder = existingMain.next();
    Logger.log("Drive 主資料夾已存在：" + mainFolder.getId());
  } else {
    mainFolder = root.createFolder(DRIVE_FOLDER_NAME);
    Logger.log("建立 Drive 主資料夾：" + mainFolder.getId());
  }

  // ── 修正：建立「佐證檔案」中間層資料夾 ──
  let evidenceFolder;
  const existingEvidence = mainFolder.getFoldersByName("佐證檔案");
  if (existingEvidence.hasNext()) {
    evidenceFolder = existingEvidence.next();
    Logger.log("「佐證檔案」資料夾已存在：" + evidenceFolder.getId());
  } else {
    evidenceFolder = mainFolder.createFolder("佐證檔案");
    Logger.log("建立「佐證檔案」資料夾：" + evidenceFolder.getId());
  }

  // 在「佐證檔案」下建立月份子資料夾
  const months = [
    "2026-01", "2026-02", "2026-03", "2026-04",
    "2026-05", "2026-06", "2026-07", "2026-08",
    "2026-09", "2026-10", "2026-11", "2026-12"
  ];

  months.forEach(name => {
    const existing = evidenceFolder.getFoldersByName(name);
    if (!existing.hasNext()) {
      evidenceFolder.createFolder(name);
      Logger.log("建立月份子資料夾：佐證檔案/" + name);
    }
  });

  // 設定「佐證檔案」資料夾共用（知道連結者可編輯）
  try {
    evidenceFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
    Logger.log("已設定「佐證檔案」資料夾共用權限");
  } catch(e) {
    Logger.log("設定共用權限失敗（可能需手動設定）：" + e.message);
  }

  return {
    mainFolderId: mainFolder.getId(),
    folderId: evidenceFolder.getId()
  };
}

// ============================================================
// Web App 入口：doGet
// 修正：移除 output.setHeader()（GAS ContentService 不支援此方法）
//       改用標準 ContentService 輸出，GAS Web App 本身已允許跨域存取
// ============================================================
function doGet(e) {
  const action = e.parameter.action || "";

  try {
    let data;

    switch (action) {
      case "ping":
        data = { status: "ok", message: "GAS API 運作正常", version: "1.2.0", timestamp: new Date().toISOString() };
        break;
      case "getWorkers":
        data = getWorkers();
        break;
      case "getPointDefs":
        data = getPointDefs();
        break;
      case "getAttendance":
        data = getAttendance(e.parameter.workerId, e.parameter.month);
        break;
      case "getDailyPoints":
        data = getDailyPoints(e.parameter.workerId, e.parameter.date);
        break;
      case "getMonthlyPoints":
        data = getMonthlyPoints(e.parameter.workerId, e.parameter.month);
        break;
      case "getConfig":
        data = getConfig();
        break;
      case "getFileIndex":
        data = getFileIndex(e.parameter.workerId, e.parameter.date);
        break;
      default:
        data = { success: false, error: "Unknown action: " + action };
    }

    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ============================================================
// Web App 入口：doPost
// ============================================================
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON body" });
  }

  const action = body.action || "";

  try {
    let data;

    switch (action) {
      case "saveAttendance":
        data = saveAttendance(body.data);
        break;
      case "saveDailyPoints":
        data = saveDailyPoints(body.data);
        break;
      case "submitMonthlyReport":
        data = submitMonthlyReport(body.data);
        break;
      case "reviewItem":
        data = reviewItem(body.data);
        break;
      case "saveFileIndex":
        data = saveFileIndex(body.data);
        break;
      case "upsertWorker":
        data = upsertWorker(body.data);
        break;
      case "uploadFileToDrive":
        data = uploadFileToDrive(body.base64Data, body.fileName, body.mimeType, body.workerId, body.date);
        break;
      case "updateConfig":
        data = updateConfig(body.key, body.value);
        break;
      default:
        data = { success: false, error: "Unknown action: " + action };
    }

    return jsonResponse(data);
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ============================================================
// 輔助函式：jsonResponse
// 修正說明：
//   ContentService.TextOutput 物件「沒有」setHeader() 方法
//   正確做法是直接使用 setMimeType(JSON) 即可
//   GAS Web App 部署為「所有人可存取」時，瀏覽器跨域請求已被允許
// ============================================================
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
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
  return { success: true, data: sheetToObjects(ss.getSheetByName(SHEET_NAMES.WORKERS)) };
}

function getPointDefs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return { success: true, data: sheetToObjects(ss.getSheetByName(SHEET_NAMES.POINT_DEFS)) };
}

function getAttendance(workerId, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const all = sheetToObjects(ss.getSheetByName(SHEET_NAMES.ATTENDANCE));
  return {
    success: true,
    data: all.filter(r =>
      (!workerId || r["工號"] === workerId) &&
      (!month || String(r["日期"]).startsWith(month))
    )
  };
}

function getDailyPoints(workerId, date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const all = sheetToObjects(ss.getSheetByName(SHEET_NAMES.DAILY_POINTS));
  return {
    success: true,
    data: all.filter(r =>
      (!workerId || r["工號"] === workerId) &&
      (!date || r["日期"] === date)
    )
  };
}

function getMonthlyPoints(workerId, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const all = sheetToObjects(ss.getSheetByName(SHEET_NAMES.MONTHLY_PTS));
  return {
    success: true,
    data: all.filter(r =>
      (!workerId || r["工號"] === workerId) &&
      (!month || r["月份"] === month)
    )
  };
}

function getConfig() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rows = sheetToObjects(ss.getSheetByName(SHEET_NAMES.CONFIG));
  const config = {};
  rows.forEach(r => { config[r["設定項目"]] = r["設定值"]; });
  return { success: true, data: config };
}

function getFileIndex(workerId, date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const all = sheetToObjects(ss.getSheetByName(SHEET_NAMES.FILE_INDEX));
  return {
    success: true,
    data: all.filter(r =>
      (!workerId || r["工號"] === workerId) &&
      (!date || r["日期"] === date)
    )
  };
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
    data.leaveType, data.hours || 8, data.proxyName || "",
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
  const workerIdCol = headers.indexOf("工號");
  const dateCol = headers.indexOf("日期");
  const statusIdx = headers.indexOf("審核狀態");

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][workerIdCol] === data.workerId &&
        String(rows[i][dateCol]).startsWith(data.month) &&
        rows[i][statusIdx] === "草稿") {
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

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf("明細ID")] === data.itemId) {
      dpSheet.getRange(i + 1, headers.indexOf("審核狀態") + 1).setValue(data.action === "approve" ? "已通過" : "已退回");
      dpSheet.getRange(i + 1, headers.indexOf("審核人") + 1).setValue(data.reviewerName);
      dpSheet.getRange(i + 1, headers.indexOf("審核時間") + 1).setValue(now);
      if (data.action === "reject") {
        dpSheet.getRange(i + 1, headers.indexOf("退回原因") + 1).setValue(data.reason || "");
      }
      break;
    }
  }

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

  let found = false;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][headers.indexOf("工號")] === data.id) {
      const updateMap = {
        "姓名": data.name, "帳號類型": data.accountType || "協助員",
        "Email": data.email || "", "部門": data.department || "",
        "服務區域": data.area, "協助員類型": data.workerType,
        "到職日期": data.onboardDate, "狀態": data.status || "在職",
        "小計經驗天數": data.pastExpDays || 0, "備註": data.note || "",
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
    sheet.appendRow([
      data.id, data.name, data.accountType || "協助員",
      data.email || "", data.department || "",
      data.area, data.workerType, data.onboardDate, "",
      data.status || "在職", data.pastExpDays || 0, data.note || "",
      now, now
    ]);
  }
  return { success: true, found };
}

function updateConfig(key, value) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  updateConfigValue(ss, key, value);
  return { success: true };
}

// ============================================================
// Google Drive 檔案上傳
// ============================================================
function uploadFileToDrive(base64Data, fileName, mimeType, workerId, date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configRows = sheetToObjects(ss.getSheetByName(SHEET_NAMES.CONFIG));
  const configMap = {};
  configRows.forEach(r => { configMap[r["設定項目"]] = r["設定值"]; });

  const folderId = configMap["Drive資料夾ID"];
  if (!folderId) throw new Error("系統設定中未找到 Drive資料夾ID，請先執行 initAll()");

  const folder = DriveApp.getFolderById(folderId);
  const yearMonth = String(date).substring(0, 7);

  let subFolder;
  const subFolders = folder.getFoldersByName(yearMonth);
  if (subFolders.hasNext()) {
    subFolder = subFolders.next();
  } else {
    subFolder = folder.createFolder(yearMonth);
  }

  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64Data),
    mimeType,
    workerId + "_" + date + "_" + fileName
  );

  const file = subFolder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    fileId: file.getId(),
    fileName: file.getName(),
    driveFileUrl: file.getUrl(),
    viewUrl: "https://drive.google.com/file/d/" + file.getId() + "/view",
    downloadUrl: "https://drive.google.com/uc?id=" + file.getId() + "&export=download"
  };
}
