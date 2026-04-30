/**
 * Migration_v3_1.gs
 * 自動在差勤紀錄新增「請假時間」欄位
 */

function runMigrationV3_1() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('差勤紀錄');
  
  if (!sheet) {
    Logger.log('找不到「差勤紀錄」分頁，跳過移轉。');
    return { success: false, error: '找不到「差勤紀錄」分頁' };
  }

  // 取得第一列的標題
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // 檢查是否已存在「請假時間」
  const hasLeaveTime = headers.indexOf('請假時間') !== -1;
  
  if (!hasLeaveTime) {
    // 找出目前的最後一個欄位，把新欄位加在最後面
    const newColIndex = headers.length + 1;
    sheet.getRange(1, newColIndex).setValue('請假時間');
    Logger.log('成功在「差勤紀錄」新增「請假時間」欄位。');
  } else {
    Logger.log('「請假時間」欄位已存在，無需變更。');
  }
  
  return { success: true, message: 'v3.1 Migration 執行完畢' };
}
