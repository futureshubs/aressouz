import { useEffect } from 'react';
import { useTabVisible } from '../hooks/useTabVisible';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { notifyCommunityBackgroundMessage } from '../utils/appToast';
import {
  readCommunityMembership,
  readLastSeenCommunityMessage,
  writeLastSeenCommunityMessage,
} from '../utils/communityMembershipStorage';

function messagePreview(m: {
  type?: string;
  content?: string;
  locationLabel?: string;
}): string {
  const t = m.type || 'text';
  if (t === 'image') return 'Rasm';
  if (t === 'voice') return 'Ovozli xabar';
  if (t === 'location') return m.locationLabel || 'Joylashuv';
  return String(m.content || '').trim() || 'Xabar';
}

type Props = { activeTab: string };

/**
 * Community a’zosi bo‘lganda, boshqa bo‘limlarda yangi xabar kelganda qisqa toast + ovoz.
 */
export function CommunityBackgroundNotifier({ activeTab }: Props) {
  const { user, accessToken, isAuthenticated } = useAuth();

  const tabVisible = useTabVisible();

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !user?.id) return;
    if (activeTab === 'community') return;
    if (!tabVisible) return;

    const poll = async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

      const membership = readCommunityMembership();
      if (!membership?.roomId) return;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${publicAnonKey}`,
        'X-Access-Token': accessToken,
      };

      try {
        const params = new URLSearchParams({
          regionId: membership.regionId,
          districtId: membership.districtId,
          limit: '30',
        });
        const res = await fetch(
          `${API_BASE_URL}/community/room/${encodeURIComponent(membership.roomId)}/messages?${params.toString()}`,
          { headers },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(data.messages) || data.messages.length === 0) return;

        const list = [...data.messages].sort(
          (a: { createdAt?: string }, b: { createdAt?: string }) =>
            new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime(),
        );
        const newest = list[list.length - 1] as {
          id: string;
          userId: string;
          senderName?: string;
          createdAt: string;
          type?: string;
          content?: string;
          locationLabel?: string;
        };
        if (!newest?.id || !newest.createdAt) return;

        const last = readLastSeenCommunityMessage(user.id, membership.roomId);
        const newTime = new Date(newest.createdAt).getTime();

        if (!last) {
          writeLastSeenCommunityMessage(user.id, membership.roomId, newest.id, newest.createdAt);
          return;
        }

        if (newest.id === last.id) return;

        const lastTime = new Date(last.createdAt).getTime();
        if (!Number.isFinite(newTime) || newTime <= lastTime) {
          writeLastSeenCommunityMessage(user.id, membership.roomId, newest.id, newest.createdAt);
          return;
        }

        if (String(newest.userId) === String(user.id)) {
          writeLastSeenCommunityMessage(user.id, membership.roomId, newest.id, newest.createdAt);
          return;
        }

        notifyCommunityBackgroundMessage(
          String(newest.senderName || 'A’zo'),
          messagePreview(newest),
        );
        writeLastSeenCommunityMessage(user.id, membership.roomId, newest.id, newest.createdAt);
      } catch {
        /* tarmoq */
      }
    };

    const id = window.setInterval(poll, 11_000);
    void poll();
    return () => window.clearInterval(id);
  }, [activeTab, accessToken, isAuthenticated, user?.id, tabVisible]);

  return null;
}
