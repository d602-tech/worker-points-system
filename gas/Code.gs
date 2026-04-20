/**
 * 115撟游漲??⊿??貊恣?頂蝯? * Google Apps Script ???桐? Code.gs v3.0
 *
 * ?嗆?靘? OpenSpec v3.0 蝚?7 蝡? * ?蔥靘?嚗nit.gs / API.gs / DriveUpload.gs / TestAccounts.gs
 *
 * ?憛?摨?
 *   撣豢摰儔 ??頝舐? ??蝟餌絞???????餃撽? ??雿輻?恣?? *   ??撌桀蝞∠? ??暺蝞∠? ??撖拇瘚? ???梯”敶? ??瑼?銝
 *   ??Email ? ?????亥? ??蝟餌絞閮剖? ???梁撌亙 ??皜祈岫撣唾?
 */

// ========== [撣豢摰儔] ==========

const SHEETS = {
  CONFIG:           '蝟餌絞閮剖?',
  USERS:            '鈭箏鞈?',
  ATTENDANCE:       '撌桀蝝??,
  DAILY_POINTS:     '瘥暺',
  MONTHLY_POINTS:   '瘥?暺',
  REVIEW_LOG:       '撖拇蝝??,
  POINTS_CONFIG:    '暺摰儔',
  FILES_INDEX:      '瑼?蝝Ｗ?',
  MONTHLY_SNAPSHOT: '??敹怎',
  ACTIVITY_LOG:     '???亥?',
};

const COLUMNS = {
  CONFIG: {
    KEY: '閮剖???, VALUE: '閮剖???, NOTE: '?酉',
  },
  USERS: {
    ID: '鈭箏蝺刻?', NAME: '憪?', EMAIL: '?餃?靽∠拳',
    PASSWORD_HASH: '撖Ⅳ??', ROLE: '閫',
    DEPARTMENT: '?撅祇?', AREA: '?????,
    WORKER_TYPE: '?瑕?憿?', ONBOARD_DATE: '?啗??,
    PAST_EXP_DAYS: '??撟渲?憭拇', PAST_EXP_DETAIL: '??撟渲??敦', IS_ACTIVE: '?臬?',
    CREATED_AT: '撱箇???', LAST_LOGIN: '?敺?交???,
    LOGIN_METHOD: '?餃?孵?',
  },
  ATTENDANCE: {
    USER_ID: '鈭箏蝺刻?', DATE: '?交?',
    AM_STATUS: '銝????, PM_STATUS: '銝????,
    WORK_HOURS: '??撌交?', LEAVE_HOURS: '?嫣??',
    SOURCE: '鞈?靘?', IS_FINALIZED: '?臬??',
    NOTE: '?酉', UPDATED_AT: '?敺?唳???,
  },
  DAILY_POINTS: {
    RECORD_ID: '蝝?楊??, USER_ID: '鈭箏蝺刻?', DATE: '?交?',
    ITEM_ID: '?蝺刻?', QUANTITY: '摰??賊?', POINTS: '暺',
    FILE_IDS: '雿?瑼?蝺刻?', STATUS: '???,
    UPLOADED_AT: '銝??', UPDATED_AT: '?敺?唳???,
  },
  MONTHLY_POINTS: {
    RECORD_ID: '蝝?楊??, USER_ID: '鈭箏蝺刻?', YEAR_MONTH: '撟湔?',
    ITEM_ID: '?蝺刻?', QUANTITY: '摰??賊?', POINTS: '暺',
    FILE_IDS: '雿?瑼?蝺刻?', PERF_LEVEL: '蝮暹?蝑?',
    STATUS: '???, UPLOADED_AT: '銝??', UPDATED_AT: '?敺?唳???,
  },
  REVIEW_LOG: {
    LOG_ID: '蝝?楊??, USER_ID: '鈭箏蝺刻?', YEAR_MONTH: '撟湔?',
    REVIEWER_ID: '撖拇?楊??, ACTION: '撖拇??',
    TIMESTAMP: '????, NOTE: '?酉', CHANGE_DETAIL: '霈?敦',
  },
  POINTS_CONFIG: {
    ITEM_ID: '?蝺刻?', WORKER_TYPE: '?瑕?憿?', CATEGORY: '憿',
    NAME: '撌乩???迂', POINTS_PER_UNIT: '?桐?暺',
    UNIT: '閮??桐?', FREQUENCY: '?餌?', NOTE: '?酉',
  },
  FILES_INDEX: {
    FILE_ID: '瑼?蝺刻?', USER_ID: '鈭箏蝺刻?', DATE: '?交?',
    ITEM_ID: '?蝺刻?', FILE_NAME: '瑼??迂',
    MIME_TYPE: '瑼?憿?', DRIVE_FILE_ID: '?脩垢瑼?蝺刻?',
    UPLOADED_AT: '銝??',
  },
  MONTHLY_SNAPSHOT: {
    SNAPSHOT_ID: '敹怎蝺刻?', USER_ID: '鈭箏蝺刻?', YEAR_MONTH: '撟湔?',
    A_TOTAL: 'A憿?閮?, B_TOTAL: 'B憿?閮?, C_AMOUNT: 'C憿?憿?,
    D_TOTAL: 'D憿?閮?, S_AMOUNT: 'S憿?憿?, P_DEDUCTION: 'P憿甈?,
    MONTH_TOTAL: '?祆?蝮質?', WORK_DAYS: '?箏憭拇',
    LEAVE_HOURS: '?嫣??', SNAPSHOT_TIME: '敹怎??',
    CONFIRMER_ID: '蝣箄??楊??,
  },
  ACTIVITY_LOG: {
    LOG_ID: '?亥?蝺刻?', USER_ID: '鈭箏蝺刻?',
    TIMESTAMP: '????', ACTION_TYPE: '??憿?',
    DESCRIPTION: '??隤芣?',
  },
};

// 115撟游?摰??伐?YYYY-MM-DD ?澆?嚗?const HOLIDAYS_2026 = [
  '2026-01-01','2026-02-16','2026-02-17','2026-02-18',
  '2026-02-19','2026-02-20','2026-02-27','2026-04-03',
  '2026-04-06','2026-05-01','2026-06-19','2026-09-25','2026-10-09',
];

const DRIVE_FOLDER_NAME = '115撟游漲_暺蝞∠?蝟餌絞';

// ========== [頝舐?] doGet / doPost ==========

// ========== [?梁撣豢??隞跑 ==========

// ??銝餅銵典 (?? Web App 銝剔? active spreadsheet ?箏仃??)
function getAppSpreadsheet() {
  return SpreadsheetApp.openById('13AXmaokmrASB86SqpzGJm5h8cu3HJvbWlmMMICaVSYo');
}

// 頛撱箇??箏仃????function ensureSheet(ss, sheetName, columnsObj) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [];
    for (var k in columnsObj) headers.push(columnsObj[k]);
    sheet.appendRow(headers);
  }
  return sheet; // ?隞亦Ⅱ靽?蝥?雿?亦?
}

function doGet(e) {
  var action = (e.parameter && e.parameter.action) || '';
  try {
    var data;
    switch (action) {
      case 'ping':
        data = { status: 'ok', message: 'GAS API ??甇?虜', version: '3.0.0',
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
                            e.parameter.date, e.parameter.itemId);
        break;
      case 'getReviewList':
        data = getReviewList(e.parameter.callerEmail, e.parameter.status,
                             e.parameter.yearMonth);
        break;
      case 'getReport':
        data = getReport(e.parameter.callerEmail, e.parameter.type,
                         e.parameter.yearMonth);
        break;
      default:
        data = { success: false, error: '?芰??action嚗? + action };
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
                          body.workerId, body.yearMonth, body.reason || '');
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
        data = { success: false, error: '?芰??action嚗? + action };
    }
    return jsonResponse(data);
  } catch (err) {
    logError('doPost:' + action, err);
    return jsonResponse({ success: false, error: err.message });
  }
}

// ========== [蝟餌絞??? ==========

function initAll() {
  var ss = getAppSpreadsheet();
  Logger.log('=== ??????115撟游漲??⊿??貊恣?頂蝯?v3.0 ===');

  createAllSheets(ss);
  setupHeaders(ss);
  seedPointDefinitions(ss);
  seedSystemConfig(ss);

  var result = createDriveFolders();
  updateConfigValue(ss, 'driveFolderId', result.folderId);

  Logger.log('=== ??????Drive 雿?鞈?憭?ID: ' + result.folderId + ' ===');
  try {
    SpreadsheetApp.getUi().alert(
      '????????\n\n' +
      '??閬?閮?隞乩?鞈?嚗n\n' +
      '??雿?鞈?憭?ID嚗n' + result.folderId + '\n\n' +
      '??銝餉??冗 ID嚗n' + result.mainFolderId + '\n\n' +
      '?乩?靘?嚗n' +
      '1. ?函蔡甇方?祉 Web App嚗蝵????啣??函蔡 ??蝬脤??蝔?嚗n' +
      '2. ?瑁?頨思遢?詻???????犖?n' +
      '3. 銴ˊ Web App URL嚗‵?亦頂蝯梯身摰??兝n' +
      '4. ?瑁? setupTestAccounts() 撱箇?皜祈岫撣唾?'
    );
  } catch (_) {}
  return { success: true, message: '??????, folderId: result.folderId };
}

function createAllSheets(ss) {
  var existing = ss.getSheets().map(function(s) { return s.getName(); });
  Object.values(SHEETS).forEach(function(name) {
    if (existing.indexOf(name) === -1) {
      ss.insertSheet(name);
      Logger.log('撱箇???嚗? + name);
    }
  });
  // 蝘駁?身蝛箇??
  ['撌乩?銵?','Sheet1'].forEach(function(n) {
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
      Logger.log('閮剖?璅嚗? + sheetName + '嚗? + headers.length + ' 甈?');
    }
  });
}

function seedPointDefinitions(ss) {
  var sheet = ss.getSheetByName(SHEETS.POINTS_CONFIG);
  if (!sheet) return;
  if (sheet.getLastRow() > 1) {
    Logger.log('暺摰儔撌脫?鞈?嚗?車摮???蔭隢?皜蝚?2 ?誑敺?');
    return;
  }
  // 甈???嚗??桃楊?? ?瑕?憿?, 憿, 撌乩???迂, ?桐?暺, 閮??桐?, ?餌?, ?酉
  var rows = [
    // 銝?砍極?啣??拙 (general) ??13 蝑?    ['GEN-A1-01','general','A1','?芸?瑼Ｘ?極?啣楚瑼?,800,'憭?,'瘥',''],
    ['GEN-A1-02','general','A1','?勗拿???憸券雿平蝞∪???,400,'憭?,'瘥',''],
    ['GEN-A1-03','general','A1','?踵???乩?璆剖??典儐?唬?????隤?,200,'憭?,'瘥',''],
    ['GEN-A1-04','general','A1','撌亙????摰靽恣??,150,'憭?,'瘥',''],
    ['GEN-A2-01','general','A2','憭拍?賢拿?迫銝?垢雿平(憸梢◢?悸?典?蝑?',1400,'憭?,'鈭辣',''],
    ['GEN-B1-01','general','B1','?脣鞈??6撠撖拇',4000,'??,'瘥?',''],
    ['GEN-B1-02','general','B1','閮剖?閮剜摰蝔賣',3000,'??,'瘥?',''],
    ['GEN-B1-03','general','B1','?降蝯????蜀????,3000,'??,'瘥?',''],
    ['GEN-B1-04','general','B1','?瑕?銵??訾?璆剛?瘞游像撅?',2900,'??,'瘥?',''],
    ['GEN-B2-01','general','B2','?亦???撘瑕?雿平',5000,'甈?,'瘥僑',''],
    ['GEN-C-01', 'general','C', '?冽?鈭方齒?蜀??,5000,'??,'瘥?','??000/雿?000/撟?000'],
    ['GEN-S-01', 'general','S', '?嫣?隞??甈?,220,'撠?','瘥?',''],
    ['GEN-P-01', 'general','P', '?脩蔑?折?蝝? (?芣晷?∪悼蝝?',220,'撠?','鈭辣',''],
    // ?Ｗ雀撌亙???(offshore) ??13 蝑?    ['OFF-A1-01','offshore','A1','?芸?瑼Ｘ?極?啣楚瑼?,1060,'憭?,'瘥',''],
    ['OFF-A1-02','offshore','A1','?勗拿???憸券雿平蝞∪???,530,'憭?,'瘥',''],
    ['OFF-A1-03','offshore','A1','?踵???乩?璆剖??典儐?唬?????隤?,300,'憭?,'瘥',''],
    ['OFF-A1-04','offshore','A1','撌亙????摰靽恣??,210,'憭?,'瘥',''],
    ['OFF-A2-01','offshore','A2','憭拍?賢拿?迫銝?垢雿平(憸梢◢?悸?典?蝑?',1800,'憭?,'鈭辣',''],
    ['OFF-B1-01','offshore','B1','?脣鞈??6撠撖拇',5000,'??,'瘥?',''],
    ['OFF-B1-02','offshore','B1','閮剖?閮剜摰蝔賣',4000,'??,'瘥?',''],
    ['OFF-B1-03','offshore','B1','?降蝯????蜀????,4000,'??,'瘥?',''],
    ['OFF-B1-04','offshore','B1','?瑕?銵??訾?璆剛?瘞游像撅?',3600,'??,'瘥?',''],
    ['OFF-B2-01','offshore','B2','?亦???撘瑕?雿平',7000,'甈?,'瘥僑',''],
    ['OFF-C-01', 'offshore','C', '?冽?鈭方齒?蜀??,7200,'??,'瘥?','??200/雿?200/撟?200'],
    ['OFF-S-01', 'offshore','S', '?嫣?隞??甈?,290,'撠?','瘥?',''],
    ['OFF-P-01', 'offshore','P', '?脩蔑?折?蝝? (?芣晷?∪悼蝝?',290,'撠?','鈭辣',''],
    // ?瑕?璆剖??潛恣? (safety) ??12 蝑?    ['SAF-A1-01','safety','A1','蝣箄???⊥??乩??喟?瘜蒂餈質馱',600,'憭?,'瘥',''],
    ['SAF-A1-02','safety','A1','韏啣?蝞∠??極摰?貉蕭頩?,500,'憭?,'瘥',''],
    ['SAF-A2-01','safety','A2','憭拍?賢拿?迫銝?垢雿平(憸梢◢?悸?典?蝑?',1000,'憭?,'鈭辣',''],
    ['SAF-B1-01','safety','B1','蝻箏仃?恐撠ˊ雿陛??,2000,'??,'瘥?',''],
    ['SAF-B1-02','safety','B1','?瑕?憿???摮??撟游敶',10800,'??,'瘥?',''],
    ['SAF-B1-03','safety','B1','?瑕?蝞∠?蝟餌絞?辣蝯梯???',1000,'??,'瘥?',''],
    ['SAF-B1-04','safety','B1','撱?蝞∠?鈭箸????嫣?璆?,4500,'??,'瘥?',''],
    ['SAF-B1-05','safety','B1','?箏隤踹漲?榆?斗??,500,'??,'瘥?',''],
    ['SAF-B2-01','safety','B2','?亦????脰風瑼Ｘ鞈?敶',4000,'甈?,'瘥僑',''],
    ['SAF-C-01', 'safety','C', '?冽?鈭方齒?蜀??,5000,'??,'瘥?','??000/雿?000/撟?000'],
    ['SAF-S-01', 'safety','S', '?嫣?隞??甈?,200,'撠?','瘥?',''],
    ['SAF-P-01', 'safety','P', '?脩蔑?折?蝝? (?芣晷?∪悼蝝?',200,'撠?','鈭辣',''],
    // ?唬?璆剖?鈭箏 (environment) ??13 蝑?    ['ENV-A1-01','environment','A1','?唬?銵璆剖?',500,'憭?,'瘥',''],
    ['ENV-A2-01','environment','A2','憭拍?賢拿?迫銝?垢雿平(憸梢◢?悸?典?蝑?',400,'憭?,'鈭辣',''],
    ['ENV-B1-01','environment','B1','銵??詨?',29500,'??,'瘥?',''],
    ['ENV-B2-01','environment','B2','?亦????脰風瑼Ｘ鞈?敶',2000,'甈?,'瘥僑',''],
    ['ENV-C-01', 'environment','C', '?冽?鈭方齒?蜀??,2000,'??,'瘥?','??000/雿?000/撟?00'],
    ['ENV-D1-01','environment','D1','?啣?蝞∠??寞??瑁?蝮暹?蝞∪',100,'憭?,'瘥',''],
    ['ENV-D1-02','environment','D1','????皜祈??怠?撖行',100,'憭?,'瘥',''],
    ['ENV-D1-03','environment','D1','瘜????閬找?閰摯雿平蝔??訾?璆?,250,'憭?,'瘥',''],
    ['ENV-D2-01','environment','D2','?啣?撖拇雿平蝔??訾?璆?,800,'??,'瘥?',''],
    ['ENV-D2-02','environment','D2','蝞∠??惜撖拇?降鞈?皞?',400,'??,'瘥?',''],
    ['ENV-D2-03','environment','D2','?折蝔賣?辣?渡?皞?',900,'??,'瘥?',''],
    ['ENV-S-01', 'environment','S', '?嫣?隞??甈?,190,'撠?','瘥?',''],
    ['ENV-P-01', 'environment','P', '?脩蔑?折?蝝? (?芣晷?∪悼蝝?',190,'撠?','鈭辣',''],
  ];
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  Logger.log('撖怠暺摰儔蝔桀?鞈?嚗? + rows.length + ' 蝑?51 蝑??車?瑕?憿?嚗?);
}

function seedSystemConfig(ss) {
  var sheet = ss.getSheetByName(SHEETS.CONFIG);
  if (!sheet) return;
  if (sheet.getLastRow() > 1) {
    Logger.log('蝟餌絞閮剖?撌脫?鞈?嚗?車摮?);
    return;
  }
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  var configs = [
    ['companyName',        '蝬??賢極??,         '?砍?迂'],
    ['contractStart',      '2026-01-01',         '憟?????],
    ['contractEnd',        '2026-12-31',         '憟?蝯???],
    ['totalWorkers',       '11',                 '?冽?蝮賭犖??],
    ['totalMonths',        '12',                 '?冽?蝮賣???],
    ['holidays2026',       HOLIDAYS_2026.join(','), '115撟游?摰??伐?YYYY-MM-DD嚗???嚗?],
    ['driveFolderId',      '',                   '雿?鞈?憭?ID嚗 initAll ?芸?憛怠嚗?],
    ['gasWebAppUrl',       '',                   'GAS Web App URL嚗蝵脣?隢‵?伐?'],
    ['isInitialized',      'true',               '?脤?銴?憪???'],
    ['notificationEnabled','true',               'Email ?蝮賡???],
    ['dailyReminderHour',  '16',                 '瘥????嚗?4h嚗?],
    ['monthlyReminderDay', '25',                 '????交?'],
    ['systemUrl',          '',                   '蝟餌絞?垢 URL'],
    ['adminEmails',        '',                   '?啣虜?勗??嗡辣??????嚗?],
    ['systemVersion',      '3.0.0',              '蝟餌絞?'],
    ['initializedAt',      now,                  '蝟餌絞??????],
  ];
  sheet.getRange(2, 1, configs.length, 3).setValues(configs);
  Logger.log('撖怠蝟餌絞閮剖?蝔桀?嚗? + configs.length + ' 蝑?);
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
  var existingEvidence = mainFolder.getFoldersByName('雿?鞈?');
  evidenceFolder = existingEvidence.hasNext() ? existingEvidence.next()
                                               : mainFolder.createFolder('雿?鞈?');

  // 撱箇??遢摮??冗嚗?026-01 ~ 2026-12嚗?  for (var m = 1; m <= 12; m++) {
    var monthStr = '2026-' + (m < 10 ? '0' : '') + m;
    var ex = evidenceFolder.getFoldersByName(monthStr);
    if (!ex.hasNext()) evidenceFolder.createFolder(monthStr);
  }

  // 撱箇??臬?梯”鞈?憭?  var reportsName = '?臬?梯”';
  var existingReports = mainFolder.getFoldersByName(reportsName);
  if (!existingReports.hasNext()) mainFolder.createFolder(reportsName);

  try {
    evidenceFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  } catch(_) {}

  return { mainFolderId: mainFolder.getId(), folderId: evidenceFolder.getId() };
}

// ========== [?餃撽?] ==========

function passwordLogin(email, passwordHash) {
  if (!email || !passwordHash) {
    return { success: false, error: '蝻箏? email ??passwordHash' };
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
        return { success: false, error: '撣唾?撌脣??? };
      }
      if (String(data[i][hashIdx]) === String(passwordHash)) {
        var worker = rowToObject(headers, data[i]);
        updateLastLogin(ss, i + 1, 'password');
        logActivity(email, 'login', '撖Ⅳ?餃??');
        return { success: true, data: worker };
      }
      return { success: false, error: '撖Ⅳ?航炊' };
    }
  }
  return { success: false, error: '?亦甇文董??' + email };
}

function getMyProfile(callerEmail) {
  if (!callerEmail) return { success: false, error: '蝻箏? callerEmail' };
  var ss = getAppSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var emailIdx = headers.indexOf(COLUMNS.USERS.EMAIL);
  var activeIdx = headers.indexOf(COLUMNS.USERS.IS_ACTIVE);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][emailIdx]).toLowerCase() === String(callerEmail).toLowerCase()) {
      if (String(data[i][activeIdx]) !== 'true') {
        return { success: false, error: '撣唾?撌脣??? };
      }
      var worker = rowToObject(headers, data[i]);
      updateLastLogin(ss, i + 1, 'google');
      logActivity(callerEmail, 'login', 'Google ?餃??');
      return { success: true, data: worker };
    }
  }
  return { success: false, error: '?亦甇文董??' + callerEmail };
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
  if (!workerId || !passwordHash) return { success: false, error: '蝻箏? workerId ??passwordHash' };

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
        return { success: true, message: '撖Ⅳ撌脫?? };
      }
    }
    return { success: false, error: '?曆??唬犖?∴?' + workerId };
  } finally {
    lock.releaseLock();
  }
}

// ========== [雿輻?恣? ==========

function getWorkers(callerEmail) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));

  // deptMgr ?芾??券?
  if (perm.callerRole === 'deptMgr') {
    workers = workers.filter(function(w) {
      return w[COLUMNS.USERS.DEPARTMENT] === perm.callerDept;
    });
  }
  // ?蕪?撣唾?嚗??admin ?亦?嚗?  if (perm.callerRole !== 'admin') {
    workers = workers.filter(function(w) {
      return String(w[COLUMNS.USERS.IS_ACTIVE]) === 'true';
    });
  }
  logActivity(callerEmail, 'query', '?亥岷鈭箏?”');
  return { success: true, data: workers };
}

function upsertWorker(callerEmail, worker) {
  var perm = checkPermission(callerEmail, ['admin']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!worker) return { success: false, error: '蝻箏? worker 鞈?' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var ss = getAppSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.USERS);
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var idIdx = headers.indexOf(COLUMNS.USERS.ID);
    var now   = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

    // 撠?Ｘ?蝝??    var targetRow = -1;
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
      logActivity(callerEmail, 'update', '?湔鈭箏嚗? + newId);
    } else {
      sheet.appendRow(row);
      logActivity(callerEmail, 'update', '?啣?鈭箏嚗? + newId);
    }
    return { success: true, data: { [COLUMNS.USERS.ID]: newId } };
  } finally {
    lock.releaseLock();
  }
}

// ========== [撌桀蝞∠?] ==========

/**
 * ?亥岷撌桀蝝?? * worker ?芾?亥撌梧?deptMgr ?芾?交?券?嚗隞??脣?亙?? */
function getAttendance(callerEmail, workerId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ss.getSheetByName(SHEETS.ATTENDANCE));

  records = records.filter(function(r) {
    var rid = r[COLUMNS.ATTENDANCE.USER_ID];
    if (perm.callerRole === 'worker' && rid !== perm.callerUserId) return false;
    if (workerId && rid !== workerId) return false;
    if (yearMonth) {
      var d = String(r[COLUMNS.ATTENDANCE.DATE]);
      if (!d.startsWith(yearMonth.replace('/','-').substring(0,7))) return false;
    }
    return true;
  });

  return { success: true, data: records };
}

/**
 * ?啣?/?湔撌桀蝝??銝??= 銝鈭箔??伐?
 * ?芸?閮???撌交??隡??? */
function upsertAttendance(callerEmail, record) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!record || !record[COLUMNS.ATTENDANCE.USER_ID] || !record[COLUMNS.ATTENDANCE.DATE]) {
    return { success: false, error: '蝻箏?敹?甈?嚗犖?∠楊???' };
  }

  var userId = record[COLUMNS.ATTENDANCE.USER_ID];
  if (perm.callerRole === 'worker' && userId !== perm.callerUserId) {
    return { success: false, error: '?芾靽格?芸楛?榆?斤??? };
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

    var targetDate = String(record[COLUMNS.ATTENDANCE.DATE]);
    var targetRow  = -1;

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][userIdIdx]) === String(userId) &&
          String(data[i][dateIdx])   === targetDate) {
        // 撌脤?摰??臭耨??        if (String(data[i][finalIdx]) === 'true' && perm.callerRole !== 'admin') {
          return { success: false, error: '撌桀撌脤?摰??⊥?靽格' };
        }
        targetRow = i + 1;
        break;
      }
    }

    var amStatus = record[COLUMNS.ATTENDANCE.AM_STATUS] || '';
    var pmStatus = record[COLUMNS.ATTENDANCE.PM_STATUS] || '';
    var workLeave = calcWorkAndLeave(amStatus, pmStatus);
    var source    = record[COLUMNS.ATTENDANCE.SOURCE] || 'actual';
    var now       = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

    var row = [
      userId,
      targetDate,
      amStatus,
      pmStatus,
      workLeave.workHours,
      workLeave.leaveHours,
      source,
      (record[COLUMNS.ATTENDANCE.IS_FINALIZED] === true || record[COLUMNS.ATTENDANCE.IS_FINALIZED] === 'true'),
      record[COLUMNS.ATTENDANCE.NOTE] || '',
      now,
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }
    logActivity(callerEmail, 'update', '?湔撌桀嚗? + userId + ' ' + targetDate);
    return { success: true, message: '撌桀蝝?歇?湔' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 閮???撌交??隡??? * ??撘?嚗?| ?遑 | ? | 鈭 | 憍 | ?杰 | ?昧 | 隞δ憪? | ??| 嚗征?踝?
 */
function calcWorkAndLeave(amStatus, pmStatus) {
  function parseHours(status) {
    if (!status || status === '') return { work: 0, leave: 0 };
    if (status === '嚗?) return { work: 4, leave: 0 };
    if (status.startsWith('隞?)) return { work: 4, leave: 0 };
    if (status.startsWith('??)) {
      var h = parseInt(status.substring(1)) || 4;
      return { work: 0, leave: h };
    }
    // ??鈭?憍????砍?閬隢?嚗?閮??撌交?嚗?    return { work: 0, leave: 0 };
  }
  var am = parseHours(amStatus);
  var pm = parseHours(pmStatus);
  return {
    workHours:  am.work  + pm.work,
    leaveHours: am.leave + pm.leave,
  };
}

/**
 * ?芸??Ｙ??嗆???極雿?身?箏嚗dmin only嚗? * 鞈?靘? = auto嚗???銝????= 嚗? * 頝喲??望??摰??? */
function generateMonthlyAttendance(callerEmail, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!yearMonth) return { success: false, error: '蝻箏? yearMonth嚗撘?YYYY-MM嚗? };

  var ss = getAppSpreadsheet();
  var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS))
    .filter(function(w) { return String(w[COLUMNS.USERS.IS_ACTIVE]) === 'true'; });

  var config = getConfigObject(ss);
  var holidays = (config.holidays2026 || '').split(',').filter(Boolean);

  // 閫?? yearMonth ??蝚砌?憭拙?敺?憭?  var parts = yearMonth.split('-');
  var year = parseInt(parts[0]);
  var month = parseInt(parts[1]);
  var startDate = new Date(year, month - 1, 1);
  var endDate   = new Date(year, month, 0);  // 閰脫??敺?憭?
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
        var dow  = d.getDay();     // 0=?? 6=??        var dStr = Utilities.formatDate(d, 'Asia/Taipei', 'yyyy-MM-dd');
        var isWeekend  = (dow === 0 || dow === 6);
        var isHoliday  = (holidays.indexOf(dStr) !== -1);
        if (!isWeekend && !isHoliday) {
          var key = uid + '_' + dStr;
          if (!existKey[key]) {
            newRows.push([uid, dStr, '嚗?, '嚗?, 8, 0, 'auto', false, '', now]);
          }
        }
        d.setDate(d.getDate() + 1);
      }
    });

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length)
           .setValues(newRows);
    }
    logActivity(callerEmail, 'update', '?Ｙ? ' + yearMonth + ' ??撌桀嚗? + newRows.length + ' 蝑?);
    return { success: true, message: '?Ｙ? ' + newRows.length + ' 蝑??榆?? };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 撱?蝣箄???撌桀嚗illing / Admin嚗? * ??閫貊 S 憿? P 憿??貉??蝞? */
function finalizeAttendance(callerEmail, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','billing']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!yearMonth) return { success: false, error: '蝻箏? yearMonth' };

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
      var d = String(data[i][dateIdx]);
      if (d.startsWith(ym)) {
        sheet.getRange(i + 1, finalIdx + 1).setValue(true);
        updated++;
      }
    }

    // ?芸?閮? S/P 憿???    autoCalcSPPoints(ss, yearMonth);

    logActivity(callerEmail, 'update', '?? ' + yearMonth + ' 撌桀嚗? + updated + ' 蝑?);
    return { success: true, message: '撌脤?摰?' + updated + ' 蝑榆?支蒂閮? S/P 暺' };
  } finally {
    lock.releaseLock();
  }
}

// ========== [暺蝞∠?] ==========

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
      if (String(r[COLUMNS.DAILY_POINTS.DATE]) !== String(date)) return false;
    } else if (yearMonth) {
      var ym = yearMonth.replace('/', '-').substring(0, 7);
      if (!String(r[COLUMNS.DAILY_POINTS.DATE]).startsWith(ym)) return false;
    }
    return true;
  });

  return { success: true, data: records };
}

function saveDailyPoints(callerEmail, record) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!record) return { success: false, error: '蝻箏? record 鞈?' };

  var userId = record[COLUMNS.DAILY_POINTS.USER_ID] || record.userId;
  if (perm.callerRole === 'worker' && userId !== perm.callerUserId) {
    return { success: false, error: '?芾靽格?芸楛???? };
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
        if (String(data[j][uidIdx])    === String(userId) &&
            String(data[j][dateIdx])   === String(record[COLUMNS.DAILY_POINTS.DATE]) &&
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
 * ?寞活??嗆???A1 暺 + 雿?
 * ?芸?靘?斤???蝞??豢?靘??典予/?予/蝻箏嚗? */
function saveDailyPointsBatch(callerEmail, workerId, date, items) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!workerId || !date || !items) return { success: false, error: '蝻箏?敹??' };
  if (perm.callerRole === 'worker' && workerId !== perm.callerUserId) {
    return { success: false, error: '?芾?漱?芸楛???? };
  }

  // ??閰脫?箏???閮?暺瘥?
  var ss = getAppSpreadsheet();
  var attRecords = sheetToObjects(ss.getSheetByName(SHEETS.ATTENDANCE));
  var ratio = 0;
  for (var k = 0; k < attRecords.length; k++) {
    var r = attRecords[k];
    if (r[COLUMNS.ATTENDANCE.USER_ID] === workerId &&
        String(r[COLUMNS.ATTENDANCE.DATE]) === String(date)) {
      var wh = parseFloat(r[COLUMNS.ATTENDANCE.WORK_HOURS]) || 0;
      if (wh >= 8) ratio = 1;
      else if (wh >= 4) ratio = 0.5;
      else ratio = 0;
      break;
    }
  }

  var errors = [];
  var saved  = 0;
  items.forEach(function(item) {
    var pts = Math.round((item.pointsPerUnit || item.points || 0) * ratio);
    var rec = {};
    rec[COLUMNS.DAILY_POINTS.USER_ID]  = workerId;
    rec[COLUMNS.DAILY_POINTS.DATE]     = date;
    rec[COLUMNS.DAILY_POINTS.ITEM_ID]  = item.itemId || '';
    rec[COLUMNS.DAILY_POINTS.QUANTITY] = item.quantity || 1;
    rec[COLUMNS.DAILY_POINTS.POINTS]   = pts;
    rec[COLUMNS.DAILY_POINTS.FILE_IDS] = (item.fileIds || []).join(',');
    rec[COLUMNS.DAILY_POINTS.STATUS]   = 'submitted';
    var result = saveDailyPoints(callerEmail, rec);
    if (result.success) saved++;
    else errors.push(item.itemId + ': ' + result.error);
  });

  logActivity(callerEmail, 'update',
    '?寞活?脣? ' + date + ' 瘥暺嚗? + saved + ' 蝑? +
    (errors.length ? '嚗隤歹?' + errors.join('; ') + '嚗? : ''));
  return {
    success: errors.length === 0,
    message: '?脣? ' + saved + '/' + items.length + ' 蝑?,
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
    if (workerId && uid !== workerId) return false;
    if (yearMonth && r[COLUMNS.MONTHLY_POINTS.YEAR_MONTH] !== yearMonth) return false;
    return true;
  });

  return { success: true, data: records };
}

function saveMonthlyPoints(callerEmail, record) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!record) return { success: false, error: '蝻箏? record 鞈?' };

  var userId = record[COLUMNS.MONTHLY_POINTS.USER_ID] || record.userId;
  if (perm.callerRole === 'worker' && userId !== perm.callerUserId) {
    return { success: false, error: '?芾靽格?芸楛??摨阡??? };
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
        if (String(data[j][uidIdx])    === String(userId) &&
            String(data[j][ymIdx])     === String(ym) &&
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
 * ??⊿?嚗???draft ??submitted嚗? */
function submitMonthlyReport(callerEmail, workerId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (perm.callerRole === 'worker' && workerId !== perm.callerUserId) {
    return { success: false, error: '?芾??芸楛???? };
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

    // ?郊?湔瘥暺???    var dpSheet = ss.getSheetByName(SHEETS.DAILY_POINTS);
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
    logActivity(callerEmail, 'update', '??嚗? + workerId + ' ' + yearMonth);
    return { success: true, message: '?撌脤嚗??' + updated + ' 蝑? };
  } finally {
    lock.releaseLock();
  }
}

// ========== [撖拇瘚?] ==========

/**
 * 撖拇??
 * action2: '?祟??' | '??耨?? | '撱?蝣箄?' | '撱???? | '撌脰?甈?
 */
function reviewItem(callerEmail, action2, workerId, yearMonth, reason) {
  if (!action2) return { success: false, error: '蝻箏?撖拇??' };

  // 撽?閫??雿?瘜?  var allowedRoles;
  if (action2 === '?祟??' || action2 === '??耨??) {
    allowedRoles = ['admin','deptMgr'];
  } else if (action2 === '撱?蝣箄?' || action2 === '撱???? || action2 === '撌脰?甈?) {
    allowedRoles = ['admin','billing'];
  } else {
    return { success: false, error: '?芰?祟?詨?雿?' + action2 };
  }

  var perm = checkPermission(callerEmail, allowedRoles);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var ss = getAppSpreadsheet();
    var newStatus = actionToStatus(action2);
    var before = getCurrentStatus(ss, workerId, yearMonth);

    updatePointsStatus(ss, workerId, yearMonth, newStatus);
    writeReviewLog(ss, workerId, yearMonth, perm.callerUserId, action2, reason,
                   JSON.stringify({ before: before, after: newStatus }));

    // 撱?蝣箄?????蝯翰??    if (action2 === '撱?蝣箄?') {
      generateMonthlySnapshot(ss, workerId, yearMonth, perm.callerUserId);
    }

    logActivity(callerEmail, 'review',
      action2 + '嚗? + workerId + ' ' + yearMonth +
      (reason ? ' (' + reason + ')' : ''));
    return { success: true, message: '撖拇??摰?嚗? + action2 };
  } finally {
    lock.releaseLock();
  }
}

function actionToStatus(action2) {
  var map = {
    '?祟??':   'dept_approved',
    '??耨??:   'rejected',
    '撱?蝣箄?':   'billing_confirmed',
    '撱????:   'rejected',
    '撌脰?甈?:     'billed',
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

  // ?郊瘥暺
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
 * ?Ｙ???敹怎嚗??Ⅱ隤??芸?閫貊嚗? */
function generateMonthlySnapshot(ss, workerId, yearMonth, confirmerId) {
  var ym = String(yearMonth).replace('/', '-').substring(0, 7);

  // 敶?瘥暺嚗1/A2 憿?
  var dpRecords = sheetToObjects(ss.getSheetByName(SHEETS.DAILY_POINTS))
    .filter(function(r) {
      return r[COLUMNS.DAILY_POINTS.USER_ID] === workerId &&
             String(r[COLUMNS.DAILY_POINTS.DATE]).startsWith(ym);
    });

  var aTotal = 0;
  dpRecords.forEach(function(r) {
    aTotal += parseFloat(r[COLUMNS.DAILY_POINTS.POINTS]) || 0;
  });

  // 敶??漲暺嚗/C/D/S/P 憿?
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

  // 撌桀蝯梯?
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

  var monthTotal = aTotal + bTotal + cAmount + dTotal + sAmount - pDeduction;
  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');

  var snapshotSheet = ss.getSheetByName(SHEETS.MONTHLY_SNAPSHOT);
  snapshotSheet.appendRow([
    generateId('MS'),
    workerId,
    yearMonth,
    aTotal, bTotal, cAmount, dTotal, sAmount, pDeduction,
    monthTotal, workDays, leaveHrs, now, confirmerId,
  ]);

  Logger.log('?Ｙ???敹怎嚗? + workerId + ' ' + yearMonth +
             ' 蝮質?=' + monthTotal);
}

function getMonthlySnapshot(callerEmail, workerId, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ss.getSheetByName(SHEETS.MONTHLY_SNAPSHOT));

  records = records.filter(function(r) {
    if (perm.callerRole === 'worker' &&
        r[COLUMNS.MONTHLY_SNAPSHOT.USER_ID] !== perm.callerUserId) return false;
    if (workerId && r[COLUMNS.MONTHLY_SNAPSHOT.USER_ID] !== workerId) return false;
    if (yearMonth && r[COLUMNS.MONTHLY_SNAPSHOT.YEAR_MONTH] !== yearMonth) return false;
    return true;
  });

  return { success: true, data: records };
}

/**
 * ?芸?閮? S/P 憿??賂?finalizeAttendance ?孛?潘?
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

    // S 憿??嫣?? ? ?桐?暺
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

    // P 憿????蝻箏 > 蝺抵?????蝵唳狡
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

// ========== [?梯”敶?] ==========

/**
 * ???梯”鞈?
 * type: 1=撌桀蝯梯?銵?2=撌乩??銵?3=瘥?撌乩???蝮?4=鈭箏?箏?函隡絞閮?5=瘥???鞎餌絞閮? */
function getReport(callerEmail, type, yearMonth) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!type || !yearMonth) return { success: false, error: '蝻箏? type ??yearMonth' };

  var ss = getAppSpreadsheet();

  // ?芸?敺?蝯翰?扯???  var snapshots = sheetToObjects(ss.getSheetByName(SHEETS.MONTHLY_SNAPSHOT))
    .filter(function(s) { return s[COLUMNS.MONTHLY_SNAPSHOT.YEAR_MONTH] === yearMonth; });

  var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS))
    .filter(function(w) { return String(w[COLUMNS.USERS.IS_ACTIVE]) === 'true'; });

  // deptMgr ?芾??券?
  if (perm.callerRole === 'deptMgr') {
    workers = workers.filter(function(w) {
      return w[COLUMNS.USERS.DEPARTMENT] === perm.callerDept;
    });
  }

  logActivity(callerEmail, 'export', '?臬?梯” type=' + type + ' ' + yearMonth);
  return {
    success:   true,
    data: {
      type:      parseInt(type),
      yearMonth: yearMonth,
      workers:   workers,
      snapshots: snapshots,
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
    if (perm.callerRole === 'deptMgr') {
      // ??犖?∟???join 瘥??券?
      var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
      var worker  = workers.find(function(w) {
        return w[COLUMNS.USERS.ID] === r[COLUMNS.MONTHLY_POINTS.USER_ID];
      });
      if (!worker || worker[COLUMNS.USERS.DEPARTMENT] !== perm.callerDept) return false;
    }
    return true;
  });

  return { success: true, data: records };
}

// ========== [瑼?銝] ==========

var ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png'];

function uploadFileToDrive(callerEmail, base64Data, fileName, mimeType,
                           workerId, date, category, driveFolderIdParam) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!base64Data || !fileName || !mimeType) {
    return { success: false, error: '蝻箏?瑼?鞈?' };
  }
  if (ALLOWED_MIMES.indexOf(mimeType) === -1) {
    return { success: false, error: '銝?渡?瑼??澆?嚗? + mimeType + '嚗??亙? PDF/JPG/PNG嚗? };
  }

  try {
    var ss = getAppSpreadsheet();
    var config = getConfigObject(ss);
    var rootFolderId = config.driveFolderId || driveFolderIdParam;
    if (!rootFolderId) return { success: false, error: '蝟餌絞閮剖?蝻箏? driveFolderId' };

    var rootFolder = DriveApp.getFolderById(rootFolderId);

    // 鞈?憭曇楝敺?{撟湔?}/{鈭箏蝺刻?}/{category}/
    var yearMonth = date ? date.substring(0, 7) : '?芰';
    var monthFolder = getOrCreateFolder(rootFolder, yearMonth);

    // ??鈭箏憪?
    var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
    var worker  = workers.find(function(w) { return w[COLUMNS.USERS.ID] === workerId; });
    var workerFolderName = worker
      ? (worker[COLUMNS.USERS.NAME] + '_' + workerId)
      : workerId;
    var workerFolder = getOrCreateFolder(monthFolder, workerFolderName);

    var catFolder = getOrCreateFolder(workerFolder, category || 'A1_瘥');

    var blob     = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
    var file     = catFolder.createFile(blob);

    logActivity(callerEmail, 'upload', '銝瑼?嚗? + fileName + ' ??' + file.getId());
    return { success: true, data: { driveFileId: file.getId(), fileName: fileName } };
  } catch (err) {
    return { success: false, error: '銝憭望?嚗? + err.message };
  }
}

function saveFileIndex(callerEmail, record) {
  var perm = checkPermission(callerEmail, ['admin','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };
  if (!record) return { success: false, error: '蝻箏? record 鞈?' };

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

function getFileIndex(callerEmail, workerId, date, itemId) {
  var perm = checkPermission(callerEmail, ['admin','deptMgr','billing','worker']);
  if (!perm.allowed) return { success: false, error: perm.reason };

  var ss = getAppSpreadsheet();
  var records = sheetToObjects(ss.getSheetByName(SHEETS.FILES_INDEX));
  records = records.filter(function(r) {
    var uid = r[COLUMNS.FILES_INDEX.USER_ID];
    if (perm.callerRole === 'worker' && uid !== perm.callerUserId) return false;
    if (workerId && uid !== workerId) return false;
    if (date   && String(r[COLUMNS.FILES_INDEX.DATE])    !== String(date))   return false;
    if (itemId && String(r[COLUMNS.FILES_INDEX.ITEM_ID]) !== String(itemId)) return false;
    return true;
  });
  return { success: true, data: records };
}

function getOrCreateFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ========== [Email ?] ==========

/**
 * N4嚗祟?貊???嚗??reviewItem 敺孛?潘?
 */
function sendReviewNotification(workerId, action2, reason, yearMonth) {
  try {
    var ss = getAppSpreadsheet();
    var config = getConfigObject(ss);
    if (config.notificationEnabled !== 'true') return;

    var workers = sheetToObjects(ss.getSheetByName(SHEETS.USERS));
    var worker  = workers.find(function(w) { return w[COLUMNS.USERS.ID] === workerId; });
    if (!worker || !worker[COLUMNS.USERS.EMAIL]) return;

    var subject = '???貊頂蝯晞? + yearMonth + ' 撖拇?嚗? + action2;
    var body    = '?典末嚗? + worker[COLUMNS.USERS.NAME] + '嚗n\n' +
                  '?函? ' + yearMonth + ' ?遢?撖拇蝯?憒?嚗n' +
                  '??嚗? + action2 + '\n' +
                  (reason ? '??嚗? + reason + '\n' : '') +
                  '\n蝟餌絞 URL嚗? + (config.systemUrl || '嚗??舐窗蝞∠??∴?') +
                  '\n\n甇斤蝟餌絞?芸??嚗??踹?閬?;
    MailApp.sendEmail(worker[COLUMNS.USERS.EMAIL], subject, body);
  } catch (_) {}
}

// ========== [???亥?] ==========

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
    logActivity('system@error', 'error', context + '嚗? + err.message);
  } catch (_) {}
}

// ========== [蝟餌絞閮剖?] ==========

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
  if (!key) return { success: false, error: '蝻箏?閮剖??? };

  var ss = getAppSpreadsheet();
  updateConfigValue(ss, key, value);
  logActivity(callerEmail, 'update', '?湔蝟餌絞閮剖?嚗? + key + ' = ' + value);
  return { success: true, message: '閮剖?撌脫?堆?' + key };
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

// ========== [?梁撌亙] ==========

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
 * 蝯曹?甈?撽?
 * ? { allowed, callerUserId, callerRole, callerDept, callerName }
 */
function checkPermission(callerEmail, allowedRoles) {
  if (!callerEmail) {
    return { allowed: false, reason: '蝻箏? callerEmail ?' };
  }
  // system@auto ?箏?典?恬??湔?曇?
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
        return { allowed: false, reason: '撣唾?撌脣??? };
      }
      var role = String(data[i][roleIdx]) || 'worker';
      if (allowedRoles.indexOf(role) === -1) {
        return {
          allowed: false,
          reason: '甈?銝雲嚗?閬?' + allowedRoles.join('/') + '嚗祕??' + role + '嚗?,
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
  return { allowed: false, reason: '?亦甇文董??' + callerEmail };
}

// ========== [皜祈岫撣唾?] (dev only) ==========

/**
 * ?瑁?甇文撘誑撱箇?皜祈岫撣唾?
 * ??車閫 ? ?車?瑕?憿???8 ?董?? */
function setupTestAccounts() {
  var ss    = getAppSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.USERS);
  if (!sheet) {
    Logger.log('??隢??瑁? initAll()');
    return;
  }

  // SHA-256('test1234') ??hex嚗??箸葫閰血?蝣潮?皝?
  var testHash = '937e8d5fbb48bd4949536cd65b8d35c426b80d2f830c5c308e2cdec422ae2244';

  var now = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
  var accounts = [
    // [鈭箏蝺刻?, 憪?, ?餃?靽∠拳, 撖Ⅳ??, 閫, ?撅祇?, ????? ?瑕?憿?, ?啗?? ??撟渲?憭拇, ??撟渲??敦, ?臬?, 撱箇???, ?敺?交??? ?餃?孵?]
    ['ADM-001','蝟餌絞蝞∠???,'admin@test.com',       testHash,'admin',   '撌亙?蝯?,   '???, 'safety',      now, 0, '', true, now, '', 'password'],
    ['MGR-001','撌亦??A', 'deptmgr@test.com',     testHash,'deptMgr', '?撌乩???,'???, 'safety',      now, 0, '', true, now, '', 'password'],
    ['BIL-001','隢狡撠',  'billing@test.com',     testHash,'billing', '撌亙?蝯?,   '???, 'safety',      now, 0, '', true, now, '', 'password'],
    ['WRK-001','銝?砍??拙','worker_gen@test.com',  testHash,'worker',  '?撌乩???,'憭扳蔬',   'general',     now, 0, '', true, now, '', 'password'],
    ['WRK-002','?Ｗ雀???,'worker_off@test.com',  testHash,'worker',  '撱箇?撌乩???,'??',   'offshore',    now, 0, '', true, now, '', 'password'],
    ['WRK-003','?瑕?蝞∠???,'worker_saf@test.com',  testHash,'worker',  '撌亙?蝯?,   '???, 'safety',      now, 0, '', true, now, '', 'password'],
    ['WRK-004','?唬?鈭箏',  'worker_env@test.com',  testHash,'worker',  '撌亙?蝯?,   '憭扳蔬',   'environment', now, 0, '', true, now, '', 'password'],
    ['WRK-005','皜祈岫撌亦?撣?,'worker_test@test.com', testHash,'worker',  '?撌乩???,'??',   'general',     now, 0, '', true, now, '', 'password'],
  ];

  // 皜?暹?鞈?嚗????哨?
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);

  sheet.getRange(2, 1, accounts.length, accounts[0].length).setValues(accounts);
  Logger.log('??撱箇?皜祈岫撣唾?嚗? + accounts.length + ' 蝑?);
  Logger.log('   ?身撖Ⅳ嚗est1234嚗HA-256 ??嚗?);

  try {
    SpreadsheetApp.getUi().alert(
      '??皜祈岫撣唾?撱箇?摰?嚗n\n' +
      '??' + accounts.length + ' ?董?n' +
      '?身撖Ⅳ嚗est1234\n\n' +
      '撣唾?皜嚗n' +
      accounts.map(function(a) {
        return '??' + a[1] + '嚗? + a[2] + '嚗??莎?' + a[4];
      }).join('\n')
    );
  } catch (_) {}
}
