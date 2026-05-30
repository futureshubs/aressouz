/** Server `USER_SUPPORT_BRANCH_ID` bilan mos — mijoz widget ↔ support panel */
export const USER_SUPPORT_BRANCH_ID = 'aresso_support';

export function isPlatformSupportChat(branchId: string) {
  return String(branchId || '').trim() === USER_SUPPORT_BRANCH_ID;
}

export function chatListTitle(branchId: string, participantName?: string) {
  if (isPlatformSupportChat(branchId)) return 'Aresso support';
  return participantName?.trim() || `Filial ${branchId}`;
}

export function formatChatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatChatPreview(content: string, type?: string, caption?: string) {
  if (type === 'image') {
    return caption?.trim() ? `📷 ${caption.slice(0, 80)}` : '📷 Rasm';
  }
  return content?.trim() || '—';
}
