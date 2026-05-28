import { validateImageFile } from '../services/imageService';

export const REQUIRED_IMAGE_WIDTH = 500;
export const REQUIRED_IMAGE_HEIGHT = 500;
export const REQUIRED_IMAGE_SIZE_LABEL = '500×500';
export const REQUIRED_IMAGE_SIZE_HINT =
  `Faqat ${REQUIRED_IMAGE_SIZE_LABEL} piksel rasmlar qabul qilinadi (video — istalgan o‘lcham).`;

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
  return `Rasm faqat ${REQUIRED_IMAGE_SIZE_LABEL} px bo‘lishi kerak. Sizda: ${width}×${height} px.`;
}

export async function validateStrictImage500x500(
  file: File,
): Promise<{ valid: boolean; error?: string; width?: number; height?: number }> {
  const basic = validateImageFile(file);
  if (!basic.valid) return basic;

  try {
    const { width, height } = await getImageDimensionsFromFile(file);
    if (width !== REQUIRED_IMAGE_WIDTH || height !== REQUIRED_IMAGE_HEIGHT) {
      return { valid: false, error: formatImageDimensionError(width, height), width, height };
    }
    return { valid: true, width, height };
  } catch {
    return { valid: false, error: 'Rasm o‘lchamini tekshirib bo‘lmadi' };
  }
}

/** Barcha rasm yuklash joylari uchun (video uchun ishlatilmaydi). */
export async function validateImageForUpload(
  file: File,
): Promise<{ valid: boolean; error?: string }> {
  return validateStrictImage500x500(file);
}

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
