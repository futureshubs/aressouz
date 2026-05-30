import { validateImageFile } from '../services/imageService';
import { getImageDimensionsFromFile } from './imageDimensionRules';

const MAX_SIDE_PX = 8192;
const MIN_SIDE_PX = 16;

/** Faqat platforma support chat — istalgan nisbatdagi rasm. */
export async function validateSupportChatImageForUpload(
  file: File,
): Promise<{ valid: boolean; error?: string; width?: number; height?: number }> {
  const basic = validateImageFile(file);
  if (!basic.valid) return basic;

  try {
    const { width, height } = await getImageDimensionsFromFile(file);
    if (width < MIN_SIDE_PX || height < MIN_SIDE_PX) {
      return { valid: false, error: 'Rasm juda kichik' };
    }
    const maxSide = Math.max(width, height);
    if (maxSide > MAX_SIDE_PX) {
      return {
        valid: false,
        error: `Rasm juda katta (max ${MAX_SIDE_PX}px). Sizda: ${width}×${height} px.`,
        width,
        height,
      };
    }
    return { valid: true, width, height };
  } catch {
    return { valid: false, error: 'Rasm o‘lchamini tekshirib bo‘lmadi' };
  }
}
