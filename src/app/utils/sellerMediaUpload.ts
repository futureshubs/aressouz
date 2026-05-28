import { edgeFetch } from './apiFetch';
import { uploadDebugLog, uploadDebugError } from './uploadDebugLog';
import { validateImageForUpload } from './imageDimensionRules';

export type SellerMediaUploadResult = {
  url: string;
  warning?: string;
  message?: string;
};

function maskToken(token: string): string {
  if (!token || token.length < 12) return token ? '***' : 'YO‘Q';
  return `${token.slice(0, 14)}…(${token.length})`;
}

function parseUploadErrorBody(
  data: Record<string, unknown>,
  status: number,
): string {
  const msg = String(data.message || data.error || '').trim();
  if (status === 401 && (msg.includes('JWT') || data.message === 'Invalid JWT')) {
    return 'Server autentifikatsiyasi rad etildi (401 JWT). Edge function `--no-verify-jwt` bilan deploy qilinganini tekshiring.';
  }
  if (status === 401) {
    return msg || 'Sessiya tugagan yoki noto‘g‘ri. Qayta kiring.';
  }
  if (status === 400 && msg) return msg;
  return msg || `Yuklash xatosi (HTTP ${status})`;
}

/**
 * Seller mahsulot rasmi/video yuklash (`/seller/upload-media`).
 * `edgeFetch` — `apikey` + `Authorization` (401 Invalid JWT oldini olish).
 */
export async function uploadSellerMediaFile(
  file: File,
  sellerToken: string,
  options?: { skipDimensionCheck?: boolean },
): Promise<SellerMediaUploadResult> {
  const isImage = file.type.startsWith('image/');

  uploadDebugLog('boshlandi', {
    fayl: file.name,
    tur: file.type,
    hajm: file.size,
    token: maskToken(sellerToken),
    rasm: isImage,
  });

  if (!sellerToken?.trim()) {
    uploadDebugError('token_yoq', {});
    throw new Error('Seller sessiyasi topilmadi. Qayta kiring.');
  }

  if (isImage && !options?.skipDimensionCheck) {
    uploadDebugLog('olcham_tekshiruvi', { fayl: file.name });
    const dim = await validateImageForUpload(file);
    if (!dim.valid) {
      uploadDebugError('olcham_rad', { xato: dim.error, fayl: file.name });
      throw new Error(dim.error || 'Rasm kvadrat (1:1) bo‘lishi kerak');
    }
    uploadDebugLog('olcham_ok', { fayl: file.name });
  }

  if (file.size > 50 * 1024 * 1024) {
    uploadDebugError('hajm_rad', { hajm: file.size });
    throw new Error('Fayl hajmi 50MB dan kichik bo‘lishi kerak');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('token', sellerToken);

  const path = `/seller/upload-media?token=${encodeURIComponent(sellerToken)}`;
  uploadDebugLog('sorov', { yoL: path, sarlavha: 'X-Seller-Token + apikey' });

  let response: Response;
  try {
    response = await edgeFetch(path, {
      method: 'POST',
      headers: {
        'X-Seller-Token': sellerToken,
      },
      body: formData,
    });
  } catch (e) {
    uploadDebugError('tarmoq', {
      xato: e instanceof Error ? e.message : String(e),
      ehtimol: 'CORS yoki internet uzildi',
    });
    throw new Error(
      e instanceof Error
        ? `Tarmoq xatosi: ${e.message}`
        : 'Tarmoq xatosi — so‘rov serverga yetmadi',
    );
  }

  const rawText = await response.text();
  let data: Record<string, unknown> = {};
  try {
    data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    uploadDebugError('javob_json_emas', { status: response.status, matn: rawText.slice(0, 200) });
  }

  uploadDebugLog('javob', {
    status: response.status,
    ok: response.ok,
    body: data,
  });

  if (!response.ok) {
    const message = parseUploadErrorBody(data, response.status);
    uploadDebugError('muvaffaqiyatsiz', { status: response.status, message, body: data });
    if (data.code === 500 && String(data.message || '').includes('R2')) {
      throw new Error('R2 storage sozlanmagan. Admin bilan bog‘laning.');
    }
    throw new Error(message);
  }

  const url = String(data.url || '');
  if (!url) {
    uploadDebugError('url_yoq', { body: data });
    throw new Error('Server URL qaytarmadi');
  }

  uploadDebugLog('muvaffaqiyat', { url: url.slice(0, 80) });
  return {
    url,
    warning: data.warning as string | undefined,
    message: data.message as string | undefined,
  };
}
