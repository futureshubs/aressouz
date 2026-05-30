/** Frontend — server `chat-messages.ts` bilan mos ko‘rinish */

export function isChatImageMessage(type: string, content: string): boolean {
  const t = String(type || '').toLowerCase();
  if (t === 'image') return true;
  return /^https?:\/\//i.test(String(content || '').trim());
}

export function chatMessagePreviewText(
  content: string,
  type?: string,
  imageCaption?: string,
): string {
  if (isChatImageMessage(type || '', content)) {
    const cap = String(imageCaption || '').trim();
    return cap ? `📷 ${cap.slice(0, 80)}` : '📷 Rasm';
  }
  return String(content || '').trim() || '—';
}

export function chatImageFallbackLabel(isOwn: boolean, imageCaption?: string): string {
  if (imageCaption?.trim()) return imageCaption.trim();
  return isOwn ? "To'lov cheki (rasm)" : 'Rasm';
}
