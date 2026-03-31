import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle, RefreshCcw, Search, Send, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useTheme } from '../context/ThemeContext';
import { regions } from '../data/regions';
import { API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';

interface CommunityRoom {
  id: string;
  name: string;
  description: string;
  regionId: string;
  districtId: string;
  regionName: string;
  districtName: string;
  memberCount: number;
  lastMessageAt?: string | null;
}

interface CommunityMessage {
  id: string;
  roomId: string;
  userId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  createdAt: string;
}

interface CommunityViewProps {
  onBack?: () => void;
}

interface CommunityRoomSummary extends CommunityRoom {
  messageCount?: number;
  joined?: boolean;
}

interface AvailableChatItem {
  id: string;
  regionId: string;
  districtId: string;
  regionName: string;
  districtName: string;
  roomName: string;
}

const dedupeMessages = (items: CommunityMessage[]) =>
  Array.from(new Map(items.map(item => [item.id, item])).values()).sort((first, second) => {
    const timeDiff = new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
    return timeDiff !== 0 ? timeDiff : first.id.localeCompare(second.id);
  });

const areMessagesEqual = (first: CommunityMessage[], second: CommunityMessage[]) =>
  first.length === second.length &&
  first.every((message, index) => {
    const other = second[index];
    return other && message.id === other.id && message.createdAt === other.createdAt && message.content === other.content;
  });

const buildReadCountStorageKey = (userId: string, roomId: string) => `community:last-read-count:${userId}:${roomId}`;

const readResponsePayload = async (response: Response) => {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { rawText };
  }
};

export function CommunityView({ onBack }: CommunityViewProps) {
  const { theme, accentColor } = useTheme();
  const { user, accessToken, isAuthenticated, setIsAuthOpen } = useAuth();
  const { selectedRegion, selectedDistrict, setLocation, setLocationModalOpen } = useLocation();
  const isDark = theme === 'dark';

  const [room, setRoom] = useState<CommunityRoom | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [joined, setJoined] = useState(false);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [chatSearch, setChatSearch] = useState('');
  const [roomSummaries, setRoomSummaries] = useState<Record<string, CommunityRoomSummary>>({});
  const [roomsApiAvailable, setRoomsApiAvailable] = useState(true);

  // Client-side safety net:
  // even if backend moderation misses some variants, we never render community
  // "bad language" messages to the user.
  const normalizeCommunityTextClient = (text: string) => {
    return String(text || '')
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .replace(/'/g, '')
      .replace(/-/g, '');
  };

  const isCommunityBadLanguageClient = (rawContent: string) => {
    const normalized = normalizeCommunityTextClient(rawContent);
    if (!normalized) return false;

    const lettersOnly = normalized.replace(/[^a-zа-яё0-9]/gi, '');

    const re = [
      /\b(fuck|shit|bitch|asshole|dick|cunt|dumb|idiot|moron|stupid)\b/i,
      /(?:^|[^a-z])s+u+k+a+(?:$|[^a-z])/i, // suka*
      /(?:^|[^a-z])k+u+r+v+[a-z]*(?:$|[^a-z])/i, // kurv*
      /(?:^|[^a-z])bl+y+a+(?:$|[^a-z])/i, // blya*
      /(?:^|[^a-z])bl+y+a+t+(?:$|[^a-z])/i, // blyat*
      /(?:^|[^a-z])x+u+y+(?:$|[^a-z])/i, // xuy*
      /(?:^|[^a-z])x+u+j+(?:$|[^a-z])/i, // xuj*
      /(?:^|[^a-z])h+u+i+(?:$|[^a-z])/i, // hui*
      /\b(kurva|kurvya|pidar[a-z]*|pizd[a-z]*|eb[a-z]*|jeb[a-z]*|hui[a-z]*|xuj[a-z]*|xuy[a-z]*)\b/i,
      /\b(jilov|johil|ahmoq|tentak|qargish|qargash|qargishlar)\b/i,
      /\blanat\b/i,

      // Cyrillic profanity (basic)
      /\b(сука|курва|бля|блядь|пидар|пидор)\b/i,
      /\b(хуй|хер|пизда|пизд)\w*\b/i,
      /\b(ебать|еб*ать|еблан)\b/i,
    ];

    return re.some((x) => x.test(normalized) || (lettersOnly ? x.test(lettersOnly) : false));
  };

  const locationMeta = useMemo(() => {
    const region = regions.find(item => item.id === selectedRegion);
    const district = region?.districts.find(item => item.id === selectedDistrict);

    return {
      regionId: selectedRegion,
      districtId: selectedDistrict,
      regionName: region?.name || '',
      districtName: district?.name || '',
      isReady: Boolean(selectedRegion && selectedDistrict && region?.name && district?.name),
    };
  }, [selectedDistrict, selectedRegion]);

  const availableChats = useMemo<AvailableChatItem[]>(
    () =>
      regions.flatMap(region =>
        region.districts.map(district => ({
          id: `${region.id}:${district.id}`,
          regionId: region.id,
          districtId: district.id,
          regionName: region.name,
          districtName: district.name,
          roomName: `${district.name} community`,
        }))
      ),
    []
  );

  const requestHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
      'X-Access-Token': accessToken || '',
    }),
    [accessToken]
  );

  const loadRoomsList = useCallback(
    async (silent = false) => {
      if (!isAuthenticated || !accessToken) {
        setRoomSummaries({});
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/community/rooms`, {
          headers: requestHeaders,
        });

        const data = await readResponsePayload(response);
        if (!response.ok) {
          if (response.status === 404) {
            setRoomsApiAvailable(false);
            setRoomSummaries({});
            return;
          }

          throw new Error(
            (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error) ||
              'Community chatlar ro\'yxatini yuklab bo\'lmadi'
          );
        }

        const nextSummaries = Object.fromEntries(
          (data && typeof data === 'object' && 'rooms' in data && Array.isArray(data.rooms) ? data.rooms : []).map(
            (item: CommunityRoomSummary) => [item.id, item]
          )
        );

        setRoomsApiAvailable(true);
        setRoomSummaries(nextSummaries);
      } catch (error: any) {
        console.error('Community rooms list error:', error);
        if (!silent && roomsApiAvailable) {
          toast.error(error.message || 'Community chatlar ro\'yxatini yuklab bo\'lmadi');
        }
      }
    },
    [accessToken, isAuthenticated, requestHeaders, roomsApiAvailable]
  );

  const loadRoom = useCallback(async () => {
    if (!isAuthenticated || !accessToken || !locationMeta.isReady) {
      setRoom(null);
      setJoined(false);
      return;
    }

    setLoadingRoom(true);
    try {
      const params = new URLSearchParams({
        regionId: locationMeta.regionId,
        districtId: locationMeta.districtId,
        regionName: locationMeta.regionName,
        districtName: locationMeta.districtName,
      });

      const response = await fetch(`${API_BASE_URL}/community/room?${params.toString()}`, {
        headers: requestHeaders,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Community xonasini yuklab bo\'lmadi');
      }

      setRoom(data.room || null);
      setJoined(Boolean(data.joined));
      if (data.room?.id) {
        setRoomSummaries(prev => ({
          ...prev,
          [data.room.id]: {
            ...(prev[data.room.id] || {}),
            ...data.room,
            joined: Boolean(data.joined),
          },
        }));
      }
      setLastSyncedAt(new Date().toISOString());
    } catch (error: any) {
      console.error('Community room load error:', error);
      toast.error(error.message || 'Community xonasini yuklab bo\'lmadi');
    } finally {
      setLoadingRoom(false);
    }
  }, [accessToken, isAuthenticated, locationMeta, requestHeaders]);

  const loadMessages = useCallback(
    async ({
      targetRoom,
      silent = false,
    }: {
      targetRoom?: CommunityRoom | null;
      silent?: boolean;
    } = {}) => {
      const activeRoom = targetRoom || room;
      if (!activeRoom || !accessToken) {
        setMessages([]);
        return;
      }

      if (!silent) {
        setLoadingMessages(true);
      }

      try {
        const params = new URLSearchParams({
          regionId: locationMeta.regionId,
          districtId: locationMeta.districtId,
          limit: '80',
        });

        const response = await fetch(
          `${API_BASE_URL}/community/room/${activeRoom.id}/messages?${params.toString()}`,
          {
            headers: requestHeaders,
          }
        );

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Xabarlarni yuklab bo\'lmadi');
        }

        const nextMessages = dedupeMessages(Array.isArray(data.messages) ? data.messages : []);
        const safeMessages = nextMessages.filter(m => !isCommunityBadLanguageClient(m.content));
        setMessages(prev => (areMessagesEqual(prev, safeMessages) ? prev : safeMessages));
        setLastSyncedAt(new Date().toISOString());
      } catch (error: any) {
        console.error('Community messages load error:', error);
        if (!silent) {
          toast.error(error.message || 'Xabarlarni yuklab bo\'lmadi');
        }
      } finally {
        if (!silent) {
          setLoadingMessages(false);
        }
      }
    },
    [accessToken, locationMeta.districtId, locationMeta.regionId, requestHeaders, room]
  );

  useVisibilityRefetch(() => {
    void loadRoomsList(true);
    void loadRoom();
  });

  useEffect(() => {
    loadRoomsList();
  }, [loadRoomsList]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!roomsApiAvailable) {
      return;
    }

    const intervalId = window.setInterval(() => {
      loadRoomsList(true);
    }, 10000);

    return () => window.clearInterval(intervalId);
  }, [loadRoomsList, roomsApiAvailable]);

  useEffect(() => {
    if (!joined || !room) {
      setMessages([]);
      return;
    }

    loadMessages({ targetRoom: room });
    const intervalId = window.setInterval(() => {
      loadMessages({ targetRoom: room, silent: true });
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [joined, loadMessages, room]);

  const handleJoin = async () => {
    if (!room || !locationMeta.isReady) {
      return;
    }

    setJoining(true);
    try {
      const response = await fetch(`${API_BASE_URL}/community/room/${room.id}/join`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          regionId: locationMeta.regionId,
          districtId: locationMeta.districtId,
          regionName: locationMeta.regionName,
          districtName: locationMeta.districtName,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Community xonaga qo\'shilib bo\'lmadi');
      }

      setRoom(data.room || room);
      setJoined(true);
      if (data.room?.id) {
        setRoomSummaries(prev => ({
          ...prev,
          [data.room.id]: {
            ...(prev[data.room.id] || {}),
            ...data.room,
            joined: true,
          },
        }));
      }
      toast.success('Community xonaga muvaffaqiyatli qo\'shildingiz');
      await loadMessages({ targetRoom: data.room || room });
    } catch (error: any) {
      console.error('Community join error:', error);
      toast.error(error.message || 'Community xonaga qo\'shilib bo\'lmadi');
    } finally {
      setJoining(false);
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!room || !draft.trim() || sending) {
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`${API_BASE_URL}/community/room/${room.id}/messages`, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          content: draft.trim(),
          regionId: locationMeta.regionId,
          districtId: locationMeta.districtId,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        // If text is rejected by moderation (400/403), clear draft so user doesn't re-send the same message.
        if (response.status === 400 || response.status === 403) {
          setDraft('');
        }
        // If this is community bad-language moderation, do not show toast.
        if (data?.code === 'community_bad_language') {
          // Also remove any previously loaded bad-language messages from UI state.
          setMessages(prev => prev.filter(m => !isCommunityBadLanguageClient(m.content)));
          toast.error('Nojo‘ya so‘z ishlatmang. Bu so‘z taqiqlangan.');
          return;
        }
        throw new Error(data.error || 'Xabar yuborilmadi');
      }

      setDraft('');
      const safeNewMessage = !isCommunityBadLanguageClient(data.message?.content) ? data.message : null;
      if (safeNewMessage) {
        setMessages(prev => dedupeMessages([...prev, safeNewMessage]));
      }
      setRoomSummaries(prev => ({
        ...prev,
        [room.id]: {
          ...(prev[room.id] || room),
          ...(room || {}),
          id: room.id,
          name: room.name,
          description: room.description,
          regionId: room.regionId,
          districtId: room.districtId,
          regionName: room.regionName,
          districtName: room.districtName,
          joined: true,
          lastMessageAt: data.message.createdAt,
          messageCount: (prev[room.id]?.messageCount || 0) + 1,
        },
      }));
      setLastSyncedAt(new Date().toISOString());
    } catch (error: any) {
      console.error('Community send error:', error);
      const msg = error?.message || 'Xabar yuborilmadi';
      if (!String(msg).includes('Noto‘g‘ri so‘z')) {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handleDraftKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter -> send, Shift+Enter -> newline
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      // Submit the form programmatically
      handleSend(event as unknown as FormEvent);
    }
  };

  const selectedChatKey = locationMeta.isReady ? `${locationMeta.regionId}:${locationMeta.districtId}` : '';

  const filteredChats = useMemo(() => {
    const normalizedQuery = chatSearch.trim().toLowerCase();

    return availableChats.filter(chat => {
      if (!normalizedQuery) {
        return true;
      }

      return [chat.roomName, chat.regionName, chat.districtName]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [availableChats, chatSearch]);

  useEffect(() => {
    if (!user?.id || !room?.id || !joined) {
      return;
    }

    const summary = roomSummaries[room.id];
    const readCount = Math.max(summary?.messageCount || 0, messages.length);
    localStorage.setItem(buildReadCountStorageKey(user.id, room.id), String(readCount));
  }, [joined, messages.length, room?.id, roomSummaries, user?.id]);

  const renderSidebar = () => (
    <aside
      className="w-full border-b md:w-[320px] md:flex-shrink-0 md:border-b-0 md:border-r"
      style={{
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.94)',
      }}
    >
      <div
        className="border-b px-4 py-4"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
      >
        <h2 className="text-lg font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
          Chatlar
        </h2>
        <p className="mt-1 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.62)' : '#6b7280' }}>
          Hudud bo‘yicha community xonalar
        </p>
        <div
          className="mt-3 flex items-center gap-2 rounded-2xl border px-3 py-2"
          style={{
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(248,250,252,0.96)',
          }}
        >
          <Search className="h-4 w-4" style={{ color: accentColor.color }} />
          <input
            value={chatSearch}
            onChange={event => setChatSearch(event.target.value)}
            placeholder="Chat qidirish..."
            className="w-full bg-transparent text-sm outline-none"
            style={{ color: isDark ? '#fff' : '#111827' }}
          />
        </div>
      </div>

      <div className="max-h-[calc(100vh-144px)] overflow-y-auto px-2 py-2 md:max-h-[calc(100vh-72px)]">
        <div className="space-y-1">
          {filteredChats.map(chat => {
            const isActive = selectedChatKey === chat.id;
            const roomId = `community_${chat.regionId}_${chat.districtId}`;
            const summary = roomSummaries[roomId];
            const readCount = user?.id
              ? Number(localStorage.getItem(buildReadCountStorageKey(user.id, roomId)) || '0')
              : 0;
            const unreadCount = Math.max(0, (summary?.messageCount || 0) - readCount);

            return (
              <button
                key={chat.id}
                onClick={() => setLocation(chat.regionId, chat.districtId)}
                className="w-full rounded-2xl px-3 py-3 text-left transition-all active:scale-[0.99]"
                style={{
                  background: isActive
                    ? isDark
                      ? `linear-gradient(135deg, ${accentColor.color}30, ${accentColor.color}15)`
                      : `linear-gradient(135deg, ${accentColor.color}18, ${accentColor.color}0d)`
                    : 'transparent',
                  border: isActive
                    ? `1px solid ${accentColor.color}55`
                    : `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)'}`,
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl"
                    style={{
                      background: isActive
                        ? accentColor.gradient
                        : isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(15,23,42,0.06)',
                    }}
                  >
                    <MessageCircle className="h-5 w-5" style={{ color: isActive ? '#fff' : accentColor.color }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
                        {chat.roomName}
                      </p>
                      {unreadCount > 0 ? (
                        <span
                          className="inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
                          style={{ backgroundImage: accentColor.gradient }}
                        >
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.58)' : '#6b7280' }}>
                      {chat.regionName}, {chat.districtName}
                    </p>
                    {summary?.lastMessageAt ? (
                      <p className="mt-1 text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.44)' : '#9ca3af' }}>
                        {new Date(summary.lastMessageAt).toLocaleTimeString('uz-UZ', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );

  const renderMainPlaceholder = (title: string, description: string, action?: ReactNode) => (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4 md:p-6">
      <div
        className="w-full max-w-3xl rounded-[28px] border p-6 sm:p-8"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.9)',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.35)' : '0 20px 60px rgba(15,23,42,0.08)',
        }}
      >
        <div
          className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ backgroundImage: accentColor.gradient }}
        >
          <MessageCircle className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
          {title}
        </h1>
        <p className="mt-2 text-sm sm:text-base" style={{ color: isDark ? 'rgba(255,255,255,0.68)' : '#4b5563' }}>
          {description}
        </p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );

  const renderTopBar = () => (
    <div
      className="flex h-[72px] items-center justify-between gap-3 border-b px-4"
      style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl transition-transform active:scale-[0.98]"
          style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff', color: isDark ? '#fff' : '#111827' }}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
            {locationMeta.isReady ? `${locationMeta.districtName} community` : 'Community'}
          </h1>
          <p className="truncate text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.58)' : '#6b7280' }}>
            {locationMeta.isReady ? `${locationMeta.regionName}, ${locationMeta.districtName}` : 'Hududiy chat xonalari'}
          </p>
        </div>
      </div>

      {locationMeta.isReady ? (
        <button
          onClick={() => {
            loadRoom();
            if (room && joined) {
              loadMessages({ targetRoom: room });
            }
          }}
          className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium transition-transform active:scale-[0.98]"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
            color: accentColor.color,
          }}
        >
          <RefreshCcw className="h-4 w-4" />
          Yangilash
        </button>
      ) : null}
    </div>
  );

  let mainContent: ReactNode;

  if (!isAuthenticated) {
    mainContent = renderMainPlaceholder(
      'Community chat',
      'Hududingizdagi odamlar bilan chat qilish uchun avval akkauntga kiring.',
      <button
        onClick={() => setIsAuthOpen(true)}
        className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        style={{ backgroundImage: accentColor.gradient, boxShadow: `0 14px 30px ${accentColor.color}35` }}
      >
        Kirish
      </button>
    );
  } else if (!locationMeta.isReady) {
    mainContent = renderMainPlaceholder(
      'Community uchun chat tanlang',
      'Chap tomondagi chatlar ro‘yxatidan kerakli hududni tanlang yoki hududni qo‘lda belgilang.',
      <button
        onClick={() => setLocationModalOpen(true)}
        className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        style={{ backgroundImage: accentColor.gradient, boxShadow: `0 14px 30px ${accentColor.color}35` }}
      >
        Hudud tanlash
      </button>
    );
  } else if (loadingRoom) {
    mainContent = (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: accentColor.color }} />
      </div>
    );
  } else if (room && !joined) {
    mainContent = (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4">
        <div className="max-w-xl text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ backgroundImage: accentColor.gradient }}
          >
            <Users className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
            {room.name}
          </h2>
          <p className="mt-2 text-sm sm:text-base" style={{ color: isDark ? 'rgba(255,255,255,0.68)' : '#4b5563' }}>
            {room.description}
          </p>
          <button
            onClick={handleJoin}
            disabled={joining}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-transform disabled:opacity-60 active:scale-[0.98]"
            style={{ backgroundImage: accentColor.gradient, boxShadow: `0 14px 30px ${accentColor.color}35` }}
          >
            {joining ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Communityga qo‘shilish
          </button>
        </div>
      </div>
    );
  } else {
    mainContent = (
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          className="border-b px-4 py-3 md:px-5"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)',
                color: isDark ? 'rgba(255,255,255,0.82)' : '#374151',
              }}
            >
              <Users className="h-4 w-4" />
              {room?.memberCount || 0} a'zo
            </div>
            {lastSyncedAt ? (
              <span className="text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#6b7280' }}>
                So‘nggi yangilanish: {new Date(lastSyncedAt).toLocaleTimeString('uz-UZ')}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-5">
          <div
            className="min-h-0 flex-1 overflow-y-auto rounded-[24px] p-3 sm:p-4"
            style={{
              background: isDark ? 'rgba(0,0,0,0.18)' : 'rgba(248,250,252,0.95)',
              border: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(15,23,42,0.05)',
            }}
          >
            {loadingMessages ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin" style={{ color: accentColor.color }} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
                <MessageCircle className="mb-4 h-10 w-10" style={{ color: accentColor.color }} />
                <p className="text-base font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
                  Hali xabar yo‘q
                </p>
                <p className="mt-1 text-sm" style={{ color: isDark ? 'rgba(255,255,255,0.62)' : '#6b7280' }}>
                  Birinchi xabarni yuborib suhbatni boshlab bering.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages
                  .filter(m => !isCommunityBadLanguageClient(m.content))
                  .map(message => {
                  const isOwnMessage = message.userId === user?.id;

                  return (
                    <div
                      key={message.id}
                      className="rounded-3xl px-4 py-3"
                      style={{
                        background: isOwnMessage
                          ? accentColor.gradient
                          : isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(255,255,255,0.96)',
                        boxShadow: isOwnMessage ? `0 16px 28px ${accentColor.color}25` : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className="text-sm font-semibold"
                          style={{ color: isOwnMessage ? '#fff' : isDark ? '#fff' : '#111827' }}
                        >
                          {message.senderName}
                        </p>
                        <span
                          className="text-[11px]"
                          style={{
                            color: isOwnMessage
                              ? 'rgba(255,255,255,0.74)'
                              : isDark
                                ? 'rgba(255,255,255,0.5)'
                                : '#6b7280',
                          }}
                        >
                          {new Date(message.createdAt).toLocaleTimeString('uz-UZ', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p
                        className="mt-1 whitespace-pre-wrap text-sm leading-6 sm:text-[15px]"
                        style={{
                          color: isOwnMessage
                            ? '#fff'
                            : isDark
                              ? 'rgba(255,255,255,0.9)'
                              : '#1f2937',
                        }}
                      >
                        {message.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="flex items-end gap-3">
            <div className="flex-1">
              <textarea
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Hududingiz uchun xabar yozing..."
                rows={2}
                maxLength={1000}
                className="w-full resize-none rounded-[24px] border px-4 py-3 text-sm outline-none transition-colors sm:text-base"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
                  color: isDark ? '#fff' : '#111827',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white transition-transform disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundImage: accentColor.gradient, boxShadow: `0 14px 30px ${accentColor.color}35` }}
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden" style={{ background: isDark ? '#000' : '#f8fafc' }}>
      {renderTopBar()}
      <div className="flex h-[calc(100vh-72px)] flex-col md:flex-row">
        {renderSidebar()}
        {mainContent}
      </div>
    </div>
  );
}
