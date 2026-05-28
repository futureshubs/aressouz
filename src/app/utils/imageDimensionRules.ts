import { validateImageFile } from '../services/imageService';
import { uploadDebugLog } from './uploadDebugLog';

/** UI va xabarlar uchun: kvadrat nisbat 1:1 */
export const REQUIRED_IMAGE_ASPECT_LABEL = 'kvadrat (1:1)';
export const REQUIRED_IMAGE_SIZE_LABEL = REQUIRED_IMAGE_ASPECT_LABEL;
export const REQUIRED_IMAGE_SIZE_HINT =
  'Kvadrat rasmlar qabul qilinadi (masalan 512×512, 1024×1024, 2048×2048). Video — istalgan o‘lcham.';

/** @deprecated Faqat kvadrat (width === height) tekshiriladi */
export const REQUIRED_IMAGE_WIDTH = 0;
/** @deprecated Faqat kvadrat (width === height) tekshiriladi */
export const REQUIRED_IMAGE_HEIGHT = 0;

export function isSquareImageDimensions(width: number, height: number): boolean {
  return width > 0 && height > 0 && width === height;
}

export function getImageDimensionsFromFile(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Rasmni o‘qib bo‘lmadi'));
    };
    img.src = url;
  });
}

export function formatImageDimensionError(width: number, height: number): string {
  return `Rasm kvadrat (1:1) bo‘lishi kerak. Sizda: ${width}×${height} px.`;
}

export async function validateSquareImageForUpload(
  file: File,
): Promise<{ valid: boolean; error?: string; width?: number; height?: number }> {
  const basic = validateImageFile(file);
  if (!basic.valid) return basic;

  try {
    const { width, height } = await getImageDimensionsFromFile(file);
    if (!isSquareImageDimensions(width, height)) {
      return { valid: false, error: formatImageDimensionError(width, height), width, height };
    }
    return { valid: true, width, height };
  } catch {
    return { valid: false, error: 'Rasm o‘lchamini tekshirib bo‘lmadi' };
  }
}

/** @deprecated Nom tarixiy; 1:1 kvadrat tekshiruvi */
export async function validateStrictImage500x500(
  file: File,
): Promise<{ valid: boolean; error?: string; width?: number; height?: number }> {
  return validateSquareImageForUpload(file);
}

/** Barcha rasm yuklash joylari uchun (video uchun ishlatilmaydi). */
export async function validateImageForUpload(
  file: File,
): Promise<{ valid: boolean; error?: string; width?: number; height?: number }> {
  uploadDebugLog('validateImageForUpload', {
    fayl: file.name,
    tur: file.type,
    hajm: file.size,
  });
  const result = await validateSquareImageForUpload(file);
  if (!result.valid) {
    uploadDebugLog('validateImageForUpload_rad', {
      fayl: file.name,
      xato: result.error,
      kenglik: result.width,
      balandlik: result.height,
    });
  } else {
    uploadDebugLog('validateImageForUpload_ok', {
      fayl: file.name,
      kenglik: result.width,
      balandlik: result.height,
    });
  }
  return result;
}

/** @deprecated */
export async function rejectImageUploadUnless500x500(
  file: File,
  onError: (message: string) => void,
): Promise<boolean> {
  const result = await validateImageForUpload(file);
  if (!result.valid) {
    onError(result.error ?? 'Rasm noto‘g\'ri');
    return false;
  }
  return true;
}
