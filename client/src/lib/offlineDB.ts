/**
 * IndexedDB 離線草稿管理
 * 使用 idb 函式庫提供簡潔的 Promise API
 */
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'worker-points-offline';
const DB_VERSION = 1;

export interface OfflineDraftFile {
  name: string;
  type: string;
  size: number;
  blob: Blob;
}

export interface OfflineDraft {
  id: string;
  userId: string;
  date: string;
  itemId: string;
  completed: boolean;
  note: string;
  pendingFiles: OfflineDraftFile[];
  savedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('drafts')) {
          const store = db.createObjectStore('drafts', { keyPath: 'id' });
          store.createIndex('byUserDate', ['userId', 'date']);
          store.createIndex('byUserId', 'userId');
        }
      },
    });
  }
  return dbPromise;
}

// 儲存草稿（upsert）
export async function saveDraft(draft: OfflineDraft): Promise<void> {
  const db = await getDB();
  await db.put('drafts', { ...draft, savedAt: Date.now() });
}

// 讀取單筆草稿
export async function getDraft(id: string): Promise<OfflineDraft | undefined> {
  const db = await getDB();
  return db.get('drafts', id);
}

// 讀取某用戶某日所有草稿
export async function getDraftsByDate(userId: string, date: string): Promise<OfflineDraft[]> {
  const db = await getDB();
  return db.getAllFromIndex('drafts', 'byUserDate', [userId, date]);
}

// 讀取某用戶所有草稿
export async function getAllDraftsByUser(userId: string): Promise<OfflineDraft[]> {
  const db = await getDB();
  return db.getAllFromIndex('drafts', 'byUserId', userId);
}

// 刪除草稿
export async function deleteDraft(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('drafts', id);
}

// 清除某用戶某日草稿
export async function clearDraftsByDate(userId: string, date: string): Promise<void> {
  const drafts = await getDraftsByDate(userId, date);
  const db = await getDB();
  const tx = db.transaction('drafts', 'readwrite');
  await Promise.all(drafts.map(d => tx.store.delete(d.id)));
  await tx.done;
}

// 計算待上傳草稿數量
export async function countPendingDrafts(userId: string): Promise<number> {
  const drafts = await getAllDraftsByUser(userId);
  return drafts.filter(d => d.pendingFiles.length > 0 || d.completed).length;
}
