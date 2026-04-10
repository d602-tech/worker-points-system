/**
 * API.gs — GAS API 路由腳本
 * 
 * 部署方式：在同一個 GAS 專案中新增此檔案（不需要另開新專案）
 * 部署設定：執行 → 部署 → 新增部署作業 → 類型選「網頁應用程式」
 *           執行身分：我（您的 Google 帳號）
 *           存取權限：所有人（包含匿名使用者）
 * 
 * 注意：GAS ContentService.TextOutput 不支援 setHeader()，
 *       CORS 由 GAS 平台自動處理，無需手動設定。
 */

// ============================================================
// 系統常數（請在 Init.gs 執行後填入正確 ID）
// ============================================================
var SPREADSHEET_ID = ''; // 從 Init.gs 執行後的系統設定表取得
var DRIVE_FOLDER_ID = ''; // 從 Init.gs 執行後的系統設定表取得

// ============================================================
// 主要路由函式
// ============================================================

/**
 * 處理 GET 請求
 * 使用方式：https://script.google.com/macros/s/【部署ID】/exec?action=xxx&callerEmail=xxx
 */
function doGet(e) {
  try {
    var action = e.parameter.action || '';
    
    switch (action) {
      case 'ping':
        return jsonResponse({ success: true, message: 'pong', timestamp: new Date().toISOString() });
      
      case 'getSystemConfig':
        return handleGetSystemConfig(e);
      
      case 'getWorkers':
        return handleGetWorkers(e);
      
      case 'getPointDefinitions':
        return handleGetPointDefinitions(e);
      
      case 'getAttendance':
        return handleGetAttendance(e);
      
      case 'getDailyPoints':
        return handleGetDailyPoints(e);
      
      case 'getMonthlyPoints':
        return handleGetMonthlyPoints(e);
      
      default:
        return jsonResponse({ success: false, error: '未知的 action：' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

/**
 * 處理 POST 請求
 */
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';
    
    switch (action) {
      case 'upsertWorker':
        return handleUpsertWorker(body);
      
      case 'upsertAttendance':
        return handleUpsertAttendance(body);
      
      case 'upsertDailyPoints':
        return handleUpsertDailyPoints(body);
      
      case 'submitMonthlyReport':
        return handleSubmitMonthlyReport(body);
      
      case 'reviewMonthlyReport':
        return handleReviewMonthlyReport(body);
      
      default:
        return jsonResponse({ success: false, error: '未知的 action：' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message });
  }
}

// ============================================================
// 輔助函式
// ============================================================

/**
 * 建立 JSON 回應
 * 正確寫法：使用 setMimeType，不使用 setHeader（GAS 不支援）
 */
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 統一權限驗證（詳細說明見 references/role-permissions.md）
 */
function checkPermission(e, allowedRoles) {
  var callerEmail = (e.parameter && e.parameter.callerEmail) || 
                    (e.callerEmail) || '';
  
  if (!callerEmail) {
    return { allowed: false, reason: '缺少 callerEmail 參數' };
  }
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('人員名冊');
  var data = sheet.getDataRange().getValues();
  
  var callerInfo = null;
  for (var i = 1; i < data.length; i++) {
    if (data[i][3] === callerEmail) { // D 欄 = Email
      callerInfo = {
        workerId: data[i][0],
        name: data[i][1],
        accountType: data[i][2],
        dept: data[i][4],
        workerType: data[i][6]
      };
      break;
    }
  }
  
  if (!callerInfo) {
    return { allowed: false, reason: '查無此帳號：' + callerEmail };
  }
  
  var roleMap = {
    '管理者': 'admin',
    '部門管理員': 'dept_mgr',
    '廠商請款人員': 'billing',
    '協助員': 'worker'
  };
  
  var callerRole = roleMap[callerInfo.accountType] || 'worker';
  
  if (allowedRoles.indexOf(callerRole) === -1) {
    return { allowed: false, reason: '權限不足' };
  }
  
  return {
    allowed: true,
    callerEmail: callerEmail,
    callerRole: callerRole,
    callerDept: callerInfo.dept,
    callerWorkerId: callerInfo.workerId,
    callerName: callerInfo.name
  };
}

// ============================================================
// 各 action 處理函式（實作範例）
// ============================================================

function handleGetSystemConfig(e) {
  var perm = checkPermission(e, ['admin', 'dept_mgr', 'billing', 'worker']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('系統設定');
  var data = sheet.getDataRange().getValues();
  var config = {};
  for (var i = 1; i < data.length; i++) {
    config[data[i][0]] = data[i][1];
  }
  return jsonResponse({ success: true, data: config });
}

function handleGetWorkers(e) {
  var perm = checkPermission(e, ['admin', 'dept_mgr', 'billing']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('人員名冊');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var workers = [];
  
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue; // 跳過空列
    var worker = {};
    for (var j = 0; j < headers.length; j++) {
      worker[headers[j]] = data[i][j];
    }
    // dept_mgr 只能看到本部門資料
    if (perm.callerRole === 'dept_mgr' && worker['部門'] !== perm.callerDept) continue;
    workers.push(worker);
  }
  
  return jsonResponse({ success: true, data: workers });
}

function handleGetPointDefinitions(e) {
  // 所有角色皆可查看點數定義
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('點數定義表');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var definitions = [];
  
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var def = {};
    for (var j = 0; j < headers.length; j++) {
      def[headers[j]] = data[i][j];
    }
    if (def['狀態'] === '啟用') definitions.push(def);
  }
  
  // 可依協助員類型篩選
  var workerType = e.parameter.workerType;
  if (workerType) {
    definitions = definitions.filter(function(d) {
      return d['協助員類型'] === workerType;
    });
  }
  
  return jsonResponse({ success: true, data: definitions });
}

function handleGetAttendance(e) {
  var perm = checkPermission(e, ['admin', 'dept_mgr', 'billing', 'worker']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('差勤紀錄');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var records = [];
  
  var yearMonth = e.parameter.yearMonth; // 格式 YYYY/MM
  var workerId = e.parameter.workerId;
  
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var record = {};
    for (var j = 0; j < headers.length; j++) {
      record[headers[j]] = data[i][j];
    }
    // worker 只能看自己的資料
    if (perm.callerRole === 'worker' && record['工號'] !== perm.callerWorkerId) continue;
    // dept_mgr 只能看本部門
    if (perm.callerRole === 'dept_mgr') {
      // 需額外查詢該工號的部門，此處省略
    }
    if (yearMonth && String(record['日期']).substring(0, 7).replace('-', '/') !== yearMonth) continue;
    if (workerId && record['工號'] !== workerId) continue;
    records.push(record);
  }
  
  return jsonResponse({ success: true, data: records });
}

function handleGetDailyPoints(e) {
  var perm = checkPermission(e, ['admin', 'dept_mgr', 'billing', 'worker']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('每日點數明細');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var records = [];
  var date = e.parameter.date;
  var workerId = e.parameter.workerId;
  
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var record = {};
    for (var j = 0; j < headers.length; j++) {
      record[headers[j]] = data[i][j];
    }
    if (perm.callerRole === 'worker' && record['工號'] !== perm.callerWorkerId) continue;
    if (date && String(record['日期']) !== date) continue;
    if (workerId && record['工號'] !== workerId) continue;
    records.push(record);
  }
  
  return jsonResponse({ success: true, data: records });
}

function handleGetMonthlyPoints(e) {
  var perm = checkPermission(e, ['admin', 'dept_mgr', 'billing', 'worker']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('月度點數明細');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var records = [];
  var yearMonth = e.parameter.yearMonth;
  
  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    var record = {};
    for (var j = 0; j < headers.length; j++) {
      record[headers[j]] = data[i][j];
    }
    if (perm.callerRole === 'worker' && record['工號'] !== perm.callerWorkerId) continue;
    if (yearMonth && record['年月'] !== yearMonth) continue;
    records.push(record);
  }
  
  return jsonResponse({ success: true, data: records });
}

function handleUpsertWorker(body) {
  var perm = checkPermission({ parameter: body }, ['admin']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  // 實作略，詳見 Init.gs 中的 upsertWorker 函式
  return jsonResponse({ success: true, message: '人員資料已更新' });
}

function handleUpsertAttendance(body) {
  var perm = checkPermission({ parameter: body }, ['admin', 'dept_mgr', 'worker']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  // worker 只能修改自己的草稿
  if (perm.callerRole === 'worker' && body.workerId !== perm.callerWorkerId) {
    return jsonResponse({ success: false, error: '只能修改自己的差勤紀錄' });
  }
  
  return jsonResponse({ success: true, message: '差勤紀錄已更新' });
}

function handleUpsertDailyPoints(body) {
  var perm = checkPermission({ parameter: body }, ['admin', 'worker']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  return jsonResponse({ success: true, message: '每日點數明細已更新' });
}

function handleSubmitMonthlyReport(body) {
  var perm = checkPermission({ parameter: body }, ['worker']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  // 更新月度點數明細狀態為「已送出」
  return jsonResponse({ success: true, message: '月報已送出' });
}

function handleReviewMonthlyReport(body) {
  var perm = checkPermission({ parameter: body }, ['admin', 'dept_mgr', 'billing']);
  if (!perm.allowed) return jsonResponse({ success: false, error: perm.reason });
  
  var action = body.reviewAction; // 初審通過 / 廠商確認 / 退回
  
  // 驗證角色與動作的合法性
  if (action === '廠商確認' && perm.callerRole === 'dept_mgr') {
    return jsonResponse({ success: false, error: '部門管理員無法執行廠商確認' });
  }
  
  return jsonResponse({ success: true, message: '審核動作已完成：' + action });
}
