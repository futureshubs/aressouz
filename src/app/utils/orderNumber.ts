export const formatOrderNumber = (raw?: string, fallback?: string): string => {
  const source = String(raw || fallback || '').trim();
  if (!source) return '#—';

  // Prefer stable numeric tail for all legacy/new formats.
  const digitGroups = source.match(/\d{4,}/g) || [];
  if (digitGroups.length > 0) {
    const last = digitGroups[digitGroups.length - 1];
    const short = last.length > 6 ? last.slice(-6) : last;
    return `#${short}`;
  }

  // Fallback to last segment (prevents full "order:restaurant:..." noise in UI)
  const lastSegment = source.split(':').filter(Boolean).pop() || source;
  return `#${lastSegment.replace(/^#/, '')}`;
};

