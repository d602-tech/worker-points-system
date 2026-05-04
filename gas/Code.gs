/**
 * 115年度協助員點數管理系統
 * Google Apps Script — 單一 Code.gs v3.0
 *
 * 架構依據 OpenSpec v3.0 第 7 章
 * 合併來源：Init.gs / API.gs / DriveUpload.gs / TestAccounts.gs
 *
 * 區塊順序：
 *   常數定義 → 路由分發 → 系統初始化 → 登入驗證 → 使用者管理
 *   → 差勤管理 → 點數管理 → 審核流程 → 報表彙算 → 檔案上傳
 *   → Email 通知 → 操作日誌 → 系統設定 → 共用工具 → 測試帳號
 */

// ========== [常數定義] ==========

const SHEETS = {
  CONFIG:           '系統設定',
  USERS:            '人員資料',
  ATTENDANCE:       '差勤紀錄',
  DAILY_POINTS:     '每日點數',
  MONTHLY_POINTS:   '每月點數',
  REVIEW_LOG:       '審核紀錄',
  POINTS_CONFIG:    '點數定義',
  FILES_INDEX:      '檔案索引',
  MONTHLY_SNAPSHOT: '月結快照',
  ACTIVITY_LOG:     '操作日誌',
  MONTHLY_SUMMARY:  '月統計',
};

const COLUMNS = {
  CONFIG: {
    KEY: '設定鍵', VALUE: '設定值', NOTE: '備註',
  },
  USERS: {
    ID: '人員編號', NAME: '姓名', EMAIL: '電子信箱',
    PASSWORD_HASH: '密碼雜湊', ROLE: '角色',
    DEPARTMENT: '所屬部門', AREA: '服務區域',
    WORKER_TYPE: '職務類型', ONBOARD_DATE: '到職日',
    PAST_EXP_DAYS: '過往年資天數', PAST_EXP_DETAIL: '過往年資明細', IS_ACTIVE: '是否啟用',
    CREATED_AT: '建立時間', LAST_LOGIN: '最後登入時間',
    LOGIN_METHOD: '登入方式',
  },
  ATTENDANCE: {
    USER_ID: '人員編號', DATE: '日期',
    AM_STATUS: '上午狀態', PM_STATUS: '下午狀態',
    WORK_HOURS: '有效工時', LEAVE_HOURS: '特休時數',
    SOURCE: '資料來源', IS_FINALIZED: '是否鎖定',
    NOTE: '備註', UPDATED_AT: '最後更新時間',
    LEAVE_TIME: '請假時間', MODIFY_REASON: '修改原因',
  },
  DAILY_POINTS: {
    RECORD_ID: '紀錄編號', USER_ID: '人員編號', DATE: '日期',
    ITEM_ID: '項目編號', QUANTITY: '完成數量', POINTS: '點數',
    FILE_IDS: '佐證檔案編號', STATUS: '狀態', NOTE: '備註',
    UPLOADED_AT: '上傳時間', UPDATED_AT: '最後更新時間',
  },
  MONTHLY_POINTS: {
    RECORD_ID: '紀錄編號', USER_ID: '人員編號', YEAR_MONTH: '年月',
    ITEM_ID: '項目編號', QUANTITY: '完成數量', POINTS: '點數',
    FILE_IDS: '佐證檔案編號', PERF_LEVEL: '績效等級',
    STATUS: '狀態', NOTE: '備註', UPLOADED_AT: '上傳時間', UPDATED_AT: '最後更新時間',
  },
  REVIEW_LOG: {
    LOG_ID: '紀錄編號', USER_ID: '人員編號', YEAR_MONTH: '年月',
    REVIEWER_ID: '審核者編號', ACTION: '審核動作',
    TIMESTAMP: '時間戳', NOTE: '備註', CHANGE_DETAIL: '變更明細',
  },
  POINTS_CONFIG: {
    ITEM_ID: '項目編號', WORKER_TYPE: '職務類型', CATEGORY: '類別',
    NAME: '工作項目名稱', POINTS_PER_UNIT: '單位點數',
    UNIT: '計量單位', FREQUENCY: '頻率', NOTE: '備註',
  },
  FILES_INDEX: {
    FILE_ID: '檔案編號', USER_ID: '人員編號', DATE: '日期',
    ITEM_ID: '項目編號', FILE_NAME: '檔案名稱',
    MIME_TYPE: '檔案類型', DRIVE_FILE_ID: '雲端檔案編號',
    UPLOADED_AT: '上傳時間',
  },
  MONTHLY_SNAPSHOT: {
    SNAPSHOT_ID: '快照編號', USER_ID: '人員編號', YEAR_MONTH: '年月',
    A_TOTAL: 'A類小計', B_TOTAL: 'B類小計', C_AMOUNT: 'C類金額',
    D_TOTAL: 'D類小計', S_AMOUNT: 'S類金額', P_DEDUCTION: 'P類扣款',
    MONTH_TOTAL: '本月總計', WORK_DAYS: '出勤天數',
    LEAVE_HOURS: '特休時數', SNAPSHOT_TIME: '快照時間',
    CONFIRMER_ID: '確認者編號',
  },
  ACTIVITY_LOG: {
    LOG_ID: '日誌編號', USER_ID: '人員編號',
    TIMESTAMP: '操作時間', ACTION_TYPE: '操作類型',
    DESCRIPTION: '操作說明',
  },
  MONTHLY_SUMMARY: {
    USER_ID:       '人員編號',
    YEAR_MONTH:    '年月',
    DAILY_TOTAL:   '每日點數小計',
    MONTHLY_TOTAL: '每月點數小計',
    PERF_TOTAL:    '績效點數小計',
    GRAND_TOTAL:   '本月總計',
    UPDATED_AT:    '更新時間',
  },
};

// 115年國定假日（YYYY-MM-DD 格式）
const HOLIDAYS_2026 = [
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18',
  '2026-02-19','2026-02-20','2026-02-27','2026-04-03',
  '2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-10-09',
];

const DRIVE_FOLDER_NAME = '115年度_點數管理系統';

// ========== [路由分發] doGet / doPost ==========

// ========== [共用常數與全域物件] ==========

// 取得主控表單 (處理 Web App 中的 active spreadsheet 遺失問題)
function getAppSpreadsheet() {
  return SpreadsheetApp.openById('13AXmaokmrASB86SqpzGJm5h8cu3HJvbWlmMMICaVSYo');
}

// 輔助建立遺失的分頁
function ensureSheet(ss, sheetName, columnsObj) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [];
    for (var k in columnsObj) headers.push(columnsObj[k]);
    sheet.appendRow(headers);
  }
  return sheet; // 回傳以確保後續操作能接續
}

function doGet(e) {
  var action = (e.parameter && e.parameter.action) || '';
  try {
    var data;
    switch (action) {
      case 'ping':
        data = { status: 'ok', message: 'GAS API 運作正常', version: '3.0.0',
                 timestamp: new Date().toISOString() };
        break;
      case 'getMyProfile':
        data = getMyProfile(e.parameter.callerEmail);
        break;
      case 'getWorkers':
        data = getWorkers(e.parameter.callerEmail);
        break;
      case 'getPointDefs':
      case 'getPointDefinitions':
        data = getPointDefs(e.parameter.workerType);
        break;
      case 'getAttendance':
        data = getAttendance(e.parameter.callerEmail, e.parameter.workerId,
                             e.parameter.yearMonth || e.parameter.month);
        break;
      case 'getDailyPoints':
        data = getDailyPoints(e.parameter.callerEmail, e.parameter.workerId,
                              e.parameter.date, e.parameter.yearMonth);
        break;
      case 'getMonthlyPoints':
        data = getMonthlyPoints(e.parameter.callerEmail, e.parameter.workerId,
                                e.parameter.yearMonth);
        break;
      case 'getMonthlySnapshot':
        data = getMonthlySnapshot(e.parameter.callerEmail, e.parameter.workerId,
                                  e.parameter.yearMonth);
        break;
      case 'getConfig':
      case 'getSystemConfig':
        data = getConfig();
        break;
      case 'getFileIndex':
        data = getFileIndex(e.parameter.callerEmail, e.parameter.workerId,
                            e.parameter.date, e.parameter.itemId, e.parameter.yearMonth);
        break;
      case 'getReviewList':
        data = getReviewList(e.parameter.callerEmail, e.parameter.status,
                             e.parameter.yearMonth);
        break;
      case 'getReport':
        data = getReport(e.parameter.callerEmail, e.parameter.type,
                         e.parameter.yearMonth);
        break;
      case 'getMonthlyTotals':
        data = getMonthlyTotals(e.parameter.callerEmail, e.parameter.workerId,
                                e.parameter.yearMonth);
        break;
      default:
        data = { success: false, error: '未知的 action：' + action };
    }
    return jsonResponse(data);
  } catch (err) {
    logError('doGet:' + action, err);
    return jsonResponse({ success: false, error: err.message });
  }
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return jsonResponse({ success: false, error: 'Invalid JSON body' });
  }
  var action = body.action || '';
  try {
    var data;
    switch (action) {
      case 'passwordLogin':
        data = passwordLogin(body.email, body.passwordHash);
        break;
      case 'setWorkerPassword':
        data = setWorkerPassword(body.callerEmail, body.workerId, body.passwordHash);
        break;
      case 'upsertWorker':
        data = upsertWorker(body.callerEmail, body.worker || body.data || body);
        break;
      case 'generateAttendance':
        data = generateMonthlyAttendance(body.callerEmail, body.yearMonth);
        break;
      case 'upsertAttendance':
      case 'saveAttendance':
        data = upsertAttendance(body.callerEmail, body.record || body.data || body);
        break;
      case 'batchUpsertAttendance':
        data = batchUpsertAttendance(body.callerEmail, body.records || body.data || []);
        break;
      case 'finalizeAttendance':
        data = finalizeAttendance(body.callerEmail, body.yearMonth);
        break;
      case 'saveDailyPoints':
      case 'upsertDailyPoints':
        data = saveDailyPoints(body.callerEmail, body.record || body.data || body);
        break;
      case 'saveDailyPointsBatch':
        data = saveDailyPointsBatch(body.callerEmail, body.workerId,
                                    body.date, body.items);
        break;
      case 'saveMonthlyPoints':
      case 'upsertMonthlyPoints':
        data = saveMonthlyPoints(body.callerEmail, body.record || body.data || body);
        break;
      case 'submitMonthlyReport':
        data = submitMonthlyReport(body.callerEmail, body.workerId, body.yearMonth);
        break;
      case 'reviewItem':
      case 'reviewMonthlyReport':
        data = reviewItem(body.callerEmail, body.action2 || body.reviewAction,
                          body.workerId, body.yearMonth, body.reason || '',
                          body.perfLevel, body.points);
        break;
      case 'uploadFileToDrive':
        data = uploadFileToDrive(body.callerEmail, body.base64Data,
                                 body.fileName, body.mimeType,
                                 body.workerId, body.date, body.category || 'A1', body.driveFolderId);
        break;
      case 'saveFileIndex':
        data = saveFileIndex(body.callerEmail, body.record || body.data || body);
        break;
      case 'updateConfig':
      case 'setSystemConfig':
        data = updateConfig(body.callerEmail, body.key, body.value);
        break;
      case 'initAll':
        data = initAll();
        break;
      default:
        data = { success: false, error: '未知的 action：' + action };
    }
    return jsonResponse(data);
  } catch (err) {
    logError('doPost:' + action, err);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ========== [系統初始化] ==========

function initAll() {
  var ss = getAppSpreadsheet();
  Logger.log('=== 開始初始化 115年度協助員點數管理系統 v3.0 ===');

  createAllSheets(ss);
  setupHeaders(ss);
  seedPointDefinitions(ss);
  seedSystemConfig(ss);

  var result = createDriveFolders();
  updateConfigValue(ss, 'driveFolderId', result.folderId);

  Logger.log('=== 初始化完成！Drive 佐證資料夾 ID: ' + result.folderId + ' ===');
  try {
    SpreadsheetApp.getUi().alert(
      '✅ 初始化完成！\n\n' +
      '【重要】請記錄以下資訊：\n\n' +
      '① 佐證資料夾 ID：\n' + result.folderId + '\n\n' +
      '② 主資料夾 ID：\n' + result.mainFolderId + '\n\n' +
      '接下來請：\n' +
      '1. 部署此腳本為 Web App（部署 → 新增部署 → 網頁應用程式）\n' +
      '2. 執行身份選「我」、存取選「所有人」\n' +
      '3. 複製 Web App URL，填入系統設定頁面\n' +
      '4. 執行 setupTestAccounts() 建立測試帳號'
    );
  } catch (_) {}
  return { success: true, message: '初始化完成', folderId: result.folderId };
}

function createAllSheets(ss) {
  var existing = ss.getSheets().map(function(s) { return s.getName(); });
  Object.values(SHEETS).forEach(function(name) {
    if (existing.indexOf(name) === -1) {
      ss.insertSheet(name);
      Logger.log('建立分頁：' + name);
    }
  });
  // 移除預設空白分頁
  ['工作表1','Sheet1'].forEach(function(n) {
    var s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0) { try { ss.deleteSheet(s); } catch(_) {} }
  });
}

function setupHeaders(ss) {
  var headerMap = {};
  headerMap[SHEETS.CONFIG]           = Object.values(COLUMNS.CONFIG);
  headerMap[SHEETS.USERS]            = Object.values(COLUMNS.USERS);
  headerMap[SHEETS.ATTENDANCE]       = Object.values(COLUMNS.ATTENDANCE);
  headerMap[SHEETS.DAILY_POINTS]     = Object.values(COLUMNS.DAILY_POINTS);
  headerMap[SHEETS.MONTHLY_POINTS]   = Object.values(COLUMNS.MONTHLY_POINTS);
  headerMap[SHEETS.REVIEW_LOG]       = Object.values(COLUMNS.REVIEW_LOG);
  headerMap[SHEETS.POINTS_CONFIG]    = Object.values(COLUMNS.POINTS_CONFIG);
  headerMap[SHEETS.FILES_INDEX]      = Object.values(COLUMNS.FILES_INDEX);
  headerMap[SHEETS.MONTHLY_SNAPSHOT] = Object.values(COLUMNS.MONTHLY_SNAPSHOT);
  headerMap[SHEETS.ACTIVITY_LOG]     = Object.values(COLUMNS.ACTIVITY_LOG);
  headerMap[SHEETS.MONTHLY_SUMMARY]  = Object.values(COLUMNS.MONTHLY_SUMMARY);

  Object.entries(headerMap).forEach(function(entry) {
    var sheetName = entry[0];
    var headers   = entry[1];
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      var hRange = sheet.getRange(1, 1, 1, headers.length);
      hRange.setBackground('#1e3a5f');
      hRange.setFontColor('#ffffff');
      hRange.setFontWeight('bold');
      hRange.setFontSize(10);
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, headers.length);
      Logger.log('設定標頭：' + sheetName + '（' + headers.length + ' 欄）');
    }
  });
}

function seedPointDefinitions(ss) {
  var sheet = ss.getSheetByName(SHEETS.POINTS_CONFIG);
  if (!sheet) return;
  if (sheet.getLastRow() > 1) {
    Logger.log('點數定義已有資料，略過種子（需重置請先清除第 2 列以後）');
    return;
  }
  // 欄位順序：項目編號, 職務類型, 類別, 工作項目名稱, 單位點數, 計量單位, 頻率, 備註
  var rows = [
    // 一般工地協助員 (general) — 13 筆
    ['GEN-A1-01','general','A1','自動檢查與工地巡檢',800,'天','每日',''],
    ['GEN-A1-02','general','A1','危害告知與高風險作業管制與監督',400,'天','每日',''],
    ['GEN-A1-03','general','A1','承攬商每日作業安全循環之監督與協調',200,'天','每日',''],
    ['GEN-A1-04','general','A1','工地監看與職安環保管控',150,'天','每日',''],
    ['GEN-A2-01','general','A2','天然災害停止上班遠端作業(颱風假、豪雨假等)',1400,'天','事件',''],
    ['GEN-B1-01','general','B1','進場資格與16專卷審查',4000,'月','每月',''],
    ['GEN-B1-02','general','B1','設備設施安全稽核',3000,'月','每月',''],
    ['GEN-B1-03','general','B1','協議組織運作與績效分析',3000,'月','每月',''],
    ['GEN-B1-04','general','B1','職安衛文書作業與水平展開',2900,'月','每月',''],
    ['GEN-B2-01','general','B2','春節期間強化作業',5000,'次','每年',''],
    ['GEN-C-01', 'general','C', '臨時交辦與績效',5000,'月','每月','優5000/佳3000/平2000（由主辦部門評估）'],
    ['GEN-S-01', 'general','S', '特休代付款',220,'小時','每月',''],
    ['GEN-P-01', 'general','P', '懲罰性違約金 (未派員履約)',220,'小時','事件',''],
    // 離島工地協助員 (offshore) — 13 筆
    ['OFF-A1-01','offshore','A1','自動檢查與工地巡檢',1060,'天','每日',''],
    ['OFF-A1-02','offshore','A1','危害告知與高風險作業管制與監督',530,'天','每日',''],
    ['OFF-A1-03','offshore','A1','承攬商每日作業安全循環之監督與協調',300,'天','每日',''],
    ['OFF-A1-04','offshore','A1','工地監看與職安環保管控',210,'天','每日',''],
    ['OFF-A2-01','offshore','A2','天然災害停止上班遠端作業(颱風假、豪雨假等)',1800,'天','事件',''],
    ['OFF-B1-01','offshore','B1','進場資格與16專卷審查',5000,'月','每月',''],
    ['OFF-B1-02','offshore','B1','設備設施安全稽核',4000,'月','每月',''],
    ['OFF-B1-03','offshore','B1','協議組織運作與績效分析',4000,'月','每月',''],
    ['OFF-B1-04','offshore','B1','職安衛文書作業與水平展開',3600,'月','每月',''],
    ['OFF-B2-01','offshore','B2','春節期間強化作業',7000,'次','每年',''],
    ['OFF-C-01', 'offshore','C', '臨時交辦與績效',7200,'月','每月','優7200/佳5200/平4200（由主辦部門評估）'],
    ['OFF-S-01', 'offshore','S', '特休代付款',290,'小時','每月',''],
    ['OFF-P-01', 'offshore','P', '懲罰性違約金 (未派員履約)',290,'小時','事件',''],
    // 職安業務兼管理員 (safety) — 12 筆
    ['SAF-A1-01','safety','A1','確認協助員每日上傳狀況並追蹤',600,'天','每日',''],
    ['SAF-A1-02','safety','A1','走動管理及工安查核追蹤',500,'天','每日',''],
    ['SAF-A2-01','safety','A2','天然災害停止上班遠端作業(颱風假、豪雨假等)',1000,'天','事件',''],
    ['SAF-B1-01','safety','B1','缺失或宣導製作簡報',2000,'月','每月',''],
    ['SAF-B1-02','safety','B1','職安類週/月/季及年報彙整',10800,'月','每月',''],
    ['SAF-B1-03','safety','B1','職安管理系統文件統計分析',1000,'月','每月',''],
    ['SAF-B1-04','safety','B1','廠商管理人每月計價作業',4500,'月','每月',''],
    ['SAF-B1-05','safety','B1','出勤調度與差勤抽查',500,'月','每月',''],
    ['SAF-B2-01','safety','B2','春節期間防護檢核資料彙整',4000,'次','每年',''],
    ['SAF-C-01', 'safety','C', '臨時交辦與績效',5000,'月','每月','優5000/佳3000/平2000（由主辦部門評估）'],
    ['SAF-S-01', 'safety','S', '特休代付款',200,'小時','每月',''],
    ['SAF-P-01', 'safety','P', '懲罰性違約金 (未派員履約)',200,'小時','事件',''],
    // 環保業務人員 (environment) — 13 筆
    ['ENV-A1-01','environment','A1','環保行政業務',500,'天','每日',''],
    ['ENV-A2-01','environment','A2','天然災害停止上班遠端作業(颱風假、豪雨假等)',400,'天','事件',''],
    ['ENV-B1-01','environment','B1','行政文書核心',29500,'月','每月',''],
    ['ENV-B2-01','environment','B2','春節期間防護檢核資料彙整',2000,'次','每年',''],
    ['ENV-C-01', 'environment','C', '臨時交辦與績效',2000,'月','每月','優2000/佳1000/平500（由主辦部門評估）'],

    ['ENV-D1-01','environment','D1','環境管理方案執行績效管制',100,'天','每日',''],
    ['ENV-D1-02','environment','D1','監督與量測計畫及實施',100,'天','每日',''],
    ['ENV-D1-03','environment','D1','法規鑑別與守規性之評估作業程序書作業',250,'天','每日',''],
    ['ENV-D2-01','environment','D2','環境審查作業程序書作業',800,'月','每月',''],
    ['ENV-D2-02','environment','D2','管理階層審查會議資料準備',400,'月','每月',''],
    ['ENV-D2-03','environment','D2','內部稽核文件整理準備',900,'月','每月',''],
    ['ENV-S-01', 'environment','S', '特休代付款',190,'小時','每月',''],
    ['ENV-P-01', 'environment','P', '懲罰性違約金 (未派員履約)',190,'小時','事件',''],
  ];
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log('寫入點數定義種子資料：' + rows.length + ' 筆（51 筆，四種職務類型）');
}

function seedSystemConfig(ss) {
  var sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) return;
  if (sheet.getLastRow() > 1) {
    Logger.log('系統設定已有資料，略過種子');
    return;
  }
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  var configs = [
    ['companyName',        '綜合施工處',         '公司名稱'],
    ['contractStart',      '2026-01-01',         '契約開始日'],
    ['contractEnd',        '2026-12-31',         '契約結束日'],
    ['totalWorkers',       '11',                 '全案總人數'],
    ['totalMonths',        '12',                 '全案總月數'],
    ['holidays2026',       HOLIDAYS_2026.join(','), '115年國定假日（YYYY-MM-DD，逗號分隔）'],
    ['driveFolderId',      '',                   '佐證資料夾 ID（由 initAll 自動填入）'],
    ['gasWebAppUrl',       '',                   'GAS Web App URL（部署後請填入）'],
    ['isInitialized',      'true',               '防重複初始化旗標'],
    ['notificationEnabled','true',               'Email 通知總開關'],
    ['dailyReminderHour',  '16',                 '每日提醒時間（24h）'],
    ['monthlyReminderDay', '25',                 '月報提醒日期'],
    ['systemUrl',          '',                   '系統前端 URL'],
    ['adminEmails',        '',                   '異常報告收件者（逗號分隔）'],
    ['systemVersion',      '3.0.0',              '系統版本'],
    ['initializedAt',      now,                  '系統初始化時間'],
  ];
  sheet.getRange(2, 1, configs.length, 3).setValues(configs);
  Logger.log('寫入系統設定種子：' + configs.length + ' 筆');
}

function updateConfigValue(ss, key, value) {
  var sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value, '']);
}

function createDriveFolders() {
  var root = DriveApp.getRootFolder();
  var mainFolder;
  var existingMain = root.getFoldersByName(DRIVE_FOLDER_NAME);
  mainFolder = existingMain.hasNext() ? existingMain.next()
                                      : root.createFolder(DRIVE_FOLDER_NAME);

  var evidenceFolder;
  var existingEvidence = mainFolder.getFoldersByName('佐證資料');
  evidenceFolder = existingEvidence.hasNext() ? existingEvidence.next()
                                               : mainFolder.createFolder('佐證資料');

  // 建立月份子資料夾（2026-01 ~ 2026-12）
  for (var m = 1; m <= 12; m++) {
    var monthStr = '2026-' + (m < 10 ? '0' : '') + m;
    var ex = evidenceFolder.getFoldersByName(monthStr);
    if (!ex.hasNext()) evidenceFolder.createFolder(monthStr);
  }

  // 建立匯出報表資料夾
  var reportsName = '匯出報表';
  var existingReports = mainFolder.getFoldersByName(reportsName);
  if (!existingReports.hasNext()) mainFolder.createFolder(reportsName);

  try {
    evidenceFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  } catch(_) {}

  return { mainFolderId: mainFolder.getId(), folderId: evidenceFolder.getId() };
}

// ========== [登入驗證] ==========

function passwordLogin(email, passwordHash) {
  if (!email || !passwordHash) {
    return { success: false, error: '缺少 email 或 passwordHash' };
  }
  var ss = getAppSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailIdx = headers.indexOf(COLUMNS.USERS.EMAIL);
  var hashIdx  = headers.indexOf(COLUMNS.USERS.PASSWORD_HASH);
  var activeIdx = headers.indexOf(COLUMNS.USERS.IS_ACTIVE);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase() === String(email).toLowerCase()) {
      if (String(data[i][activeIdx]) !== 'true') {
        return { success: false, error: '帳號已停用' };
      }
      if (String(data[i][hashIdx]) === String(passwordHash)) {
        var worker = rowToObject(headers, data[i]);
        updateLastLogin(ss, i + 1, 'password');
        logActivity(email, 'login', '密碼登入成功');
        return { success: true, data: worker };
      }
      return { success: false, error: '密碼錯誤' };
    }
  }
  return { success: false, error: '查無此帳號：' + email };
}

function getMyProfile(callerEmail) {
  if (!callerEmail) return { success: false, error: '缺少 callerEmail' };
  var ss = getAppSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailIdx = headers.indexOf(COLUMNS.USERS.EMAIL);
  var activeIdx = headers.indexOf(COLUMNS.USERS.IS_ACTIVE);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase() === String(callerEmail).toLowerCase()) {
      if (String(data[i][activeIdx]) !== 'true') {
        return { success: false, error: '帳號已停用' };
      }
      var worker = rowToObject(headers, data[i]);
      updateLastLogin(ss, i + 1, 'google');
      logActivity(callerEmail, 'login', 'Google 登入成功');
      return { success: true, data: worker };
    }
  }
  return { success: false, error: '查無此帳號：' + callerEmail };
}

function updateLastLogin(ss, rowNum, method) {
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lastLoginIdx = headers.indexOf(COLUMNS.USERS.LAST_LOGIN) + 1;
  var methodIdx    = headers.indexOf(COLUMNS.USERS.LOGIN_METHOD) + 1;
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  if (lastLoginIdx > 0) sheet.getRange(rowNum, lastLoginIdx).setValue(now);
  if (methodIdx > 0)    sheet.getRange(rowNum, methodIdx).setValue(method);
}

function setWorkerPassword(callerEmail, workerId, passwordHash) {
  var perm = checkPermission(callerEmail, ['admin']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!workerId || !passwordHash) return { success: false, error: '缺少 workerId 或 passwordHash' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.USERS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idIdx   = headers.indexOf(COLUMNS.USERS.ID);
    var hashIdx = headers.indexOf(COLUMNS.USERS.PASSWORD_HASH);
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idIdx]) === String(workerId)) {
        sheet.getRange(i + 1, hashIdx + 1).setValue(passwordHash);
        return { success: true, message: '密碼已更新' };
      }
    }
    return { success: false, error: '找不到人員：' + workerId };
  } finally {
    lock.releaseLock();
  }
}

// ========== [使用者管理] ==========

function getWorkers(callerEmail) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS))
    .filter(function(w) {
      var role = String(w[COLUMNS.USERS.ROLE] || '');
      var isActive = String(w[COLUMNS.USERS.IS_ACTIVE]) === 'true';
      if (perm.callerRole === 'deptMgr' || perm.callerRole === 'billing') {
        return isActive && (role === 'worker' || role === 'billing');
      }
      return true;
    });

  // deptMgr 只能看本部門
  if (perm.callerRole === 'deptMgr') {
    workers = workers.filter(function(w) {
      return w[COLUMNS.USERS.DEPARTMENT] === perm.callerDept;
    });
  }
  // 過濾停用帳號（除非 admin 查看）
  if (perm.callerRole !== 'admin') {
    workers = workers.filter(function(w) {
      return String(w[COLUMNS.USERS.IS_ACTIVE]) === 'true';
    });
  }
  logActivity(callerEmail, 'query', '查詢人員列表');
  return { success: true, data: workers };
}

function upsertWorker(callerEmail, worker) {
  var perm = checkPermission(callerEmail, ['admin']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!worker) return { success: false, error: '缺少 worker 資料' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.USERS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idIdx = headers.indexOf(COLUMNS.USERS.ID);
    var now   = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

    // 尋找既有紀錄
    var targetRow = -1;
    if (worker[COLUMNS.USERS.ID] || worker.userId || worker.id) {
      var searchId = worker[COLUMNS.USERS.ID] || worker.userId || worker.id;
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][idIdx]) === String(searchId)) {
          targetRow = i + 1;
          break;
        }
      }
    }

    var newId = (worker[COLUMNS.USERS.ID] || worker.userId || worker.id ||
                 generateId('USR'));
    var row = [
      newId,
      worker[COLUMNS.USERS.NAME]         || worker.name         || '',
      worker[COLUMNS.USERS.EMAIL]        || worker.email        || '',
      worker[COLUMNS.USERS.PASSWORD_HASH]|| worker.passwordHash || '',
      worker[COLUMNS.USERS.ROLE]         || worker.role         || 'worker',
      worker[COLUMNS.USERS.DEPARTMENT]   || worker.department   || '',
      worker[COLUMNS.USERS.AREA]         || worker.area         || '',
      worker[COLUMNS.USERS.WORKER_TYPE]  || worker.workerType   || 'general',
      worker[COLUMNS.USERS.ONBOARD_DATE] || worker.onboardDate  || '',
      worker[COLUMNS.USERS.PAST_EXP_DAYS]  || worker.pastExpDays   || 0,
      worker[COLUMNS.USERS.PAST_EXP_DETAIL]|| worker.pastExpDetail || '',
      (worker[COLUMNS.USERS.IS_ACTIVE] !== undefined) ? worker[COLUMNS.USERS.IS_ACTIVE]
        : (worker.isActive !== undefined ? worker.isActive : true),
      (targetRow === -1) ? now : data[targetRow - 1][headers.indexOf(COLUMNS.USERS.CREATED_AT)],
      now,
      worker[COLUMNS.USERS.LOGIN_METHOD] || worker.loginMethod  || '',
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
      logActivity(callerEmail, 'update', '更新人員：' + newId);
    } else {
      sheet.appendRow(row);
      logActivity(callerEmail, 'update', '新增人員：' + newId);
    }
    return { success: true, data: { [COLUMNS.USERS.ID]: newId } };
  } finally {
    lock.releaseLock();
  }
}

// ========== [差勤管理] ==========

/**
 * 查詢差勤紀錄
 * worker 只能查自己，deptMgr 只能查本部門，其他角色可查全部
 */
function getAttendance(callerEmail, workerId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ss.getSheetByName(SHEETS.ATTENDANCE));

  records = records.filter(function(r) {
    var rid = r[COLUMNS.ATTENDANCE.USER_ID] || r['工號'] || r['userId'] || r['人員編號'];
    if (perm.callerRole === 'worker' && rid !== perm.callerUserId) return false;
    
    // deptMgr 只能查本部門
    if (perm.callerRole === 'deptMgr') {
      var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
      var worker  = workers.find(function(w) { return w[COLUMNS.USERS.ID] === rid; });
      if (!worker || worker[COLUMNS.USERS.DEPARTMENT] !== perm.callerDept) return false;
    }

    if (workerId && rid !== workerId) return false;
    if (yearMonth) {
      var rawDate = r[COLUMNS.ATTENDANCE.DATE];
      var dStr = "";
      if (rawDate instanceof Date) {
        dStr = Utilities.formatDate(rawDate, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
      } else {
        dStr = String(rawDate || "").substring(0, 10);
      }
      if (!dStr.startsWith(yearMonth.replace('/','-').substring(0,7))) return false;
    }
    return true;
  });

  // 重要：將 Date 物件轉為 yyyy-MM-dd 字串，防止 JSON 序列化時產生時區偏移（變成 UTC）
  var tz = ss.getSpreadsheetTimeZone();
  records = records.map(function(r) {
    var rawDate = r[COLUMNS.ATTENDANCE.DATE] || r['日期'] || r.date;
    if (rawDate instanceof Date) {
      var dStr = Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd');
      r[COLUMNS.ATTENDANCE.DATE] = dStr;
      r['日期'] = dStr;
      r.date = dStr;
    }
    return r;
  });

  return { success: true, data: records };
}

/**
 * 新增/更新差勤紀錄（一列 = 一人一日）
 * 自動計算有效工時與特休時數
 */
function upsertAttendance(callerEmail, record) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  var userId = record[COLUMNS.ATTENDANCE.USER_ID] || record['人員編號'] || record['工號'] || record.userId;
  var targetDateStr = record[COLUMNS.ATTENDANCE.DATE] || record['日期'] || record.date;
  
  if (!userId || !targetDateStr) {
    return { success: false, error: '缺少必要欄位（人員編號、日期）' };
  }

  if (perm.callerRole === 'worker' && userId !== perm.callerUserId) {
    return { success: false, error: '只能修改自己的差勤紀錄' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var userIdIdx = headers.indexOf(COLUMNS.ATTENDANCE.USER_ID);
    var dateIdx   = headers.indexOf(COLUMNS.ATTENDANCE.DATE);
    var finalIdx  = headers.indexOf(COLUMNS.ATTENDANCE.IS_FINALIZED);

    var targetDate = String(targetDateStr).substring(0, 10);
    var targetRow  = -1;

    for (var i = 1; i < data.length; i++) {
      var sheetDate = data[i][dateIdx];
      var sheetDateStr = (sheetDate instanceof Date)
        ? Utilities.formatDate(sheetDate, 'Asia/Taipei', 'yyyy-MM-dd')
        : String(sheetDate).substring(0, 10);
      if (String(data[i][userIdIdx]) === String(userId) &&
          sheetDateStr === targetDate) {
        // 已鎖定不可修改
        if (String(data[i][finalIdx]) === 'true' && perm.callerRole !== 'admin') {
          return { success: false, error: '差勤已鎖定，無法修改' };
        }
        targetRow = i + 1;
        break;
      }
    }

    var amStatus = record[COLUMNS.ATTENDANCE.AM_STATUS] || record['上午狀態'] || record.amStatus || '';
    var pmStatus = record[COLUMNS.ATTENDANCE.PM_STATUS] || record['下午狀態'] || record.pmStatus || '';
    var workLeave = calcWorkAndLeave(amStatus, pmStatus);
    var source    = record[COLUMNS.ATTENDANCE.SOURCE] || record['資料來源'] || record.source || 'actual';
    var now       = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

    var row = [
      userId,
      targetDate,
      amStatus,
      pmStatus,
      workLeave.workHours,
      workLeave.leaveHours,
      source,
      (record[COLUMNS.ATTENDANCE.IS_FINALIZED] === true || record[COLUMNS.ATTENDANCE.IS_FINALIZED] === 'true' || record['是否鎖定'] === 'true'),
      record[COLUMNS.ATTENDANCE.NOTE] || record['備註'] || record.note || '',
      now,
      record[COLUMNS.ATTENDANCE.LEAVE_TIME] || record['請假時間'] || record.leaveTime || '',
      record[COLUMNS.ATTENDANCE.MODIFY_REASON] || record['修改原因'] || record.modifyReason || '',
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    logActivity(callerEmail, 'update', '更新差勤：' + userId + ' ' + targetDate);
    return { success: true, message: '差勤紀錄已更新' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 批次新增/更新差勤紀錄
 */
function batchUpsertAttendance(callerEmail, records) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!records || !Array.isArray(records) || records.length === 0) {
    return { success: false, error: '缺少紀錄陣列' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var userIdIdx = headers.indexOf(COLUMNS.ATTENDANCE.USER_ID);
    var dateIdx   = headers.indexOf(COLUMNS.ATTENDANCE.DATE);
    var finalIdx  = headers.indexOf(COLUMNS.ATTENDANCE.IS_FINALIZED);

    var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
    var updatedCount = 0;
    var newRows = [];

    for (var k = 0; k < records.length; k++) {
      var record = records[k];
      var userId = record[COLUMNS.ATTENDANCE.USER_ID] || record['人員編號'] || record['工號'] || record.userId;
      if (!userId) continue;

      if (perm.callerRole === 'worker' && String(userId) !== String(perm.callerUserId)) {
        continue; // Skip others' records if worker
      }

      var targetDateStr = record[COLUMNS.ATTENDANCE.DATE] || record['日期'] || record.date;
      if (!targetDateStr) continue;

      var targetDate = String(targetDateStr).substring(0, 10);
      var targetRow  = -1;
      var isLocked = false;

      for (var i = 1; i < data.length; i++) {
        var sheetDate = data[i][dateIdx];
        var sheetDateStr = (sheetDate instanceof Date)
          ? Utilities.formatDate(sheetDate, 'Asia/Taipei', 'yyyy-MM-dd')
          : String(sheetDate).substring(0, 10);
        if (String(data[i][userIdIdx]) === String(userId) &&
            sheetDateStr === targetDate) {
          if (String(data[i][finalIdx]) === 'true' && perm.callerRole !== 'admin') {
            isLocked = true;
          }
          targetRow = i + 1;
          break;
        }
      }

      if (isLocked) continue;

      var amStatus = record[COLUMNS.ATTENDANCE.AM_STATUS] || record['上午狀態'] || record.amStatus || '';
      var pmStatus = record[COLUMNS.ATTENDANCE.PM_STATUS] || record['下午狀態'] || record.pmStatus || '';
      var workLeave = calcWorkAndLeave(amStatus, pmStatus);
      var source    = record[COLUMNS.ATTENDANCE.SOURCE] || record['資料來源'] || record.source || 'actual';

      var row = [
        userId,
        targetDate,
        amStatus,
        pmStatus,
        workLeave.workHours,
        workLeave.leaveHours,
        source,
        (record[COLUMNS.ATTENDANCE.IS_FINALIZED] === true || record[COLUMNS.ATTENDANCE.IS_FINALIZED] === 'true' || record['是否鎖定'] === 'true'),
        record[COLUMNS.ATTENDANCE.NOTE] || record['備註'] || record.note || '',
        now,
        record[COLUMNS.ATTENDANCE.LEAVE_TIME] || record['請假時間'] || record.leaveTime || '',
        record[COLUMNS.ATTENDANCE.MODIFY_REASON] || record['修改原因'] || record.modifyReason || '',
      ];

      if (targetRow > 0) {
        sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
        // Update data array in memory so subsequent same-date records in the same batch update correctly (though unlikely)
        data[targetRow - 1] = row;
        updatedCount++;
      } else {
        newRows.push(row);
      }
    }

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
      updatedCount += newRows.length;
    }

    logActivity(callerEmail, 'update', '批次更新差勤：' + updatedCount + ' 筆');
    return { success: true, message: '已更新 ' + updatedCount + ' 筆差勤紀錄' };
  } finally {
    lock.releaseLock();
  }
}


/**
 * 計算有效工時與特休時數
 * 狀態格式：／ | 特N | 病N | 事N | 婚N | 喪N | 公N | 代_姓名 | 曠 | （空白）
 */
function calcWorkAndLeave(amStatus, pmStatus) {
  function parseHours(status) {
    var s = (status || '').trim();
    if (!s || s === '') return { work: 0, leave: 0 };
    if (s === '／' || s === '出勤') return { work: 4, leave: 0 };
    if (s.startsWith('代')) return { work: 4, leave: 0 };
    
    var match = s.match(/^(特|病|事|婚|喪|公)(\d+(\.\d+)?)?$/);
    if (match) {
      var type = match[1];
      var h = parseFloat(match[2]) || 4;
      var remainingWork = Math.max(0, 4 - h);
      if (type === '特') {
        return { work: remainingWork, leave: h };
      }
      return { work: remainingWork, leave: 0 };
    }
    return { work: 0, leave: 0 };
  }
  var am = parseHours(amStatus);
  var pm = parseHours(pmStatus);
  return {
    workHours:  am.work  + pm.work,
    leaveHours: am.leave + pm.leave,
  };
}

/**
 * 自動產生當月所有工作日預設出勤（Admin only）
 * 資料來源 = auto，上午/下午狀態 = ／
 * 跳過週末與國定假日
 */
function generateMonthlyAttendance(callerEmail, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!yearMonth) return { success: false, error: '缺少 yearMonth（格式 YYYY-MM）' };

  var ss = getAppSpreadsheet();
  var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS))
    .filter(function(w) { return String(w[COLUMNS.USERS.IS_ACTIVE]) === 'true'; });

  var config = getConfigObject(ss);
  var holidays = (config.holidays2026 || '').split(',').filter(Boolean);

  // 解析 yearMonth → 第一天到最後一天
  var parts = yearMonth.split('-');
  var year = parseInt(parts[0]);
  var month = parseInt(parts[1]);
  var startDate = new Date(year, month - 1, 1);
  var endDate   = new Date(year, month, 0);  // 該月最後一天

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
    var existing = sheetToObjects(sheet);
    var existKey = {};
    existing.forEach(function(r) {
      existKey[r[COLUMNS.ATTENDANCE.USER_ID] + '_' + r[COLUMNS.ATTENDANCE.DATE]] = true;
    });

    var newRows = [];
    var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

    workers.forEach(function(worker) {
      var uid = worker[COLUMNS.USERS.ID];
      var d = new Date(startDate);
      while (d <= endDate) {
        var dow  = d.getDay();     // 0=日, 6=六
        var dStr = Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
        var isWeekend  = (dow === 0 || dow === 6);
        var isHoliday  = (holidays.indexOf(dStr) !== -1);
        if (!isWeekend && !isHoliday) {
          var key = uid + '_' + dStr;
          if (!existKey[key]) {
            newRows.push([uid, dStr, '／', '／', 8, 0, 'auto', false, '', now]);
          }
        }
        d.setDate(d.getDate() + 1);
      }
    });

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length)
           .setValues(newRows);
    }
    logActivity(callerEmail, 'update', '產生 ' + yearMonth + ' 預排差勤：' + newRows.length + ' 筆');
    return { success: true, message: '產生 ' + newRows.length + ' 筆預排差勤' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 廠商確認鎖定差勤（Billing / Admin）
 * 同時觸發 S 類與 P 類點數自動計算
 */
function finalizeAttendance(callerEmail, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','billing']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!yearMonth) return { success: false, error: '缺少 yearMonth' };

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.ATTENDANCE);
    var data  = sheet.getDataRange().getValues();
    var headers = data[0];
    var dateIdx  = headers.indexOf(COLUMNS.ATTENDANCE.DATE);
    var finalIdx = headers.indexOf(COLUMNS.ATTENDANCE.IS_FINALIZED);
    var ym = yearMonth.replace('/', '-').substring(0, 7);

    var updated = 0;
    for (var i = 1; i < data.length; i++) {
      var rawDate = data[i][dateIdx];
      var d = (rawDate instanceof Date)
        ? Utilities.formatDate(rawDate, 'Asia/Taipei', 'yyyy-MM-dd')
        : String(rawDate).substring(0, 10);
      if (d.startsWith(ym)) {
        sheet.getRange(i + 1, finalIdx + 1).setValue(true);
        updated++;
      }
    }

    // 自動計算 S/P 類點數
    autoCalcSPPoints(ss, yearMonth);

    logActivity(callerEmail, 'update', '鎖定 ' + yearMonth + ' 差勤：' + updated + ' 筆');
    return { success: true, message: '已鎖定 ' + updated + ' 筆差勤並計算 S/P 點數' };
  } finally {
    lock.releaseLock();
  }
}

// ========== [點數管理] ==========

function getDailyPoints(callerEmail, workerId, date, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ss.getSheetByName(SHEETS.DAILY_POINTS));

  records = records.filter(function(r) {
    var uid = r[COLUMNS.DAILY_POINTS.USER_ID];
    if (perm.callerRole === 'worker' && uid !== perm.callerUserId) return false;
    if (workerId && uid !== workerId) return false;
    if (date) {
      var sheetDate = r[COLUMNS.DAILY_POINTS.DATE];
      if (sheetDate instanceof Date) sheetDate = Utilities.formatDate(sheetDate, 'Asia/Taipei', 'yyyy-MM-dd');
      else sheetDate = String(sheetDate).substring(0, 10);
      if (sheetDate !== String(date)) return false;
    } else if (yearMonth) {
      var sheetDate = r[COLUMNS.DAILY_POINTS.DATE];
      if (sheetDate instanceof Date) sheetDate = Utilities.formatDate(sheetDate, 'Asia/Taipei', 'yyyy-MM-dd');
      else sheetDate = String(sheetDate).substring(0, 10);
      var ym = yearMonth.replace('/', '-').substring(0, 7);
      if (!sheetDate.startsWith(ym)) return false;
    }
    return true;
  });

  return { success: true, data: records };
}

function saveDailyPoints(callerEmail, record) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!record) return { success: false, error: '缺少 record 資料' };

  var userId = record[COLUMNS.DAILY_POINTS.USER_ID] || record.userId;
  if (perm.callerRole === 'worker' && userId !== perm.callerUserId) {
    return { success: false, error: '只能修改自己的點數' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.DAILY_POINTS);
    var data  = sheet.getDataRange().getValues();
    var headers = data[0];
    var ridIdx    = headers.indexOf(COLUMNS.DAILY_POINTS.RECORD_ID);
    var uidIdx    = headers.indexOf(COLUMNS.DAILY_POINTS.USER_ID);
    var dateIdx   = headers.indexOf(COLUMNS.DAILY_POINTS.DATE);
    var itemIdIdx = headers.indexOf(COLUMNS.DAILY_POINTS.ITEM_ID);

    var recordId = record[COLUMNS.DAILY_POINTS.RECORD_ID] || record.recordId;
    var targetRow = -1;

    if (recordId) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][ridIdx]) === String(recordId)) {
          targetRow = i + 1; break;
        }
      }
    } else if (userId && record[COLUMNS.DAILY_POINTS.DATE] && record[COLUMNS.DAILY_POINTS.ITEM_ID]) {
      for (var j = 1; j < data.length; j++) {
        var rowDate = data[j][dateIdx];
        if (rowDate instanceof Date) rowDate = Utilities.formatDate(rowDate, 'Asia/Taipei', 'yyyy-MM-dd');
        else rowDate = String(rowDate).substring(0, 10);
        
        if (String(data[j][uidIdx])    === String(userId) &&
            rowDate                    === String(record[COLUMNS.DAILY_POINTS.DATE]) &&
            String(data[j][itemIdIdx]) === String(record[COLUMNS.DAILY_POINTS.ITEM_ID])) {
          targetRow = j + 1;
          recordId  = data[j][ridIdx];
          break;
        }
      }
    }

    if (!recordId) recordId = generateId('DP');
    var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

    var row = [
      recordId,
      userId,
      record[COLUMNS.DAILY_POINTS.DATE]      || record.date      || '',
      record[COLUMNS.DAILY_POINTS.ITEM_ID]   || record.itemId    || '',
      record[COLUMNS.DAILY_POINTS.QUANTITY]  || record.quantity  || 1,
      record[COLUMNS.DAILY_POINTS.POINTS]    || record.points    || 0,
      record[COLUMNS.DAILY_POINTS.FILE_IDS]  || record.fileIds   || '',
      record[COLUMNS.DAILY_POINTS.STATUS]    || record.status    || 'draft',
      record[COLUMNS.DAILY_POINTS.NOTE]      || record.note || (targetRow > 0 ? data[targetRow - 1][headers.indexOf(COLUMNS.DAILY_POINTS.NOTE)] : ''),
      (targetRow > 0)
        ? data[targetRow - 1][headers.indexOf(COLUMNS.DAILY_POINTS.UPLOADED_AT)]
        : now,
      now,
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return { success: true, data: { recordId: recordId } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 批次送出當日所有 A1 點數 + 佐證
 * 自動依出勤狀態計算點數比例（全天/半天/缺勤）
 */
function saveDailyPointsBatch(callerEmail, workerId, date, items) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!workerId || !date || !items) return { success: false, error: '缺少必要參數' };
  if (perm.callerRole === 'worker' && workerId !== perm.callerUserId) {
    return { success: false, error: '只能提交自己的點數' };
  }

  // 取得該日出勤狀態，計算點數比例
  // 若差勤表尚無該日紀錄（例如尚未同步），預設按全天計算（ratio=1）
  var ss = getAppSpreadsheet();
  var attRecords = sheetToObjects(ss.getSheetByName(SHEETS.ATTENDANCE));
  var ratio = 1;          // 預設全天 — 避免因缺差勤紀錄而將點數歸零
  var attFound = false;
  for (var k = 0; k < attRecords.length; k++) {
    var r = attRecords[k];
    var sheetDate = r[COLUMNS.ATTENDANCE.DATE];
    if (sheetDate instanceof Date) {
      sheetDate = Utilities.formatDate(sheetDate, 'Asia/Taipei', 'yyyy-MM-dd');
    } else {
      sheetDate = String(sheetDate).substring(0, 10);
    }
    if (r[COLUMNS.ATTENDANCE.USER_ID] === workerId && sheetDate === String(date)) {
      var wh = parseFloat(r[COLUMNS.ATTENDANCE.WORK_HOURS]) || 0;
      if (wh >= 8)      ratio = 1;
      else if (wh >= 4) ratio = 0.5;
      else              ratio = 0;
      attFound = true;
      break;
    }
  }
  if (!attFound) {
    Logger.log('saveDailyPointsBatch: ' + workerId + ' ' + date +
               ' 找不到差勤紀錄，以全天(ratio=1)計算');
  }

  var errors = [];
  var saved  = 0;
  items.forEach(function(item) {
    // 優先使用前端傳來的 pointsPerUnit，其次 points
    var declared = parseFloat(item.pointsPerUnit || item.points || 0);
    var pts = Math.round(declared * ratio);
    var rec = {};
    rec[COLUMNS.DAILY_POINTS.USER_ID]  = workerId;
    rec[COLUMNS.DAILY_POINTS.DATE]     = date;
    rec[COLUMNS.DAILY_POINTS.ITEM_ID]  = item.itemId || '';
    rec[COLUMNS.DAILY_POINTS.QUANTITY] = item.quantity || 1;
    rec[COLUMNS.DAILY_POINTS.POINTS]   = pts;
    rec[COLUMNS.DAILY_POINTS.FILE_IDS] = (item.fileIds || []).join(',');
    rec[COLUMNS.DAILY_POINTS.STATUS]   = 'submitted';
    if (item.note) rec[COLUMNS.DAILY_POINTS.NOTE] = item.note;
    var result = saveDailyPoints(callerEmail, rec);
    if (result.success) saved++;
    else errors.push(item.itemId + ': ' + result.error);
  });

  logActivity(callerEmail, 'update',
    '批次儲存 ' + date + ' 每日點數：' + saved + ' 筆' +
    (errors.length ? '（錯誤：' + errors.join('; ') + '）' : ''));
  return {
    success: errors.length === 0,
    message: '儲存 ' + saved + '/' + items.length + ' 筆',
    errors: errors,
  };
}

function getMonthlyPoints(callerEmail, workerId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ensureSheet(ss, SHEETS.MONTHLY_POINTS, COLUMNS.MONTHLY_POINTS));

  records = records.filter(function(r) {
    var uid = r[COLUMNS.MONTHLY_POINTS.USER_ID];
    if (perm.callerRole === 'worker' && uid !== perm.callerUserId) return false;

    // deptMgr 只能查本部門
    if (perm.callerRole === 'deptMgr') {
      var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
      var worker  = workers.find(function(w) { return w[COLUMNS.USERS.ID] === uid; });
      if (!worker || worker[COLUMNS.USERS.DEPARTMENT] !== perm.callerDept) return false;
    }

    if (workerId && uid !== workerId) return false;
    var sheetYM = r[COLUMNS.MONTHLY_POINTS.YEAR_MONTH];
    if (sheetYM instanceof Date) sheetYM = Utilities.formatDate(sheetYM, 'Asia/Taipei', 'yyyy-MM');
    else sheetYM = String(sheetYM).substring(0, 7);
    if (yearMonth && sheetYM !== yearMonth) return false;
    return true;
  });

  return { success: true, data: records };
}

function saveMonthlyPoints(callerEmail, record) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!record) return { success: false, error: '缺少 record 資料' };

  // 春節項目限 2026-02
  var itemId = record[COLUMNS.MONTHLY_POINTS.ITEM_ID] || record.itemId || '';
  var ym = record[COLUMNS.MONTHLY_POINTS.YEAR_MONTH] || record.yearMonth || '';
  if (itemId.indexOf('-B2-') !== -1 && String(ym).indexOf('2026-02') === -1) {
    return { success: false, error: '春節強化作業點數僅限 2026-02 填報' };
  }


  var userId = record[COLUMNS.MONTHLY_POINTS.USER_ID] || record.userId;
  if (perm.callerRole === 'worker' && userId !== perm.callerUserId) {
    return { success: false, error: '只能修改自己的月度點數' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ensureSheet(ss, SHEETS.MONTHLY_POINTS, COLUMNS.MONTHLY_POINTS);
    var data  = sheet.getDataRange().getValues();
    var headers = data[0];
    var ridIdx    = headers.indexOf(COLUMNS.MONTHLY_POINTS.RECORD_ID);
    var uidIdx    = headers.indexOf(COLUMNS.MONTHLY_POINTS.USER_ID);
    var ymIdx     = headers.indexOf(COLUMNS.MONTHLY_POINTS.YEAR_MONTH);
    var itemIdIdx = headers.indexOf(COLUMNS.MONTHLY_POINTS.ITEM_ID);

    var recordId = record[COLUMNS.MONTHLY_POINTS.RECORD_ID] || record.recordId;
    var targetRow = -1;

    if (recordId) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][ridIdx]) === String(recordId)) {
          targetRow = i + 1; break;
        }
      }
    } else {
      var ym = record[COLUMNS.MONTHLY_POINTS.YEAR_MONTH] || record.yearMonth;
      var itemId = record[COLUMNS.MONTHLY_POINTS.ITEM_ID] || record.itemId;
      for (var j = 1; j < data.length; j++) {
        var rowYm = data[j][ymIdx];
        if (rowYm instanceof Date) rowYm = Utilities.formatDate(rowYm, 'Asia/Taipei', 'yyyy-MM');
        else rowYm = String(rowYm).substring(0, 7);
        if (String(data[j][uidIdx])    === String(userId) &&
            rowYm                      === String(ym) &&
            String(data[j][itemIdIdx]) === String(itemId)) {
          targetRow = j + 1;
          recordId  = data[j][ridIdx];
          break;
        }
      }
    }

    if (!recordId) recordId = generateId('MP');
    var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
    var row = [
      recordId,
      userId,
      record[COLUMNS.MONTHLY_POINTS.YEAR_MONTH]  || record.yearMonth  || '',
      record[COLUMNS.MONTHLY_POINTS.ITEM_ID]     || record.itemId     || '',
      record[COLUMNS.MONTHLY_POINTS.QUANTITY]    || record.quantity   || 1,
      record[COLUMNS.MONTHLY_POINTS.POINTS]      || record.points     || 0,
      record[COLUMNS.MONTHLY_POINTS.FILE_IDS]    || record.fileIds    || '',
      record[COLUMNS.MONTHLY_POINTS.PERF_LEVEL]  || record.perfLevel  || '',
      record[COLUMNS.MONTHLY_POINTS.STATUS]      || record.status     || 'draft',
      record[COLUMNS.MONTHLY_POINTS.NOTE]        || record.note       || (targetRow > 0 ? data[targetRow - 1][headers.indexOf(COLUMNS.MONTHLY_POINTS.NOTE)] : ''),
      (targetRow > 0)
        ? data[targetRow - 1][headers.indexOf(COLUMNS.MONTHLY_POINTS.UPLOADED_AT)]
        : now,
      now,
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    return { success: true, data: { recordId: recordId } };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 協助員送出月報（狀態 draft → submitted）
 */
function submitMonthlyReport(callerEmail, workerId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (perm.callerRole === 'worker' && workerId !== perm.callerUserId) {
    return { success: false, error: '只能送出自己的月報' };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ensureSheet(ss, SHEETS.MONTHLY_POINTS, COLUMNS.MONTHLY_POINTS);
    var data  = sheet.getDataRange().getValues();
    var headers = data[0];
    var uidIdx  = headers.indexOf(COLUMNS.MONTHLY_POINTS.USER_ID);
    var ymIdx   = headers.indexOf(COLUMNS.MONTHLY_POINTS.YEAR_MONTH);
    var statIdx = headers.indexOf(COLUMNS.MONTHLY_POINTS.STATUS);
    var now     = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
    var updated = 0;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][uidIdx]) === String(workerId) &&
          String(data[i][ymIdx])  === String(yearMonth) &&
          data[i][statIdx] === 'draft') {
        sheet.getRange(i + 1, statIdx + 1).setValue('submitted');
        updated++;
      }
    }

    // 同步更新每日點數狀態
    var dpSheet = ss.getSheetByName(SHEETS.DAILY_POINTS);
    var dpData  = dpSheet.getDataRange().getValues();
    var dpHeaders = dpData[0];
    var dpUidIdx  = dpHeaders.indexOf(COLUMNS.DAILY_POINTS.USER_ID);
    var dpDateIdx = dpHeaders.indexOf(COLUMNS.DAILY_POINTS.DATE);
    var dpStatIdx = dpHeaders.indexOf(COLUMNS.DAILY_POINTS.STATUS);
    var ym = yearMonth.replace('/', '-').substring(0, 7);

    for (var j = 1; j < dpData.length; j++) {
      if (String(dpData[j][dpUidIdx]) === String(workerId) &&
          String(dpData[j][dpDateIdx]).startsWith(ym) &&
          dpData[j][dpStatIdx] === 'draft') {
        dpSheet.getRange(j + 1, dpStatIdx + 1).setValue('submitted');
      }
    }

    writeReviewLog(ss, workerId, yearMonth, perm.callerUserId, 'submit', '', '');
    logActivity(callerEmail, 'update', '送出月報：' + workerId + ' ' + yearMonth);
    return { success: true, message: '月報已送出，更新 ' + updated + ' 筆' };
  } finally {
    lock.releaseLock();
  }
}

// ========== [審核流程] ==========

/**
 * 審核動作
 * action2: '初審通過' | '退回修改' | '廠商確認' | '廠商退回' | '已請款'
 */
function reviewItem(callerEmail, action2, workerId, yearMonth, reason, perfLevel, points) {
  if (!action2) return { success: false, error: '缺少審核動作' };

  // 驗證角色與動作合法性
  var allowedRoles;
  if (action2 === '初審通過' || action2 === '退回修改') {
    allowedRoles = ['admin','deptMgr'];
  } else if (action2 === '廠商確認' || action2 === '廠商退回' || action2 === '已請款') {
    allowedRoles = ['admin','billing'];
  } else {
    return { success: false, error: '未知的審核動作：' + action2 };
  }

  var perm = checkPermission(callerEmail, allowedRoles);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = getAppSpreadsheet();

    // deptMgr 只能核定本部門的人員
    if (perm.callerRole === 'deptMgr') {
      var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
      var targetWorker = workers.find(function(w) { return w[COLUMNS.USERS.ID] === workerId; });
      if (!targetWorker || targetWorker[COLUMNS.USERS.DEPARTMENT] !== perm.callerDept) {
        return { success: false, error: '權限錯誤：無法核定非本部門人員' };
      }
    }

    var body = {};
    try {
      // 嘗試從請求中取得額外參數 (如果是透過 doPost 傳入)
      // 但 reviewItem 是被 doPost 呼叫的，參數已經展開
    } catch(_) {}

    var newStatus = actionToStatus(action2);
    var before = getCurrentStatus(ss, workerId, yearMonth);

    // 處理 C 類績效核定 (若有傳入評等與點數)
    // 注意：這裡假設 reviewItem 可能透過 e.parameter (GET) 或 body (POST) 呼叫
    // 在本系統中 reviewItem 主要透過 doPost 呼叫，但我們需要確保參數能傳入
    // 修改 reviewItem 的宣告以支援更多參數：reviewItem(callerEmail, action2, workerId, yearMonth, reason, perfLevel, points)
    
    updatePointsStatus(ss, workerId, yearMonth, newStatus);

    // 處理 C 類績效核定 (由 deptMgr 在初審時設定)
    if (perfLevel && (action2 === '初審通過' || action2 === 'admin_save')) {
      updatePerfAssessment(ss, workerId, yearMonth, perfLevel, parseFloat(points) || 0);
    }

    writeReviewLog(ss, workerId, yearMonth, perm.callerUserId, action2, reason,
                   JSON.stringify({ before: before, after: newStatus, perfLevel: perfLevel, points: points }));

    // 廠商確認時自動產生月結快照
    if (action2 === '廠商確認') {
      generateMonthlySnapshot(ss, workerId, yearMonth, perm.callerUserId);
    }

    logActivity(callerEmail, 'review',
      action2 + '：' + workerId + ' ' + yearMonth +
      (reason ? ' (' + reason + ')' : ''));
    return { success: true, message: '審核動作完成：' + action2 };
  } finally {
    lock.releaseLock();
  }
}

function updatePerfAssessment(ss, workerId, yearMonth, perfLevel, points) {
  var sheet = ss.getSheetByName(SHEETS.MONTHLY_POINTS);
  var data  = sheet.getDataRange().getValues();
  var headers = data[0];
  var uidIdx  = headers.indexOf(COLUMNS.MONTHLY_POINTS.USER_ID);
  var ymIdx   = headers.indexOf(COLUMNS.MONTHLY_POINTS.YEAR_MONTH);
  var itemIdx = headers.indexOf(COLUMNS.MONTHLY_POINTS.ITEM_ID);
  var perfIdx = headers.indexOf(COLUMNS.MONTHLY_POINTS.PERF_LEVEL);
  var ptsIdx  = headers.indexOf(COLUMNS.MONTHLY_POINTS.POINTS);
  var qtyIdx  = headers.indexOf(COLUMNS.MONTHLY_POINTS.QUANTITY);

  for (var i = 1; i < data.length; i++) {
    var rowYm = data[i][ymIdx];
    if (rowYm instanceof Date) rowYm = Utilities.formatDate(rowYm, 'Asia/Taipei', 'yyyy-MM');
    else rowYm = String(rowYm).substring(0, 7);

    var itemId = String(data[i][itemIdx]);
    if (String(data[i][uidIdx]) === String(workerId) && 
        rowYm === String(yearMonth) && 
        itemId.indexOf('-C-') !== -1) {
      
      if (perfLevel) sheet.getRange(i + 1, perfIdx + 1).setValue(perfLevel);
      if (points !== undefined) sheet.getRange(i + 1, ptsIdx + 1).setValue(points);
      sheet.getRange(i + 1, qtyIdx + 1).setValue(1); // 核定後視同完成
    }
  }
}

function actionToStatus(action2) {
  var map = {
    '初審通過':   'dept_approved',
    '退回修改':   'rejected',
    '廠商確認':   'billing_confirmed',
    '廠商退回':   'rejected',
    '已請款':     'billed',
    'submit':     'submitted',
  };
  return map[action2] || 'submitted';
}

function getCurrentStatus(ss, workerId, yearMonth) {
  var sheet = ss.getSheetByName(SHEETS.MONTHLY_POINTS);
  var records = sheetToObjects(sheet);
  var ym = String(yearMonth);
  for (var i = 0; i < records.length; i++) {
    if (records[i][COLUMNS.MONTHLY_POINTS.USER_ID]    === workerId &&
        records[i][COLUMNS.MONTHLY_POINTS.YEAR_MONTH] === ym) {
      return records[i][COLUMNS.MONTHLY_POINTS.STATUS];
    }
  }
  return 'unknown';
}

function updatePointsStatus(ss, workerId, yearMonth, newStatus) {
  var mpSheet = ss.getSheetByName(SHEETS.MONTHLY_POINTS);
  var mpData  = mpSheet.getDataRange().getValues();
  var mpH     = mpData[0];
  var mpUid   = mpH.indexOf(COLUMNS.MONTHLY_POINTS.USER_ID);
  var mpYm    = mpH.indexOf(COLUMNS.MONTHLY_POINTS.YEAR_MONTH);
  var mpStat  = mpH.indexOf(COLUMNS.MONTHLY_POINTS.STATUS);

  for (var i = 1; i < mpData.length; i++) {
    if (String(mpData[i][mpUid]) === String(workerId) &&
        String(mpData[i][mpYm])  === String(yearMonth)) {
      mpSheet.getRange(i + 1, mpStat + 1).setValue(newStatus);
    }
  }

  // 同步每日點數
  var dpSheet = ss.getSheetByName(SHEETS.DAILY_POINTS);
  var dpData  = dpSheet.getDataRange().getValues();
  var dpH     = dpData[0];
  var dpUid   = dpH.indexOf(COLUMNS.DAILY_POINTS.USER_ID);
  var dpDate  = dpH.indexOf(COLUMNS.DAILY_POINTS.DATE);
  var dpStat  = dpH.indexOf(COLUMNS.DAILY_POINTS.STATUS);
  var ym = String(yearMonth).replace('/', '-').substring(0, 7);

  for (var j = 1; j < dpData.length; j++) {
    if (String(dpData[j][dpUid]) === String(workerId) &&
        String(dpData[j][dpDate]).startsWith(ym)) {
      dpSheet.getRange(j + 1, dpStat + 1).setValue(newStatus);
    }
  }
}

function writeReviewLog(ss, workerId, yearMonth, reviewerId, action2, reason, changeDetail) {
  var sheet = ss.getSheetByName(SHEETS.REVIEW_LOG);
  var now   = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  sheet.appendRow([
    generateId('RL'),
    workerId,
    yearMonth,
    reviewerId,
    action2,
    now,
    reason || '',
    changeDetail || '',
  ]);
}

/**
 * 產生月結快照（廠商確認時自動觸發）
 */
function generateMonthlySnapshot(ss, workerId, yearMonth, confirmerId) {
  var ym = String(yearMonth).replace('/', '-').substring(0, 7);

  // 彙算每日點數（A1/A2 類）
  var dpRecords = sheetToObjects(ss.getSheetByName(SHEETS.DAILY_POINTS))
    .filter(function(r) {
      return r[COLUMNS.DAILY_POINTS.USER_ID] === workerId &&
             String(r[COLUMNS.DAILY_POINTS.DATE]).startsWith(ym);
    });

  var aTotal = 0;
  dpRecords.forEach(function(r) {
    aTotal += parseFloat(r[COLUMNS.DAILY_POINTS.POINTS]) || 0;
  });

  // 彙算月度點數（B/C/D/S/P 類）
  var mpRecords = sheetToObjects(ss.getSheetByName(SHEETS.MONTHLY_POINTS))
    .filter(function(r) {
      return r[COLUMNS.MONTHLY_POINTS.USER_ID]    === workerId &&
             r[COLUMNS.MONTHLY_POINTS.YEAR_MONTH] === yearMonth;
    });

  var bTotal = 0, cAmount = 0, dTotal = 0, sAmount = 0, pDeduction = 0;
  mpRecords.forEach(function(r) {
    var pts  = parseFloat(r[COLUMNS.MONTHLY_POINTS.POINTS]) || 0;
    var cat  = String(r[COLUMNS.MONTHLY_POINTS.ITEM_ID]).split('-')[1] || '';
    if (cat === 'B1' || cat === 'B2') bTotal   += pts;
    else if (cat === 'C')             cAmount  += pts;
    else if (cat === 'D1' || cat === 'D2') dTotal += pts;
    else if (cat === 'S')             sAmount  += pts;
    else if (cat === 'P')             pDeduction += pts;
  });

  // 差勤統計
  var attRecords = sheetToObjects(ss.getSheetByName(SHEETS.ATTENDANCE))
    .filter(function(r) {
      return r[COLUMNS.ATTENDANCE.USER_ID] === workerId &&
             String(r[COLUMNS.ATTENDANCE.DATE]).startsWith(ym);
    });

  var workDays  = 0;
  var leaveHrs  = 0;
  attRecords.forEach(function(r) {
    var wh = parseFloat(r[COLUMNS.ATTENDANCE.WORK_HOURS])  || 0;
    var lh = parseFloat(r[COLUMNS.ATTENDANCE.LEAVE_HOURS]) || 0;
    if (wh > 0) workDays++;
    leaveHrs += lh;
  });

  var monthTotal = (aTotal || 0) + (bTotal || 0) + (cAmount || 0) + (dTotal || 0) + (sAmount || 0) - (pDeduction || 0);
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

  var snapshotSheet = ss.getSheetByName(SHEETS.MONTHLY_SNAPSHOT);
  snapshotSheet.appendRow([
    generateId('MS'),
    workerId,
    yearMonth,
    aTotal || 0, bTotal || 0, cAmount || 0, dTotal || 0, sAmount || 0, pDeduction || 0,
    monthTotal || 0, workDays || 0, leaveHrs || 0, now, confirmerId, role,
  ]);

  Logger.log('產生月結快照：' + workerId + ' ' + yearMonth +
             ' 總計=' + monthTotal);
}

function getMonthlySnapshot(callerEmail, workerId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ss.getSheetByName(SHEETS.MONTHLY_SNAPSHOT));

  records = records.filter(function(r) {
    var uid = r[COLUMNS.MONTHLY_SNAPSHOT.USER_ID];
    if (perm.callerRole === 'worker' && uid !== perm.callerUserId) return false;

    // deptMgr 只能查本部門
    if (perm.callerRole === 'deptMgr') {
      var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
      var worker  = workers.find(function(w) { return w[COLUMNS.USERS.ID] === uid; });
      if (!worker || worker[COLUMNS.USERS.DEPARTMENT] !== perm.callerDept) return false;
    }

    if (workerId && uid !== workerId) return false;
    if (yearMonth && r[COLUMNS.MONTHLY_SNAPSHOT.YEAR_MONTH] !== yearMonth) return false;
    return true;
  });

  return { success: true, data: records };
}

/**
 * 自動計算 S/P 類點數（finalizeAttendance 時觸發）
 */
function autoCalcSPPoints(ss, yearMonth) {
  var ym = String(yearMonth).replace('/', '-').substring(0, 7);
  var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS))
    .filter(function(w) { return String(w[COLUMNS.USERS.IS_ACTIVE]) === 'true'; });
  var pointDefs = sheetToObjects(ss.getSheetByName(SHEETS.POINTS_CONFIG));
  var config    = getConfigObject(ss);
  var holidays  = (config.holidays2026 || '').split(',').filter(Boolean);

  workers.forEach(function(worker) {
    var uid  = worker[COLUMNS.USERS.ID];
    var wt   = worker[COLUMNS.USERS.WORKER_TYPE]; // English enum
    var attRecords = sheetToObjects(ss.getSheetByName(SHEETS.ATTENDANCE))
      .filter(function(r) {
        return r[COLUMNS.ATTENDANCE.USER_ID] === uid &&
               String(r[COLUMNS.ATTENDANCE.DATE]).startsWith(ym);
      }).sort(function(a, b) {
        return String(a[COLUMNS.ATTENDANCE.DATE]) < String(b[COLUMNS.ATTENDANCE.DATE]) ? -1 : 1;
      });

    // S 類：特休時數 × 單位點數
    var totalLeaveHours = 0;
    attRecords.forEach(function(r) {
      totalLeaveHours += parseFloat(r[COLUMNS.ATTENDANCE.LEAVE_HOURS]) || 0;
    });

    var sDef = pointDefs.find(function(d) {
      return d[COLUMNS.POINTS_CONFIG.WORKER_TYPE] === wt &&
             d[COLUMNS.POINTS_CONFIG.CATEGORY]    === 'S';
    });
    if (sDef && totalLeaveHours > 0) {
      var sPoints = totalLeaveHours * (parseFloat(sDef[COLUMNS.POINTS_CONFIG.POINTS_PER_UNIT]) || 0);
      var sRec = {};
      sRec[COLUMNS.MONTHLY_POINTS.USER_ID]   = uid;
      sRec[COLUMNS.MONTHLY_POINTS.YEAR_MONTH] = yearMonth;
      sRec[COLUMNS.MONTHLY_POINTS.ITEM_ID]   = sDef[COLUMNS.POINTS_CONFIG.ITEM_ID];
      sRec[COLUMNS.MONTHLY_POINTS.QUANTITY]  = totalLeaveHours;
      sRec[COLUMNS.MONTHLY_POINTS.POINTS]    = sPoints;
      sRec[COLUMNS.MONTHLY_POINTS.STATUS]    = 'submitted';
      saveMonthlyPoints('system@auto', sRec);
    }

    // P 類：連續缺勤 > 緩衝期 → 罰款
    var buffer = (wt === 'offshore') ? 3 : 2;
    var consecutive = 0;
    var penaltyDays = 0;
    attRecords.forEach(function(r) {
      var wh = parseFloat(r[COLUMNS.ATTENDANCE.WORK_HOURS]) || 0;
      if (wh === 0) {
        consecutive++;
        if (consecutive > buffer) penaltyDays++;
      } else {
        consecutive = 0;
      }
    });

    var pDef = pointDefs.find(function(d) {
      return d[COLUMNS.POINTS_CONFIG.WORKER_TYPE] === wt &&
             d[COLUMNS.POINTS_CONFIG.CATEGORY]    === 'P';
    });
    if (pDef && penaltyDays > 0) {
      var pPoints = penaltyDays * 8 * (parseFloat(pDef[COLUMNS.POINTS_CONFIG.POINTS_PER_UNIT]) || 0);
      var pRec = {};
      pRec[COLUMNS.MONTHLY_POINTS.USER_ID]    = uid;
      pRec[COLUMNS.MONTHLY_POINTS.YEAR_MONTH] = yearMonth;
      pRec[COLUMNS.MONTHLY_POINTS.ITEM_ID]    = pDef[COLUMNS.POINTS_CONFIG.ITEM_ID];
      pRec[COLUMNS.MONTHLY_POINTS.QUANTITY]   = penaltyDays;
      pRec[COLUMNS.MONTHLY_POINTS.POINTS]     = pPoints;
      pRec[COLUMNS.MONTHLY_POINTS.STATUS]     = 'submitted';
      saveMonthlyPoints('system@auto', pRec);
    }
  });
}

// ========== [報表彙算] ==========

/**
 * 取得報表資料
 * type: 1=差勤統計表 2=工作月報表 3=每月工作量彙總 4=人員出勤暨特休統計 5=每月服務費統計
 */
function getReport(callerEmail, type, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!type || !yearMonth) return { success: false, error: '缺少 type 或 yearMonth' };

  var ss = getAppSpreadsheet();
  var year = yearMonth.substring(0, 4);

  // 1. 讀取指定月份的月結快照
  var snapshots = sheetToObjects(ss.getSheetByName(SHEETS.MONTHLY_SNAPSHOT))
    .filter(function(s) { return s[COLUMNS.MONTHLY_SNAPSHOT.YEAR_MONTH] === yearMonth; });

  // 2. 讀取該年度的所有快照 (用於計算年度已休)
  var yearSnapshots = sheetToObjects(ss.getSheetByName(SHEETS.MONTHLY_SNAPSHOT))
    .filter(function(s) { 
      return String(s[COLUMNS.MONTHLY_SNAPSHOT.YEAR_MONTH]).startsWith(year); 
    });

  // 3. 讀取指定月份的所有差勤明細 (用於報表詳列)
  var attendance = sheetToObjects(ss.getSheetByName(SHEETS.ATTENDANCE))
    .filter(function(a) {
      var d = String(a[COLUMNS.ATTENDANCE.DATE]);
      return d.startsWith(yearMonth);
    });

  var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS))
    .filter(function(w) { return String(w[COLUMNS.USERS.IS_ACTIVE]) === 'true'; });

  // deptMgr 只能看本部門
  if (perm.callerRole === 'deptMgr') {
    workers = workers.filter(function(w) {
      return w[COLUMNS.USERS.DEPARTMENT] === perm.callerDept;
    });
    var workerIds = workers.map(function(w) { return w[COLUMNS.USERS.ID]; });
    snapshots = snapshots.filter(function(s) { return workerIds.indexOf(s[COLUMNS.MONTHLY_SNAPSHOT.USER_ID]) !== -1; });
    yearSnapshots = yearSnapshots.filter(function(s) { return workerIds.indexOf(s[COLUMNS.MONTHLY_SNAPSHOT.USER_ID]) !== -1; });
    attendance = attendance.filter(function(a) { return workerIds.indexOf(a[COLUMNS.ATTENDANCE.USER_ID]) !== -1; });
  }

  logActivity(callerEmail, 'export', '匯出報表 type=' + type + ' ' + yearMonth);
  return {
    success:   true,
    data: {
      type:          parseInt(type),
      yearMonth:     yearMonth,
      workers:       workers,
      snapshots:     snapshots,
      yearSnapshots: yearSnapshots,
      attendance:    attendance
    },
  };
}

function getReviewList(callerEmail, status, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ensureSheet(ss, SHEETS.MONTHLY_POINTS, COLUMNS.MONTHLY_POINTS));

  records = records.filter(function(r) {
    if (status && r[COLUMNS.MONTHLY_POINTS.STATUS] !== status) return false;
    if (yearMonth && r[COLUMNS.MONTHLY_POINTS.YEAR_MONTH] !== yearMonth) return false;
    
    // 需與人員資料 join 比對角色與部門
    var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
    var worker  = workers.find(function(w) {
      return w[COLUMNS.USERS.ID] === r[COLUMNS.MONTHLY_POINTS.USER_ID];
    });
    
    if (!worker) return false;
    
    // 管理角色只能看到協助員或會計
    if (perm.callerRole === 'deptMgr' || perm.callerRole === 'billing') {
      var wRole = String(worker[COLUMNS.USERS.ROLE] || '');
      if (wRole !== 'worker' && wRole !== 'billing') return false;
    }

    if (perm.callerRole === 'deptMgr') {
      if (worker[COLUMNS.USERS.DEPARTMENT] !== perm.callerDept) return false;
    }
    return true;
  });

  return { success: true, data: records };
}

// ========== [檔案上傳] ==========

var ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

function uploadFileToDrive(callerEmail, base64Data, fileName, mimeType,
                           workerId, date, category, driveFolderIdParam) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!base64Data || !fileName || !mimeType) {
    return { success: false, error: '缺少檔案資料' };
  }
  if (ALLOWED_MIMES.indexOf(mimeType) === -1) {
    return { success: false, error: '不支援的檔案格式：' + mimeType + '（僅接受 PDF/JPG/PNG）' };
  }

  try {
    var ss = getAppSpreadsheet();
    var config = getConfigObject(ss);
    var rootFolderId = config.driveFolderId || driveFolderIdParam;
    if (!rootFolderId) return { success: false, error: '系統設定缺少 driveFolderId' };

    var rootFolder = DriveApp.getFolderById(rootFolderId);

    // 資料夾路徑：{年月}/{人員編號}/{category}/
    var yearMonth = date ? date.substring(0, 7) : '未知';
    var monthFolder = getOrCreateFolder(rootFolder, yearMonth);

    // 取得人員姓名
    var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
    var worker  = workers.find(function(w) { return w[COLUMNS.USERS.ID] === workerId; });
    var workerFolderName = worker
      ? (worker[COLUMNS.USERS.NAME] + '_' + workerId)
      : workerId;
    var workerFolder = getOrCreateFolder(monthFolder, workerFolderName);

    var catFolder = getOrCreateFolder(workerFolder, category || 'A1_每日');

    var blob     = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
    var file     = catFolder.createFile(blob);

    logActivity(callerEmail, 'upload', '上傳檔案：' + fileName + ' → ' + file.getId());
    return { success: true, data: { driveFileId: file.getId(), fileName: fileName } };
  } catch (err) {
    return { success: false, error: '上傳失敗：' + err.message };
  }
}

function saveFileIndex(callerEmail, record) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!record) return { success: false, error: '缺少 record 資料' };

  var ss = getAppSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FILES_INDEX);
  var fileId = record[COLUMNS.FILES_INDEX.FILE_ID] || record.fileId || generateId('FI');
  var now    = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([
    fileId,
    record[COLUMNS.FILES_INDEX.USER_ID]      || record.userId      || '',
    record[COLUMNS.FILES_INDEX.DATE]         || record.date        || '',
    record[COLUMNS.FILES_INDEX.ITEM_ID]      || record.itemId      || '',
    record[COLUMNS.FILES_INDEX.FILE_NAME]    || record.fileName    || '',
    record[COLUMNS.FILES_INDEX.MIME_TYPE]    || record.mimeType    || '',
    record[COLUMNS.FILES_INDEX.DRIVE_FILE_ID]|| record.driveFileId || '',
    now,
  ]);
  return { success: true, data: { fileId: fileId } };
}

function getFileIndex(callerEmail, workerId, date, itemId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ss.getSheetByName(SHEETS.FILES_INDEX));
  records = records.filter(function(r) {
    var uid = r[COLUMNS.FILES_INDEX.USER_ID];
    if (perm.callerRole === 'worker' && uid !== perm.callerUserId) return false;
    if (workerId && uid !== workerId) return false;
    
    var sheetDate = String(r[COLUMNS.FILES_INDEX.DATE]);
    if (date && sheetDate !== String(date)) return false;
    if (yearMonth) {
       var ym = yearMonth.replace('/', '-').substring(0, 7);
       if (!sheetDate.startsWith(ym)) return false;
    }
    
    if (itemId && String(r[COLUMNS.FILES_INDEX.ITEM_ID]) !== String(itemId)) return false;
    return true;
  });
  return { success: true, data: records };
}

function getOrCreateFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ========== [Email 通知] ==========

/**
 * N4：審核結果即時通知（呼叫 reviewItem 後觸發）
 */
function sendReviewNotification(workerId, action2, reason, yearMonth) {
  try {
    var ss = getAppSpreadsheet();
    var config = getConfigObject(ss);
    if (config.notificationEnabled !== 'true') return;

    var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
    var worker  = workers.find(function(w) { return w[COLUMNS.USERS.ID] === workerId; });
    if (!worker || !worker[COLUMNS.USERS.EMAIL]) return;

    var subject = '【點數系統】' + yearMonth + ' 審核通知：' + action2;
    var body    = '您好，' + worker[COLUMNS.USERS.NAME] + '，\n\n' +
                  '您的 ' + yearMonth + ' 月份月報審核結果如下：\n' +
                  '動作：' + action2 + '\n' +
                  (reason ? '原因：' + reason + '\n' : '') +
                  '\n系統 URL：' + (config.systemUrl || '（請聯絡管理員）') +
                  '\n\n此為系統自動通知，請勿回覆。';
    MailApp.sendEmail(worker[COLUMNS.USERS.EMAIL], subject, body);
  } catch (_) {}
}

// ========== [操作日誌] ==========

function logActivity(callerEmail, actionType, description) {
  try {
    var ss    = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.ACTIVITY_LOG);
    if (!sheet) return;
    var userId = callerEmail || 'system';
    var now    = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
    sheet.appendRow([generateId('AL'), userId, now, actionType, description]);
  } catch (_) {}
}

function logError(context, err) {
  try {
    logActivity('system@error', 'error', context + '：' + err.message);
  } catch (_) {}
}

// ========== [系統設定] ==========

function getConfig() {
  var ss   = getAppSpreadsheet();
  var rows = sheetToObjects(ss.getSheetByName(SHEETS.CONFIG));
  var config = {};
  rows.forEach(function(r) {
    config[r[COLUMNS.CONFIG.KEY]] = r[COLUMNS.CONFIG.VALUE];
  });
  return { success: true, data: config };
}

function getConfigObject(ss) {
  var rows = sheetToObjects(ss.getSheetByName(SHEETS.CONFIG));
  var config = {};
  rows.forEach(function(r) {
    config[r[COLUMNS.CONFIG.KEY]] = r[COLUMNS.CONFIG.VALUE];
  });
  return config;
}

function updateConfig(callerEmail, key, value) {
  var perm = checkPermission(callerEmail, ['admin']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!key) return { success: false, error: '缺少設定鍵' };

  var ss = getAppSpreadsheet();
  updateConfigValue(ss, key, value);
  logActivity(callerEmail, 'update', '更新系統設定：' + key + ' = ' + value);
  return { success: true, message: '設定已更新：' + key };
}

function getPointDefs(workerType) {
  var ss      = getAppSpreadsheet();
  var records = sheetToObjects(ss.getSheetByName(SHEETS.POINTS_CONFIG));
  if (workerType) {
    records = records.filter(function(r) {
      return r[COLUMNS.POINTS_CONFIG.WORKER_TYPE] === workerType;
    });
  }
  return { success: true, data: records };
}

// ========== [月統計彙算 API] ==========

/**
 * getMonthlyTotals — 一次取得某人某月的所有點數加總
 *
 * 回傳格式：
 *   { success: true, data: {
 *       dailyTotal:   每日點數(A類)加總,
 *       monthlyTotal: 月報非績效點數加總,
 *       perfTotal:    績效(C類)點數加總,
 *       grandTotal:   三者合計,
 *       yearMonth:    '2026-04'
 *   }}
 *
 * 同時會將計算結果寫入「月統計」分頁，作為快取使用。
 * 管理員可呼叫 rebuildMonthlySummary() 重建所有人的快取。
 */
function getMonthlyTotals(callerEmail, workerId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  // worker 只能查自己
  var targetId = workerId || perm.callerUserId;
  if (perm.callerRole === 'worker' && targetId !== perm.callerUserId) {
    return { success: false, error: '只能查詢自己的點數' };
  }

  var ym = String(yearMonth || '').replace('/', '-').substring(0, 7);
  var ss = getAppSpreadsheet();

  // deptMgr 只能查本部門
  if (perm.callerRole === 'deptMgr') {
    var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
    var worker  = workers.find(function(w) { return w[COLUMNS.USERS.ID] === targetId; });
    if (!worker || worker[COLUMNS.USERS.DEPARTMENT] !== perm.callerDept) {
      return { success: false, error: '只能查詢本部門人員的點數' };
    }
  }
  var totals = _computeMonthlyTotals(ss, targetId, ym);

  // 寫入快取分頁
  _writeMonthlySummaryRow(ss, targetId, ym, totals);

  return { success: true, data: Object.assign({ yearMonth: ym }, totals) };
}

/**
 * 內部計算函式：彙算該人員該月的每日 + 每月 + 績效點數
 */
function _computeMonthlyTotals(ss, workerId, ym) {
  // ── 每日點數（A 類） ──
  var dpSheet  = ss.getSheetByName(SHEETS.DAILY_POINTS);
  var dpData   = dpSheet ? dpSheet.getDataRange().getValues() : [];
  var dpHdr    = dpData[0] || [];
  var dpUidIdx = dpHdr.indexOf(COLUMNS.DAILY_POINTS.USER_ID);   // '人員編號'
  var dpDtIdx  = dpHdr.indexOf(COLUMNS.DAILY_POINTS.DATE);      // '日期'
  var dpPtIdx  = dpHdr.indexOf(COLUMNS.DAILY_POINTS.POINTS);    // '點數'

  var dailyTotal = 0;
  for (var i = 1; i < dpData.length; i++) {
    if (String(dpData[i][dpUidIdx]) !== String(workerId)) continue;
    var d = dpData[i][dpDtIdx];
    if (d instanceof Date) d = Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
    else d = String(d).substring(0, 10);
    if (!d.startsWith(ym)) continue;
    dailyTotal += parseFloat(dpData[i][dpPtIdx]) || 0;
  }

  // ── 每月點數（B/D/S/P 類） ──
  var mpSheet  = ss.getSheetByName(SHEETS.MONTHLY_POINTS);
  var mpData   = mpSheet ? mpSheet.getDataRange().getValues() : [];
  var mpHdr    = mpData[0] || [];
  var mpUidIdx = mpHdr.indexOf(COLUMNS.MONTHLY_POINTS.USER_ID);    // '人員編號'
  var mpYmIdx  = mpHdr.indexOf(COLUMNS.MONTHLY_POINTS.YEAR_MONTH); // '年月'
  var mpPtIdx  = mpHdr.indexOf(COLUMNS.MONTHLY_POINTS.POINTS);     // '點數'
  var mpItemIdx= mpHdr.indexOf(COLUMNS.MONTHLY_POINTS.ITEM_ID);    // '項目編號'
  var mpPerfIdx= mpHdr.indexOf(COLUMNS.MONTHLY_POINTS.PERF_LEVEL); // '績效等級'

  var monthlyTotal = 0;
  var perfTotal    = 0;
  for (var j = 1; j < mpData.length; j++) {
    if (String(mpData[j][mpUidIdx]) !== String(workerId)) continue;
    // yearMonth 可能存為 'yyyy-MM' 或 'yyyy/MM'
    var rowYm = String(mpData[j][mpYmIdx]).replace('/', '-').substring(0, 7);
    if (rowYm !== ym) continue;
    var pts    = parseFloat(mpData[j][mpPtIdx]) || 0;
    var itemId = String(mpData[j][mpItemIdx]);
    // C 類（績效）判斷：itemId 包含 '-C' 或 績效等級欄有值
    var isPerf = itemId.indexOf('-C') !== -1 || itemId.indexOf('_C_') !== -1 ||
                 (mpPerfIdx >= 0 && mpData[j][mpPerfIdx] && String(mpData[j][mpPerfIdx]).trim() !== '');
    if (isPerf) {
      perfTotal += pts;
    } else {
      monthlyTotal += pts;
    }
  }

  return {
    dailyTotal:   dailyTotal,
    monthlyTotal: monthlyTotal,
    perfTotal:    perfTotal,
    grandTotal:   dailyTotal + monthlyTotal + perfTotal,
  };
}

/**
 * 將彙算結果寫入「月統計」分頁（upsert）
 */
function _writeMonthlySummaryRow(ss, workerId, ym, totals) {
  var sheet = ss.getSheetByName(SHEETS.MONTHLY_SUMMARY);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.MONTHLY_SUMMARY);
    sheet.appendRow(Object.values(COLUMNS.MONTHLY_SUMMARY));
  }
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var uidIdx  = headers.indexOf(COLUMNS.MONTHLY_SUMMARY.USER_ID);
  var ymIdx   = headers.indexOf(COLUMNS.MONTHLY_SUMMARY.YEAR_MONTH);
  var now     = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  var newRow  = [
    workerId, ym,
    totals.dailyTotal, totals.monthlyTotal, totals.perfTotal, totals.grandTotal,
    now,
  ];

  // 尋找現有列
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][uidIdx]) === String(workerId) &&
        String(data[i][ymIdx]).replace('/','-').substring(0,7) === ym) {
      sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
      return;
    }
  }
  sheet.appendRow(newRow);
}

/**
 * 管理員一鍵重建所有人員所有月份的「月統計」快取分頁
 * 在 GAS 編輯器中手動執行此函式即可重建
 *
 * 使用方式：
 *   1. 開啟 GAS 編輯器
 *   2. 選取此函式 rebuildMonthlySummary
 *   3. 點選「執行」
 *   4. 完成後「月統計」分頁會有最新彙算資料
 */
function rebuildMonthlySummary() {
  var ss      = getAppSpreadsheet();
  var users   = sheetToObjects(ss.getSheetByName(SHEETS.USERS))
                  .filter(function(u) { return String(u[COLUMNS.USERS.IS_ACTIVE]) === 'true'; });

  // 找出所有有資料的年月
  var ymSet = {};
  sheetToObjects(ss.getSheetByName(SHEETS.DAILY_POINTS)).forEach(function(r) {
    var d = r[COLUMNS.DAILY_POINTS.DATE];
    if (d instanceof Date) d = Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
    else d = String(d).substring(0, 10);
    if (d.length >= 7) ymSet[d.substring(0, 7)] = true;
  });
  sheetToObjects(ss.getSheetByName(SHEETS.MONTHLY_POINTS)).forEach(function(r) {
    var ym = String(r[COLUMNS.MONTHLY_POINTS.YEAR_MONTH]).replace('/','-').substring(0,7);
    if (ym.length === 7) ymSet[ym] = true;
  });
  var ymList = Object.keys(ymSet).sort();

  // 清除舊快取（保留標頭）
  var summarySheet = ss.getSheetByName(SHEETS.MONTHLY_SUMMARY);
  if (!summarySheet) {
    summarySheet = ss.insertSheet(SHEETS.MONTHLY_SUMMARY);
    summarySheet.appendRow(Object.values(COLUMNS.MONTHLY_SUMMARY));
  } else {
    var lr = summarySheet.getLastRow();
    if (lr > 1) summarySheet.deleteRows(2, lr - 1);
  }

  var count = 0;
  users.forEach(function(u) {
    var wid = u[COLUMNS.USERS.ID];
    ymList.forEach(function(ym) {
      var totals = _computeMonthlyTotals(ss, wid, ym);
      if (totals.grandTotal > 0) {
        _writeMonthlySummaryRow(ss, wid, ym, totals);
        count++;
      }
    });
  });

  Logger.log('✅ rebuildMonthlySummary 完成，共重建 ' + count + ' 筆');
  try {
    SpreadsheetApp.getUi().alert('✅ 月統計分頁重建完成！\n共 ' + count + ' 筆資料。');
  } catch(e) {}
}

// ========== [共用工具] ==========

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheetToObjects(sheet) {
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function rowToObject(headers, row) {
  var obj = {};
  headers.forEach(function(h, i) { obj[h] = row[i]; });
  return obj;
}

function generateId(prefix) {
  return (prefix || 'ID') + '_' +
    new Date().getTime().toString(36).toUpperCase() + '_' +
    Math.floor(Math.random() * 9999);
}

/**
 * 統一權限驗證
 * 回傳 { allowed, callerUserId, callerRole, callerDept, callerName }
 */
function checkPermission(callerEmail, allowedRoles) {
  if (!callerEmail) {
    return { allowed: false, reason: '缺少 callerEmail 參數' };
  }
  // system@auto 為內部呼叫，直接放行
  if (callerEmail === 'system@auto') {
    return {
      allowed: true, callerUserId: 'system', callerRole: 'admin',
      callerDept: '', callerName: 'system',
    };
  }

  var ss    = getAppSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data  = sheet.getDataRange().getValues();
  var headers  = data[0];
  var emailIdx  = headers.indexOf(COLUMNS.USERS.EMAIL);
  var idIdx     = headers.indexOf(COLUMNS.USERS.ID);
  var roleIdx   = headers.indexOf(COLUMNS.USERS.ROLE);
  var deptIdx   = headers.indexOf(COLUMNS.USERS.DEPARTMENT);
  var nameIdx   = headers.indexOf(COLUMNS.USERS.NAME);
  var activeIdx = headers.indexOf(COLUMNS.USERS.IS_ACTIVE);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase() === String(callerEmail).toLowerCase()) {
      if (String(data[i][activeIdx]) !== 'true') {
        return { allowed: false, reason: '帳號已停用' };
      }
      var role = String(data[i][roleIdx]) || 'worker';
      if (allowedRoles.indexOf(role) === -1) {
        return {
          allowed: false,
          reason: '權限不足（需要：' + allowedRoles.join('/') + '，實際：' + role + '）',
        };
      }
      return {
        allowed:       true,
        callerUserId:  String(data[i][idIdx]),
        callerRole:    role,
        callerDept:    String(data[i][deptIdx]),
        callerName:    String(data[i][nameIdx]),
      };
    }
  }
  return { allowed: false, reason: '查無此帳號：' + callerEmail };
}

// ========== [測試帳號] (dev only) ==========

/**
 * 執行此函式以建立測試帳號
 * 包含四種角色 × 四種職務類型共 8 個帳號
 */
function setupTestAccounts() {
  var ss    = getAppSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) {
    Logger.log('❌ 請先執行 initAll()');
    return;
  }

  // SHA-256('test1234') 的 hex（作為測試密碼雜湊）
  var testHash = '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244';

  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var accounts = [
    // [人員編號, 姓名, 電子信箱, 密碼雜湊, 角色, 所屬部門, 服務區域, 職務類型, 到職日, 過往年資天數, 過往年資明細, 是否啟用, 建立時間, 最後登入時間, 登入方式]
    ['ADM-001','系統管理員','admin@test.com',       testHash,'admin',   '工安組',   '處本部', 'safety',      now, 0, '', true, now, '', 'password'],
    ['MGR-001','工程隊長A', 'deptmgr@test.com',     testHash,'deptMgr', '土木工作隊','處本部', 'safety',      now, 0, '', true, now, '', 'password'],
    ['BIL-001','請款專員',  'billing@test.com',     testHash,'billing', '工安組',   '處本部', 'safety',      now, 0, '', true, now, '', 'password'],
    ['WRK-001','一般協助員','worker_gen@test.com',  testHash,'worker',  '土木工作隊','大潭',   'general',     now, 0, '', true, now, '', 'password'],
    ['WRK-002','離島協助員','worker_off@test.com',  testHash,'worker',  '建築工作隊','金門',   'offshore',    now, 0, '', true, now, '', 'password'],
    ['WRK-003','職安管理員','worker_saf@test.com',  testHash,'worker',  '工安組',   '處本部', 'safety',      now, 0, '', true, now, '', 'password'],
    ['WRK-004','環保人員',  'worker_env@test.com',  testHash,'worker',  '工安組',   '大潭',   'environment', now, 0, '', true, now, '', 'password'],
    ['WRK-005','測試工程師','worker_test@test.com', testHash,'worker',  '土木工作隊','通霄',   'general',     now, 0, '', true, now, '', 'password'],
  ];

  // 清除現有資料（保留標頭）
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);

  sheet.getRange(2, 1, accounts.length, accounts[0].length).setValues(accounts);
  Logger.log('✅ 建立測試帳號：' + accounts.length + ' 筆');
  Logger.log('   預設密碼：test1234（SHA-256 雜湊）');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ 測試帳號建立完成！\n\n' +
      '共 ' + accounts.length + ' 個帳號\n' +
      '預設密碼：test1234\n\n' +
      '帳號清單：\n' +
      accounts.map(function(a) {
        return '• ' + a[1] + '（' + a[2] + '）角色：' + a[4];
      }).join('\n')
    );
  } catch (_) {}
}

/**
 * 執行此函式以建立正式人員名冊
 */
function setupRealAccounts() {
  var ss    = getAppSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) {
    Logger.log('❌ 請先執行 initAll()');
    return;
  }

  // SHA-256('test1234') 的 hex
  var testHash = '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244';
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  
  // 項次	姓名	區域	主辦部門	職務	到職日期	過往年資(天)	總年資(年)	特休天數	過往標案經歷	gmail
  var rawData = [
    ['江婉瑜','處本部','工安組','safety','2026-05-15',0,'0.63','12@gmail.com'],
    ['廖御超','處本部','檢驗組','environment','2026-05-15',0,'0.63','13@gmail.com'],
    ['廖見壬','大潭','電氣工作隊','general','2026-04-22',0,'0.70','14@gmail.com'],
    ['黃婉婷','通霄','中部工作隊','general','2026-04-22',0,'0.70','15@gmail.com'],
    ['沈敬晏','通霄','中部工作隊','general','2026-04-22',0,'0.70','16@gmail.com'],
    ['張馨玫','通霄','中部工作隊','general','2026-04-22',0,'0.70','17@gmail.com'],
    ['小3','大林','南部工作隊','general','2026-04-22',0,'0.70','18@gmail.com'],
    ['曾漢旗','興達','南部工作隊','general','2026-04-22',0,'0.70','19@gmail.com'],
    ['溫嘉玲','興達','南部工作隊','general','2026-04-23',0,'0.69','20@gmail.com'],
    ['小6','金門','電氣工作隊','offshore','2026-04-22',0,'0.70','21@gmail.com'],
    ['小7','琉球','機械工作隊','offshore','2026-04-22',0,'0.70','22@gmail.com']
  ];

  var accounts = rawData.map(function(item, idx) {
    var id = 'USR' + (idx + 1).toString().padStart(3, '0');
    return [
      id,              // 人員編號
      item[0],         // 姓名
      item[7],         // 電子信箱
      testHash,        // 密碼雜湊 (預設 test1234)
      'worker',        // 角色
      item[2],         // 所屬部門
      item[1],         // 服務區域
      item[3],         // 職務類型
      item[4],         // 到職日
      item[5],         // 過往年資天數
      '總年資:' + item[6] + '年', // 過往年資明細
      true,            // 是否啟用
      now,             // 建立時間
      '',              // 最後登入時間
      'password'       // 登入方式
    ];
  });

  // 以 upsert 方式寫入資料：若 ID 已存在則更新，否則新增
  var existingData = sheet.getDataRange().getValues();
  var idToRow = {};
  for (var i = 1; i < existingData.length; i++) {
    var uid = existingData[i][0]; // 假設第一欄是人員編號
    if (uid) idToRow[uid] = i + 1; // 工作表行號（含標頭）
  }

  var newRows = [];
  var updates = [];
  accounts.forEach(function(acc) {
    var id = acc[0];
    if (idToRow[id]) {
      updates.push({ row: idToRow[id], values: acc });
    } else {
      newRows.push(acc);
    }
  });

  // 更新已存在的帳號
  updates.forEach(function(u) {
    sheet.getRange(u.row, 1, 1, u.values.length).setValues([u.values]);
  });

  // 新增未存在的帳號
  if (newRows.length > 0) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, newRows.length, newRows[0].length).setValues(newRows);
    Logger.log('✅ 新增正式人員名冊：' + newRows.length + ' 筆');
  }
  Logger.log('✅ 完成 upsert 正式人員名冊，更新 ' + updates.length + ' 筆，新增 ' + newRows.length + ' 筆');

  try {
    SpreadsheetApp.getUi().alert('✅ 正式人員名冊建立完成！\n共 ' + accounts.length + ' 筆資料。\n預設密碼均為：test1234');
  } catch (_) {}
}
