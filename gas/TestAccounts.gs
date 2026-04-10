/**
 * TestAccounts.gs
 * 115年度協助員點數管理系統 — 測試帳號自動建立腳本 v1.1
 *
 * 【重要】欄位順序與「人員名冊」工作表完全對應（共14欄）：
 *   A: 工號          B: 姓名          C: 帳號類型
 *   D: Email         E: 部門          F: 服務區域
 *   G: 協助員類型    H: 到職日期      I: 離職日期
 *   J: 狀態          K: 小計經驗天數  L: 備註
 *   M: 建立時間      N: 更新時間
 *
 * 使用方式：
 *   1. 在 GAS 編輯器中開啟此檔案
 *   2. 函式下拉選單選擇「setupTestAccounts」
 *   3. 點選「執行」→ 授權 → 等待完成
 *   4. 至「人員名冊」工作表確認資料與下拉選單
 *
 * 注意：本腳本不在「人員名冊」中儲存角色欄位。
 *       角色（admin / dept_mgr / billing / worker）應另建「帳號權限表」
 *       工作表管理，或在 GAS API 中以獨立邏輯控制。
 */

// ============================================================
// 主要執行函式
// ============================================================
function setupTestAccounts() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('人員名冊');

  if (!sheet) {
    SpreadsheetApp.getUi().alert(
      '❌ 找不到「人員名冊」工作表。\n\n' +
      '請先執行 initAll() 函式建立工作表結構，再執行本腳本。'
    );
    return;
  }

  // 確認標頭列正確（防止欄位錯位）
  var headerRow = sheet.getRange(1, 1, 1, 14).getValues()[0];
  var expectedHeaders = [
    '工號','姓名','帳號類型','Email','部門','服務區域','協助員類型',
    '到職日期','離職日期','狀態','小計經驗天數','備註','建立時間','更新時間'
  ];
  var headerMismatch = expectedHeaders.some(function(h, i) {
    return headerRow[i] !== h;
  });
  if (headerMismatch) {
    SpreadsheetApp.getUi().alert(
      '❌ 「人員名冊」工作表的標頭列與預期不符。\n\n' +
      '預期標頭：\n' + expectedHeaders.join('、') + '\n\n' +
      '實際標頭：\n' + headerRow.join('、') + '\n\n' +
      '請先執行 initAll() 重新建立正確的工作表結構。'
    );
    return;
  }

  Logger.log('標頭驗證通過，開始建立測試帳號...');

  // 清除舊的測試資料（保留標題列）
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 14).clearContent();
    sheet.getRange(2, 1, lastRow - 1, 14).clearDataValidations();
    Logger.log('已清除舊資料（' + (lastRow - 1) + ' 列）');
  }

  // 建立測試帳號資料
  var accounts = buildTestAccounts();

  // 批次寫入（一次 setValues 效能最佳）
  var rows = accounts.map(function(a) { return a.toRow(); });
  sheet.getRange(2, 1, rows.length, 14).setValues(rows);
  Logger.log('已寫入 ' + rows.length + ' 筆測試帳號');

  // 套用資料驗證（下拉選單）
  applyAllValidations(sheet, 2, rows.length);

  // 套用顏色格式（依協助員類型區分）
  applyColorFormat(sheet, 2, accounts);

  // 自動調整欄寬
  sheet.autoResizeColumns(1, 14);

  // 同步建立「帳號權限表」
  setupRoleSheet(ss, accounts);

  Logger.log('✅ 測試帳號建立完成');
  SpreadsheetApp.getUi().alert(
    '✅ 測試帳號建立完成！\n\n' +
    '共建立 ' + rows.length + ' 筆帳號：\n' +
    '• 管理者帳號（d602tpc@gmail.com）：1 筆\n' +
    '• 部門管理員測試帳號：1 筆\n' +
    '• 廠商請款人員測試帳號：1 筆\n' +
    '• 協助員測試帳號（四種類型各1筆）：4 筆\n\n' +
    '另已建立「帳號權限表」工作表，用於管理角色對應。\n\n' +
    '請至「人員名冊」與「帳號權限表」確認資料。'
  );
}

// ============================================================
// 帳號資料物件建構函式
// 欄位順序嚴格對應人員名冊：
//   [0]工號 [1]姓名 [2]Email [3]部門 [4]服務區域 [5]協助員類型
//   [6]到職日期 [7]離職日期 [8]狀態 [9]小計經驗天數 [10]備註
//   [11]建立時間 [12]更新時間
// ============================================================
function Account(id, name, accountType, email, dept, area, workerType, onboardDate, note, role) {
  this.id          = id;
  this.name        = name;
  this.accountType = accountType;  // 帳號類型：管理者/部門管理員/廠商請款人員/協助員
  this.email       = email;
  this.dept        = dept;
  this.area        = area;
  this.workerType  = workerType;   // 協助員類型（非協助員角色留空）
  this.onboardDate = onboardDate;
  this.note        = note;
  this.role        = role;         // 角色代碼（僅用於帳號權限表）
  this.now         = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
}

// toRow() 嚴格對應人員名冊 14 個欄位
Account.prototype.toRow = function() {
  return [
    this.id,           // A: 工號
    this.name,         // B: 姓名
    this.accountType,  // C: 帳號類型（管理者/部門管理員/廠商請款人員/協助員）
    this.email,        // D: Email
    this.dept,         // E: 部門
    this.area,         // F: 服務區域
    this.workerType,   // G: 協助員類型（非協助員留空）
    this.onboardDate,  // H: 到職日期
    '',                // I: 離職日期（測試帳號留空）
    '在職',            // J: 狀態
    0,                 // K: 小計經驗天數
    this.note,         // L: 備註
    this.now,          // M: 建立時間
    this.now           // N: 更新時間
  ];
};

// ============================================================
// 定義測試帳號清單
// ============================================================
function buildTestAccounts() {
  return [
    // ── 管理者（工安組）──────────────────────────────────────
    // 角色：admin | 人員名冊中無角色欄位，角色記錄在「帳號權限表」
    new Account(
      'ADM-001',
      '系統管理者',
      '管理者',          // 帳號類型
      'd602tpc@gmail.com',
      '工安組',
      '全區',
      '',              // 管理者不屬於任何協助員類型
      '2025/01/01',
      '【最高權限】全案管理者，對應工安組人員。可管理所有人員、所有資料、所有報表。',
      'admin'
    ),

    // ── 部門管理員（第一工作隊）─────────────────────────────
    // 角色：dept_mgr | 只能看到與管理自己部門所屬的協助員資料
    new Account(
      'MGR-001',
      '部門管理員測試',
      '部門管理員',        // 帳號類型
      'dept.mgr.test@example.com',
      '第一工作隊',
      '北部區域',
      '',              // 部門管理員不屬於任何協助員類型
      '2025/01/01',
      '【測試帳號】部門管理員，負責初審與績效評核，僅可管理第一工作隊資料。',
      'dept_mgr'
    ),

    // ── 廠商請款人員────────────────────────────────────────
    // 角色：billing | 確認全案差勤與點數，執行最終列印與請款
    new Account(
      'BIL-001',
      '廠商請款測試',
      '廠商請款人員',      // 帳號類型
      'billing.test@example.com',
      '廠商',
      '全區',
      '',              // 廠商請款人員不屬於任何協助員類型
      '2025/01/01',
      '【測試帳號】廠商請款人員，負責確認差勤與點數正確性，執行列印與請款作業（唯讀）。',
      'billing'
    ),

    // ── 協助員：一般工地協助員──────────────────────────────
    // 角色：worker | 13項工作項目（G-A1-01 ~ G-P-01）
    new Account(
      'WRK-001',
      '一般協助員測試',
      '協助員',            // 帳號類型
      'worker.general.test@example.com',
      '第一工作隊',
      '北部工地',
      '一般工地協助員',
      '2025/01/01',
      '【測試帳號】一般工地協助員，共13項工作項目，每小時費率 220 元。',
      'worker'
    ),

    // ── 協助員：離島工地協助員──────────────────────────────
    // 角色：worker | 13項工作項目（O-A1-01 ~ O-P-01）
    new Account(
      'WRK-002',
      '離島協助員測試',
      '協助員',            // 帳號類型
      'worker.island.test@example.com',
      '第二工作隊',
      '離島工地',
      '離島工地協助員',
      '2025/01/01',
      '【測試帳號】離島工地協助員，共13項工作項目，每小時費率 290 元。',
      'worker'
    ),

    // ── 協助員：職安業務兼管理員────────────────────────────
    // 角色：worker | 12項工作項目（S-A1-01 ~ S-P-01）
    new Account(
      'WRK-003',
      '職安管理員測試',
      '協助員',            // 帳號類型
      'worker.safety.test@example.com',
      '第三工作隊',
      '中部區域',
      '職安業務兼管理員',
      '2025/01/01',
      '【測試帳號】職安業務兼管理員，共12項工作項目，每小時費率 200 元。',
      'worker'
    ),

    // ── 協助員：環保業務人員────────────────────────────────
    // 角色：worker | 13項工作項目（E-A1-01 ~ E-P-01）
    new Account(
      'WRK-004',
      '環保業務員測試',
      '協助員',            // 帳號類型
      'worker.env.test@example.com',
      '第四工作隊',
      '南部區域',
      '環保業務人員',
      '2025/01/01',
      '【測試帳號】環保業務人員，共13項工作項目，每小時費率 190 元。',
      'worker'
    )
  ];
}

// ============================================================
// 套用資料驗證（下拉選單）
// ============================================================
function applyAllValidations(sheet, startRow, count) {
  // G 欄：協助員類型（允許空白，管理者/部門管理員/廠商不需填）
  var typeRange = sheet.getRange(startRow, 7, count, 1);
  var typeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      '一般工地協助員',
      '離島工地協助員',
      '職安業務兼管理員',
      '環保業務人員'
    ], true)
    .setAllowInvalid(true)   // 允許空白
    .setHelpText('協助員請選擇類型；管理者、部門管理員、廠商請款人員可留空')
    .build();
  typeRange.setDataValidation(typeRule);

  // J 欄：狀態
  var statusRange = sheet.getRange(startRow, 10, count, 1);
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['在職', '離職', '留職停薪', '待審核'], true)
    .setAllowInvalid(false)
    .setHelpText('請選擇人員狀態')
    .build();
  statusRange.setDataValidation(statusRule);

  Logger.log('✅ 資料驗證（下拉選單）已套用：G欄（協助員類型）、J欄（狀態）');
}

// ============================================================
// 套用顏色格式（依協助員類型區分）
// ============================================================
function applyColorFormat(sheet, startRow, accounts) {
  var colorMap = {
    '':            '#FFF3E0',  // 橘色系：管理者/部門管理員/廠商
    '一般工地協助員': '#E8F5E9',  // 綠色系
    '離島工地協助員': '#E3F2FD',  // 藍色系
    '職安業務兼管理員': '#F3E5F5', // 紫色系
    '環保業務人員':  '#E0F2F1',  // 青色系
  };

  accounts.forEach(function(account, i) {
    var row = startRow + i;
    var color = colorMap[account.workerType] || '#FFFFFF';
    sheet.getRange(row, 1, 1, 14).setBackground(color);
  });

  Logger.log('✅ 顏色格式已套用');
}

// ============================================================
// 建立「帳號權限表」工作表（管理角色對應）
// 欄位：工號、姓名、Email、角色代碼、角色名稱、部門、啟用狀態、備註
// ============================================================
function setupRoleSheet(ss, accounts) {
  var roleName = '帳號權限表';
  var roleSheet = ss.getSheetByName(roleName);

  // 若不存在則建立
  if (!roleSheet) {
    roleSheet = ss.insertSheet(roleName);
    Logger.log('建立「帳號權限表」工作表');
  } else {
    roleSheet.clearContents();
    roleSheet.clearDataValidations();
    Logger.log('清除並重建「帳號權限表」');
  }

  // 寫入標頭
  var headers = [['工號','姓名','Email','角色代碼','角色名稱','部門','啟用狀態','備註']];
  roleSheet.getRange(1, 1, 1, 8).setValues(headers);

  // 標頭格式
  var headerRange = roleSheet.getRange(1, 1, 1, 8);
  headerRange.setBackground('#1e3a5f');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  roleSheet.setFrozenRows(1);

  // 角色名稱對照
  var roleNameMap = {
    'admin':    '管理者',
    'dept_mgr': '部門管理員',
    'billing':  '廠商請款人員',
    'worker':   '協助員'
  };

  // 寫入資料
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM/dd HH:mm:ss');
  var rows = accounts.map(function(a) {
    return [
      a.id,
      a.name,
      a.email,
      a.role,
      roleNameMap[a.role] || a.role,
      a.dept,
      '啟用',
      a.note
    ];
  });
  roleSheet.getRange(2, 1, rows.length, 8).setValues(rows);

  // 套用角色代碼下拉選單（D 欄）
  var roleCodeRange = roleSheet.getRange(2, 4, rows.length, 1);
  var roleCodeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['admin', 'dept_mgr', 'billing', 'worker'], true)
    .setAllowInvalid(false)
    .setHelpText('admin=管理者 / dept_mgr=部門管理員 / billing=廠商請款人員 / worker=協助員')
    .build();
  roleCodeRange.setDataValidation(roleCodeRule);

  // 套用角色名稱下拉選單（E 欄）
  var roleNameRange = roleSheet.getRange(2, 5, rows.length, 1);
  var roleNameRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['管理者', '部門管理員', '廠商請款人員', '協助員'], true)
    .setAllowInvalid(false)
    .setHelpText('請選擇角色名稱')
    .build();
  roleNameRange.setDataValidation(roleNameRule);

  // 套用啟用狀態下拉選單（G 欄）
  var statusRange = roleSheet.getRange(2, 7, rows.length, 1);
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['啟用', '停用'], true)
    .setAllowInvalid(false)
    .setHelpText('請選擇帳號啟用狀態')
    .build();
  statusRange.setDataValidation(statusRule);

  roleSheet.autoResizeColumns(1, 8);
  Logger.log('✅「帳號權限表」建立完成，共 ' + rows.length + ' 筆');
}

// ============================================================
// 輔助函式：為未來手動新增的列套用下拉選單（第2~200列）
// 建議在 setupTestAccounts 執行後，另外執行此函式一次
// ============================================================
function applyValidationToFutureRows() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 人員名冊
  var workerSheet = ss.getSheetByName('人員名冊');
  if (workerSheet) {
      applyAllValidations(workerSheet, 2, 200);
    Logger.log('已對「人員名冊」第2~200列套用下拉選單驗證');
  }

  // 帳號權限表
  var roleSheet = ss.getSheetByName('帳號權限表');
  if (roleSheet) {
    var roleCodeRange = roleSheet.getRange(2, 4, 200, 1);
    var roleCodeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['admin', 'dept_mgr', 'billing', 'worker'], true)
      .setAllowInvalid(false).build();
    roleCodeRange.setDataValidation(roleCodeRule);

    var roleNameRange = roleSheet.getRange(2, 5, 200, 1);
    var roleNameRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['管理者', '部門管理員', '廠商請款人員', '協助員'], true)
      .setAllowInvalid(false).build();
    roleNameRange.setDataValidation(roleNameRule);

    var statusRange = roleSheet.getRange(2, 7, 200, 1);
    var statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['啟用', '停用'], true)
      .setAllowInvalid(false).build();
    statusRange.setDataValidation(statusRule);

    Logger.log('已對「帳號權限表」第2~200列套用下拉選單驗證');
  }

  SpreadsheetApp.getUi().alert(
    '✅ 已對「人員名冊」與「帳號權限表」的第 2 至 200 列套用下拉選單驗證。\n\n' +
    '後續手動新增帳號時，可直接使用下拉選單選擇選項。'
  );
}
