/**
 * DriveUpload.gs — Google Drive 佐證檔案上傳腳本
 * 
 * 部署方式：在同一個 GAS 專案中新增此檔案（不需要另開新專案）
 * 此檔案的函式由 API.gs 的 doPost 路由呼叫，無需單獨部署。
 * 
 * 支援功能：
 * - 上傳 Base64 編碼的檔案至 Google Drive 指定資料夾
 * - 自動依年月建立子資料夾
 * - 回傳 Drive 檔案 ID 與公開 URL
 * - 將上傳記錄寫入「佐證檔案索引」工作表
 */

/**
 * 上傳佐證檔案至 Google Drive
 * @param {Object} params - 上傳參數
 * @param {string} params.base64Data - Base64 編碼的檔案內容
 * @param {string} params.fileName - 原始檔案名稱
 * @param {string} params.mimeType - 檔案 MIME 類型（如 image/jpeg）
 * @param {string} params.workerId - 協助員工號
 * @param {string} params.workerName - 協助員姓名
 * @param {string} params.dailyPointsId - 關聯的每日點數明細 ID
 * @param {string} params.yearMonth - 年月（格式 YYYY/MM）
 * @returns {Object} { success, fileId, fileUrl, fileName }
 */
function uploadFileToDrive(params) {
  try {
    var base64Data = params.base64Data;
    var fileName = params.fileName;
    var mimeType = params.mimeType || 'application/octet-stream';
    var workerId = params.workerId;
    var workerName = params.workerName;
    var dailyPointsId = params.dailyPointsId;
    var yearMonth = params.yearMonth || Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy/MM');
    
    // 取得或建立目標資料夾
    var targetFolder = getOrCreateMonthFolder(yearMonth, workerId);
    
    // 解碼 Base64 並建立 Blob
    var decodedData = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedData, mimeType, fileName);
    
    // 上傳至 Drive
    var file = targetFolder.createFile(blob);
    
    // 設定公開存取（任何人可查看）
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    var fileUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    var fileSize = file.getSize();
    
    // 寫入佐證檔案索引
    var indexId = recordFileIndex({
      workerId: workerId,
      workerName: workerName,
      dailyPointsId: dailyPointsId,
      fileName: fileName,
      driveFileId: fileId,
      driveUrl: fileUrl,
      mimeType: mimeType,
      fileSize: fileSize
    });
    
    return {
      success: true,
      fileId: fileId,
      fileUrl: fileUrl,
      fileName: fileName,
      indexId: indexId
    };
    
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 取得或建立月份子資料夾
 * 資料夾結構：根資料夾 / 佐證檔案 / YYYY年MM月 / 工號-姓名
 */
function getOrCreateMonthFolder(yearMonth, workerId) {
  var rootFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  
  // 取得或建立「佐證檔案」資料夾
  var evidenceFolder;
  var evidenceFolders = rootFolder.getFoldersByName('佐證檔案');
  if (evidenceFolders.hasNext()) {
    evidenceFolder = evidenceFolders.next();
  } else {
    evidenceFolder = rootFolder.createFolder('佐證檔案');
  }
  
  // 取得或建立年月資料夾（如 2025年01月）
  var parts = yearMonth.split('/');
  var monthFolderName = parts[0] + '年' + parts[1] + '月';
  var monthFolder;
  var monthFolders = evidenceFolder.getFoldersByName(monthFolderName);
  if (monthFolders.hasNext()) {
    monthFolder = monthFolders.next();
  } else {
    monthFolder = evidenceFolder.createFolder(monthFolderName);
  }
  
  // 取得或建立工號資料夾
  var workerFolders = monthFolder.getFoldersByName(workerId);
  if (workerFolders.hasNext()) {
    return workerFolders.next();
  } else {
    return monthFolder.createFolder(workerId);
  }
}

/**
 * 將上傳記錄寫入「佐證檔案索引」工作表
 */
function recordFileIndex(params) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('佐證檔案索引');
  var now = new Date();
  
  // 產生唯一 ID
  var indexId = 'FILE-' + Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMddHHmmss') + '-' + params.workerId;
  
  sheet.appendRow([
    indexId,                    // 檔案ID
    params.workerId,            // 工號
    params.workerName,          // 姓名
    params.dailyPointsId,       // 關聯明細ID
    params.fileName,            // 檔案名稱
    params.driveFileId,         // Drive檔案ID
    params.driveUrl,            // Drive URL
    params.mimeType,            // 檔案類型
    params.fileSize,            // 檔案大小
    now,                        // 上傳時間
    '正常'                      // 狀態
  ]);
  
  return indexId;
}

/**
 * 刪除佐證檔案（軟刪除，僅更新狀態欄位）
 */
function deleteFileRecord(fileId) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('佐證檔案索引');
  var data = sheet.getDataRange().getValues();
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][5] === fileId) { // F 欄 = Drive檔案ID
      sheet.getRange(i + 1, 11).setValue('已刪除'); // K 欄 = 狀態
      return { success: true };
    }
  }
  
  return { success: false, error: '找不到此檔案記錄' };
}
