import { publicAnonKey } from '/utils/supabase/info';
import { validateImageFile } from '../services/imageService';
import { getDillerApiBase } from './dillerApi';

export async function uploadDillerProductQrcodeImage(
  file: File,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const basic = validateImageFile(file);
  if (!basic.valid) {
    return { ok: false, error: basic.error || 'Rasm noto‘g‘ri' };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${getDillerApiBase()}/public/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        apikey: publicAnonKey,
      },
      body: formData,
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.success || !body.url) {
      return { ok: false, error: String(body.error || 'Rasm yuklanmadi') };
    }
    return { ok: true, url: String(body.url) };
  } catch {
    return { ok: false, error: 'Tarmoq xatosi — qayta urinib ko‘ring' };
  }
}
