export const REQUIRED_IMAGE_WIDTH = 500;
export const REQUIRED_IMAGE_HEIGHT = 500;

type DimRead =
  | { ok: true; width: number; height: number }
  | { ok: false; error: string };

function readPngDimensions(buffer: Uint8Array): DimRead {
  if (buffer.length < 24) return { ok: false, error: 'Rasm buzilgan' };
  const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
  const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
  return { ok: true, width, height };
}

function readGifDimensions(buffer: Uint8Array): DimRead {
  if (buffer.length < 10) return { ok: false, error: 'Rasm buzilgan' };
  const width = buffer[6] | (buffer[7] << 8);
  const height = buffer[8] | (buffer[9] << 8);
  return { ok: true, width, height };
}

function readJpegDimensions(buffer: Uint8Array): DimRead {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return { ok: false, error: 'JPEG formati noto‘g‘ri' };
  }
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = buffer[i + 1];
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      const height = (buffer[i + 5] << 8) | buffer[i + 6];
      const width = (buffer[i + 7] << 8) | buffer[i + 8];
      return { ok: true, width, height };
    }
    const len = (buffer[i + 2] << 8) | buffer[i + 3];
    if (len < 2) break;
    i += 2 + len;
  }
  return { ok: false, error: 'JPEG o‘lchamini o‘qib bo‘lmadi' };
}

function readWebpDimensions(buffer: Uint8Array): DimRead {
  if (buffer.length < 30) return { ok: false, error: 'Rasm buzilgan' };
  const riff = String.fromCharCode(buffer[0], buffer[1], buffer[2], buffer[3]);
  const webp = String.fromCharCode(buffer[8], buffer[9], buffer[10], buffer[11]);
  if (riff !== 'RIFF' || webp !== 'WEBP') return { ok: false, error: 'WebP formati noto‘g‘ri' };
  const chunk = String.fromCharCode(buffer[12], buffer[13], buffer[14], buffer[15]);
  if (chunk === 'VP8X') {
    const width = 1 + (buffer[24] | (buffer[25] << 8) | ((buffer[26] & 0x0f) << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | ((buffer[29] & 0x0f) << 16));
    return { ok: true, width, height };
  }
  if (chunk === 'VP8 ' && buffer.length >= 30) {
    const width = buffer[26] | ((buffer[27] & 0x3f) << 8);
    const height = buffer[28] | ((buffer[29] & 0x3f) << 8);
    return { ok: true, width, height };
  }
  if (chunk === 'VP8L' && buffer.length >= 25) {
    const bits = buffer[21] | (buffer[22] << 8) | (buffer[23] << 16) | (buffer[24] << 24);
    const width = 1 + (bits & 0x3fff);
    const height = 1 + ((bits >> 14) & 0x3fff);
    return { ok: true, width, height };
  }
  return { ok: false, error: 'WebP o‘lchamini o‘qib bo‘lmadi' };
}

export function readImageDimensionsFromBuffer(buffer: Uint8Array, mimeType: string): DimRead {
  const mime = (mimeType || '').toLowerCase();
  if (mime.includes('png')) return readPngDimensions(buffer);
  if (mime.includes('jpeg') || mime.includes('jpg')) return readJpegDimensions(buffer);
  if (mime.includes('gif')) return readGifDimensions(buffer);
  if (mime.includes('webp')) return readWebpDimensions(buffer);
  if (buffer[0] === 0x89) return readPngDimensions(buffer);
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return readJpegDimensions(buffer);
  if (buffer[0] === 0x47) return readGifDimensions(buffer);
  if (buffer[0] === 0x52) return readWebpDimensions(buffer);
  return { ok: false, error: 'Rasm formati qo‘llab-quvvatlanmaydi' };
}

export function assertImage500x500(width: number, height: number): string | null {
  if (width === REQUIRED_IMAGE_WIDTH && height === REQUIRED_IMAGE_HEIGHT) return null;
  return `Rasm faqat ${REQUIRED_IMAGE_WIDTH}×${REQUIRED_IMAGE_HEIGHT} px bo‘lishi kerak. Sizda: ${width}×${height} px.`;
}

/** Rasm bufferini tekshiradi; video/audio uchun null (ruxsat). */
export function validateImageBuffer500x500(
  buffer: Uint8Array,
  mimeType: string,
): string | null {
  if (!mimeType.startsWith('image/')) return null;
  const dim = readImageDimensionsFromBuffer(buffer, mimeType);
  if (!dim.ok) return dim.error;
  return assertImage500x500(dim.width, dim.height);
}
