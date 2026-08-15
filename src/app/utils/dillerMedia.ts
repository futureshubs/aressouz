import { uploadDillerProductQrcodeImage } from './dillerProductImageUpload';
import { loadDillerData, saveDillerData, type DillerData } from './dillerData';

const MEDIA_INDEX_KEY = 'aresso:diller:media:index:v1';
const MEDIA_ITEM_PREFIX = 'aresso:diller:media:blob:';

function mediaKey(id: string) {
  return `${MEDIA_ITEM_PREFIX}${id}`;
}

function readIndex(): string[] {
  try {
    const raw = localStorage.getItem(MEDIA_INDEX_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeIndex(ids: string[]) {
  localStorage.setItem(MEDIA_INDEX_KEY, JSON.stringify(ids));
}

function uid() {
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function isDillerLocalImageRef(url?: string | null): boolean {
  return Boolean(url?.startsWith('local:'));
}

export function localImageIdFromRef(url: string): string {
  return url.slice('local:'.length);
}

export function readDillerLocalImage(id: string): string | null {
  try {
    return localStorage.getItem(mediaKey(id));
  } catch {
    return null;
  }
}

export function resolveDillerImage(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('local:')) {
    return readDillerLocalImage(localImageIdFromRef(url)) || undefined;
  }
  return url;
}

export async function compressDillerImageFile(file: File, maxEdge = 720, quality = 0.72): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas yo‘q');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', quality);
}

export async function saveDillerLocalImage(file: File): Promise<{ ref: string; preview: string }> {
  const dataUrl = await compressDillerImageFile(file);
  const id = uid();
  localStorage.setItem(mediaKey(id), dataUrl);
  const ids = readIndex();
  if (!ids.includes(id)) writeIndex([...ids, id]);
  return { ref: `local:${id}`, preview: dataUrl };
}

export function removeDillerLocalImage(ref?: string | null) {
  if (!ref || !isDillerLocalImageRef(ref)) return;
  const id = localImageIdFromRef(ref);
  try {
    localStorage.removeItem(mediaKey(id));
    writeIndex(readIndex().filter((x) => x !== id));
  } catch {
    /* ignore */
  }
}

function dataUrlToFile(dataUrl: string, name: string): File {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/jpeg';
  const bin = atob(b64 || '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

function rewriteImageRefs(data: DillerData, map: Map<string, string>): DillerData {
  const swap = (url?: string) => (url && map.has(url) ? map.get(url)! : url);
  return {
    ...data,
    products: data.products.map((p) => ({ ...p, imageUrl: swap(p.imageUrl) })),
    stores: data.stores.map((s) => ({ ...s, imageUrl: swap(s.imageUrl) })),
  };
}

/** Net yonganda local rasmlarni R2 ga yuboradi va JSON ichidagi havolalarni almashtiradi */
export async function flushDillerLocalImages(): Promise<DillerData> {
  let data = loadDillerData();
  const map = new Map<string, string>();
  const refs = [
    ...data.products.map((p) => p.imageUrl),
    ...data.stores.map((s) => s.imageUrl),
  ].filter((u): u is string => Boolean(u && isDillerLocalImageRef(u)));

  for (const ref of refs) {
    const blob = readDillerLocalImage(localImageIdFromRef(ref));
    if (!blob) continue;
    const file = dataUrlToFile(blob, `${localImageIdFromRef(ref)}.jpg`);
    const up = await uploadDillerProductQrcodeImage(file);
    if (up.ok) {
      map.set(ref, up.url);
      removeDillerLocalImage(ref);
    }
  }

  if (map.size > 0) {
    data = rewriteImageRefs(data, map);
    saveDillerData(data);
  }
  return data;
}
