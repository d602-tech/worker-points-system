/**
 * 檔案上傳工具
 * 支援 HEIC 轉 JPEG、多檔上傳、進度回調、失敗重試
 */

// 動態載入 heic2any 以避免 SSR 問題
async function convertHeicToJpeg(file: File): Promise<File> {
  if (!file.type.includes('heic') && !file.name.toLowerCase().endsWith('.heic')) {
    return file;
  }
  try {
    const heic2any = (await import('heic2any')).default;
    const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 }) as Blob;
    const newName = file.name.replace(/\.heic$/i, '.jpg');
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    console.warn('HEIC 轉換失敗，使用原始檔案');
    return file;
  }
}

export interface UploadProgress {
  fileName: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'done' | 'error';
  url?: string;
  error?: string;
}

export interface UploadResult {
  fileId: string;
  fileName: string;
  mimeType: string;
  url: string;
  driveFileId: string;
}

type ProgressCallback = (progress: UploadProgress) => void;

// 將 File 轉為 Base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // 移除 data:xxx;base64, 前綴
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// 單檔上傳（含重試）
async function uploadSingleFile(
  file: File,
  params: { userId: string; date: string; itemId: string },
  uploadFn: (data: {
    userId: string; date: string; itemId: string;
    fileName: string; mimeType: string; fileBase64: string;
  }) => Promise<UploadResult>,
  onProgress: ProgressCallback,
  maxRetries = 2,
): Promise<UploadResult> {
  // HEIC 轉換
  const processedFile = await convertHeicToJpeg(file);

  onProgress({ fileName: processedFile.name, progress: 10, status: 'uploading' });

  const fileBase64 = await fileToBase64(processedFile);
  onProgress({ fileName: processedFile.name, progress: 50, status: 'uploading' });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await uploadFn({
        ...params,
        fileName: processedFile.name,
        mimeType: processedFile.type || 'application/octet-stream',
        fileBase64,
      });
      onProgress({ fileName: processedFile.name, progress: 100, status: 'done', url: result.url });
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  onProgress({ fileName: processedFile.name, progress: 0, status: 'error', error: lastError?.message });
  throw lastError;
}

// 多檔上傳
export async function uploadFiles(
  files: File[],
  params: { userId: string; date: string; itemId: string },
  uploadFn: (data: {
    userId: string; date: string; itemId: string;
    fileName: string; mimeType: string; fileBase64: string;
  }) => Promise<UploadResult>,
  onProgress: ProgressCallback,
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  for (const file of files) {
    const result = await uploadSingleFile(file, params, uploadFn, onProgress);
    results.push(result);
  }
  return results;
}

// 驗證檔案大小（10MB 限制）
export function validateFileSize(file: File, maxMB = 10): boolean {
  return file.size <= maxMB * 1024 * 1024;
}

// 驗證檔案類型
export function validateFileType(file: File): boolean {
  const allowed = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'image/heic', 'image/heif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  return allowed.includes(file.type) || file.name.toLowerCase().endsWith('.heic');
}
