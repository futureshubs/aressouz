const MEMBERSHIP_KEY = 'community:membership:v1';

export type CommunityMembership = {
  roomId: string;
  regionId: string;
  districtId: string;
  regionName: string;
  districtName: string;
  updatedAt: string;
};

export function saveCommunityMembership(m: CommunityMembership): void {
  try {
    localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
}

export function readCommunityMembership(): CommunityMembership | null {
  try {
    const raw = localStorage.getItem(MEMBERSHIP_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as CommunityMembership;
    if (o?.roomId && o?.regionId != null && o?.districtId != null) return o;
  } catch {
    /* ignore */
  }
  return null;
}

export function clearCommunityMembership(): void {
  try {
    localStorage.removeItem(MEMBERSHIP_KEY);
  } catch {
    /* ignore */
  }
}

export function lastSeenMessageKey(userId: string, roomId: string): string {
  return `community:lastMsg:${userId}:${roomId}`;
}

export function writeLastSeenCommunityMessage(
  userId: string,
  roomId: string,
  messageId: string,
  createdAt: string,
): void {
  try {
    localStorage.setItem(
      lastSeenMessageKey(userId, roomId),
      JSON.stringify({ id: messageId, createdAt }),
    );
  } catch {
    /* ignore */
  }
}

export function readLastSeenCommunityMessage(
  userId: string,
  roomId: string,
): { id: string; createdAt: string } | null {
  try {
    const raw = localStorage.getItem(lastSeenMessageKey(userId, roomId));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o?.id && o?.createdAt) return { id: String(o.id), createdAt: String(o.createdAt) };
  } catch {
    /* ignore */
  }
  return null;
}
