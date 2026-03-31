export type UploadProgressHandler = (progressPct: number) => void;

export async function compressImageIfNeeded(file: File, opts?: { maxSide?: number; quality?: number; minBytes?: number }) {
  const maxSide = opts?.maxSide ?? 1600;
  const quality = opts?.quality ?? 0.82;
  const minBytes = opts?.minBytes ?? 600_000;

  if (!file.type.startsWith('image/')) return file;
  if (file.size <= minBytes) return file;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) return file;

  const compressed = new File([blob], file.name.replace(/\.(png|webp|jpeg|jpg)$/i, '.jpg'), { type: 'image/jpeg' });
  return compressed.size < file.size ? compressed : file;
}

export async function uploadFormDataWithProgress<T = any>(args: {
  url: string;
  formData: FormData;
  headers?: Record<string, string>;
  onProgress?: UploadProgressHandler;
  abortSignal?: AbortSignal;
}): Promise<{ data: T; status: number }> {
  const { url, formData, headers, onProgress, abortSignal } = args;

  const xhr = new XMLHttpRequest();

  const promise = new Promise<{ data: T; status: number }>((resolve, reject) => {
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable) return;
      const pct = Math.max(0, Math.min(100, Math.round((evt.loaded / evt.total) * 100)));
      onProgress?.(pct);
    };
    xhr.onerror = () => reject(new Error('Upload tarmoq xatoligi'));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    xhr.onload = () => {
      try {
        const status = xhr.status;
        const text = xhr.responseText || '';
        const json = (text ? JSON.parse(text) : {}) as T;
        resolve({ data: json, status });
      } catch (e: any) {
        reject(new Error(e?.message || 'Upload javobini o‘qishda xatolik'));
      }
    };
  });

  xhr.open('POST', url, true);
  if (headers) {
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
  }

  if (abortSignal) {
    if (abortSignal.aborted) xhr.abort();
    abortSignal.addEventListener('abort', () => xhr.abort(), { once: true });
  }

  xhr.send(formData);
  return await promise;
}

