import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowDown,
  ArrowLeft,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  Paperclip,
  RefreshCcw,
  Reply,
  Send,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import { useTheme } from '../context/ThemeContext';
import { regions } from '../data/regions';
import { API_BASE_URL, publicAnonKey } from '../../../utils/supabase/info';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { ChatMessagesSkeleton, CommunityRoomSkeleton } from './skeletons';
import { compressImageIfNeeded } from '../utils/uploadWithProgress';

type CommunityMessageType = 'text' | 'image' | 'voice' | 'location';

interface CommunityReplyRef {
  messageId: string;
  userId: string;
  senderName: string;
  type?: CommunityMessageType;
  preview: string;
  mediaUrl?: string;
}

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
  type?: CommunityMessageType;
  mediaUrl?: string;
  durationSec?: number;
  lat?: number;
  lng?: number;
  locationLabel?: string;
  replyTo?: CommunityReplyRef;
}

interface CommunityViewProps {
  onBack?: () => void;
}

interface CommunityRoomSummary extends CommunityRoom {
  messageCount?: number;
  joined?: boolean;
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
    if (!other) return false;
    return (
      message.id === other.id &&
      message.createdAt === other.createdAt &&
      message.content === other.content &&
      (message.type || 'text') === (other.type || 'text') &&
      (message.mediaUrl || '') === (other.mediaUrl || '') &&
      Number(message.lat ?? NaN) === Number(other.lat ?? NaN) &&
      Number(message.lng ?? NaN) === Number(other.lng ?? NaN) &&
      (message.replyTo?.messageId || '') === (other.replyTo?.messageId || '') &&
      (message.replyTo?.preview || '') === (other.replyTo?.preview || '')
    );
  });

const hueFromUserId = (userId: string) => {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
};

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
  const { selectedRegion, selectedDistrict, setLocationModalOpen } = useLocation();
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
  const [roomSummaries, setRoomSummaries] = useState<Record<string, CommunityRoomSummary>>({});
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const [roomsApiAvailable, setRoomsApiAvailable] = useState(true);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [replyTarget, setReplyTarget] = useState<CommunityMessage | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const filterVisibleCommunityMessage = useCallback((m: CommunityMessage) => {
    const t = m.type || 'text';
    if (t === 'voice') return true;
    if (t === 'image') return !isCommunityBadLanguageClient(m.content || '');
    if (t === 'location') return !isCommunityBadLanguageClient(m.locationLabel || m.content || '');
    return !isCommunityBadLanguageClient(m.content);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- moderator funksiyasi barqaror mantiq
  }, []);

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

  const requestHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${publicAnonKey}`,
      'X-Access-Token': accessToken || '',
    }),
    [accessToken]
  );

  /** DELETE uchun Content-Type yo'q — ba'zi proxy/muhitlarda ortiqcha */
  const deleteRequestHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${publicAnonKey}`,
      'X-Access-Token': accessToken || '',
    }),
    [accessToken]
  );

  const uploadHeaders = useMemo(
    () => ({
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
        const safeMessages = nextMessages.filter(filterVisibleCommunityMessage);
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
    [accessToken, filterVisibleCommunityMessage, locationMeta.districtId, locationMeta.regionId, requestHeaders, room]
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

  const uploadCommunityMediaFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE_URL}/community/upload-media`, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });
      const data = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(
          (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error) ||
            'Fayl yuklanmadi',
        );
      }
      if (!data || typeof data !== 'object' || !('url' in data) || !String((data as { url: unknown }).url)) {
        throw new Error('Yuklash javobi noto‘g‘ri');
      }
      return String((data as { url: string }).url);
    },
    [uploadHeaders],
  );

  const sendCommunityPayload = async (body: Record<string, unknown>) => {
    const activeRoom = room;
    if (!activeRoom) {
      throw new Error('Xona yo‘q');
    }

    const response = await fetch(`${API_BASE_URL}/community/room/${activeRoom.id}/messages`, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify({
        ...body,
        ...(replyTarget?.id ? { replyToMessageId: replyTarget.id } : {}),
        regionId: locationMeta.regionId,
        districtId: locationMeta.districtId,
      }),
    });

    const data = await readResponsePayload(response);

    if (!response.ok) {
      if ((response.status === 400 || response.status === 403) && body.type === 'text') {
        setDraft('');
      }
      if (data && typeof data === 'object' && 'code' in data && data.code === 'community_bad_language') {
        setMessages(prev => prev.filter(filterVisibleCommunityMessage));
        toast.error('Nojo‘ya so‘z ishlatmang. Bu so‘z taqiqlangan.');
        throw new Error('moderated');
      }
      throw new Error(
        (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error) ||
          'Xabar yuborilmadi',
      );
    }

    const rawMsg =
      data && typeof data === 'object' && 'message' in data ? (data.message as CommunityMessage) : null;
    if (rawMsg && filterVisibleCommunityMessage(rawMsg)) {
      setMessages(prev => dedupeMessages([...prev, rawMsg]));
    }

    setRoomSummaries(prev => ({
      ...prev,
      [activeRoom.id]: {
        ...(prev[activeRoom.id] || activeRoom),
        ...(activeRoom || {}),
        id: activeRoom.id,
        name: activeRoom.name,
        description: activeRoom.description,
        regionId: activeRoom.regionId,
        districtId: activeRoom.districtId,
        regionName: activeRoom.regionName,
        districtName: activeRoom.districtName,
        joined: true,
        lastMessageAt: rawMsg?.createdAt,
        messageCount: (prev[activeRoom.id]?.messageCount || 0) + 1,
      },
    }));
    setLastSyncedAt(new Date().toISOString());
    setReplyTarget(null);
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!room) return;
    if (!window.confirm('Bu xabar o‘chirilsinmi? Rasm yoki ovoz bo‘lsa, fayl ham o‘chiriladi.')) return;

    const idNorm = String(messageId).trim();
    setDeletingId(idNorm);
    try {
      const qs = new URLSearchParams({
        regionId: locationMeta.regionId,
        districtId: locationMeta.districtId,
      });
      const response = await fetch(
        `${API_BASE_URL}/community/room/${room.id}/messages/${encodeURIComponent(idNorm)}?${qs.toString()}`,
        { method: 'DELETE', headers: deleteRequestHeaders },
      );
      const data = await readResponsePayload(response);
      if (!response.ok) {
        throw new Error(
          (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' && data.error) ||
            'O‘chirilmadi',
        );
      }
      setMessages(prev => prev.filter(m => String(m.id).trim() !== idNorm));
      setReplyTarget(cur => (cur?.id != null && String(cur.id).trim() === idNorm ? null : cur));
      setRoomSummaries(prev => ({
        ...prev,
        [room.id]: {
          ...(prev[room.id] || room),
          messageCount: Math.max(0, (prev[room.id]?.messageCount || 0) - 1),
        },
      }));
      toast.success('Xabar o‘chirildi');
    } catch (error: any) {
      toast.error(error?.message || 'O‘chirishda xatolik');
    } finally {
      setDeletingId(null);
    }
  };

  const scrollToMessageId = (id: string) => {
    const el = document.getElementById(`cm-${id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!room || !draft.trim() || sending) {
      return;
    }

    setSending(true);
    try {
      await sendCommunityPayload({ type: 'text', content: draft.trim() });
      setDraft('');
    } catch (error: any) {
      console.error('Community send error:', error);
      const msg = error?.message || 'Xabar yuborilmadi';
      if (msg !== 'moderated' && !String(msg).includes('Noto‘g‘ri so‘z')) {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  };

  const handlePickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !room || sending) return;

    setSending(true);
    try {
      const compressed = await compressImageIfNeeded(file, { maxSide: 1920, quality: 0.85, minBytes: 350_000 });
      const url = await uploadCommunityMediaFile(compressed);
      const caption = draft.trim();
      if (caption) {
        await sendCommunityPayload({ type: 'image', mediaUrl: url, content: caption });
        setDraft('');
      } else {
        await sendCommunityPayload({ type: 'image', mediaUrl: url });
      }
    } catch (error: any) {
      console.error('Community image send error:', error);
      if (error?.message !== 'moderated') {
        toast.error(error?.message || 'Rasm yuborilmadi');
      }
    } finally {
      setSending(false);
    }
  };

  const stopVoiceRecording = () => {
    const rec = voiceRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      rec.stop();
    }
  };

  const toggleVoiceRecording = async () => {
    if (!room || sending) return;
    if (recordingVoice) {
      stopVoiceRecording();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Brauzeringiz ovoz yozishni qo‘llab-quvvatlamaydi');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      voiceChunksRef.current = [];
      const preferredTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t));
      const rec = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      voiceRecorderRef.current = rec;
      rec.ondataavailable = e => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        voiceStreamRef.current?.getTracks().forEach(t => t.stop());
        voiceStreamRef.current = null;
        voiceRecorderRef.current = null;
        setRecordingVoice(false);
        const blob = new Blob(voiceChunksRef.current, { type: rec.mimeType || 'audio/webm' });
        voiceChunksRef.current = [];
        if (blob.size < 800) {
          toast('Juda qisqa ovoz — qayta yozing');
          return;
        }
        void (async () => {
          setSending(true);
          try {
            const ext = blob.type.includes('webm') ? 'webm' : 'm4a';
            const audioFile = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
            const url = await uploadCommunityMediaFile(audioFile);
            await sendCommunityPayload({ type: 'voice', mediaUrl: url });
          } catch (error: any) {
            if (error?.message !== 'moderated') {
              toast.error(error?.message || 'Ovoz yuborilmadi');
            }
          } finally {
            setSending(false);
          }
        })();
      };
      setRecordingVoice(true);
      rec.start();
    } catch {
      toast.error('Mikrofonga ruxsat bering');
    }
  };

  const sendCurrentLocation = () => {
    if (!room || sending || recordingVoice) return;
    if (!navigator.geolocation) {
      toast.error('Joylashuv qo‘llab-quvvatlanmaydi');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        setSending(true);
        try {
          await sendCommunityPayload({
            type: 'location',
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            locationLabel: 'Mening joylashuvim',
          });
        } catch (error: any) {
          if (error?.message !== 'moderated') {
            toast.error(error?.message || 'Joylashuv yuborilmadi');
          }
        } finally {
          setSending(false);
        }
      },
      () => toast.error('Joylashuvni aniqlab bo‘lmadi — ruxsat bering.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const handleDraftKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter -> send, Shift+Enter -> newline
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      // Submit the form programmatically
      handleSend(event as unknown as FormEvent);
    }
  };

  const currentRoomId = locationMeta.isReady
    ? `community_${locationMeta.regionId}_${locationMeta.districtId}`
    : '';

  const safeMessagesList = useMemo(
    () => messages.filter(filterVisibleCommunityMessage),
    [messages, filterVisibleCommunityMessage],
  );

  useEffect(() => {
    return () => {
      voiceStreamRef.current?.getTracks().forEach(t => t.stop());
      const rec = voiceRecorderRef.current;
      if (rec && rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [safeMessagesList.length, loadingMessages, joined]);

  useEffect(() => {
    const el = messagesScrollRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      requestAnimationFrame(() => {
        setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
      });
    });
  }, [safeMessagesList.length, joined, loadingMessages]);

  useEffect(() => {
    if (!user?.id || !room?.id || !joined) {
      return;
    }

    const summary = roomSummaries[room.id];
    const readCount = Math.max(summary?.messageCount || 0, messages.length);
    localStorage.setItem(buildReadCountStorageKey(user.id, room.id), String(readCount));
  }, [joined, messages.length, room?.id, roomSummaries, user?.id]);

  const renderSidebar = () => {
    const sidebarUnread = (() => {
      if (!user?.id || !currentRoomId) return 0;
      const summary = roomSummaries[currentRoomId];
      const readCount = Number(localStorage.getItem(buildReadCountStorageKey(user.id, currentRoomId)) || '0');
      return Math.max(0, (summary?.messageCount || 0) - readCount);
    })();

    return (
      <aside
        className="w-full shrink-0 border-b md:w-[260px] md:border-b-0 md:border-r"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.94)',
        }}
      >
        <div
          className="border-b px-3 py-2.5 md:px-3.5"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
        >
          <h2 className="text-sm font-bold tracking-tight" style={{ color: isDark ? '#fff' : '#111827' }}>
            Hudud chati
          </h2>
          <p className="mt-0.5 text-[11px] leading-snug" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#6b7280' }}>
            Faqat tanlangan viloyat va tumandagi community. Boshqa chatlar ro‘yxatda chiqmaydi — hududni almashtirsangiz,
            chat avtomatik o‘zgaradi.
          </p>
        </div>

        <div className="px-2 py-2 md:px-2.5 md:py-2.5">
          {!isAuthenticated ? (
            <p className="px-2 py-2 text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : '#6b7280' }}>
              Kirishdan keyin hududingiz chati ochiladi.
            </p>
          ) : !locationMeta.isReady ? (
            <button
              type="button"
              onClick={() => setLocationModalOpen(true)}
              className="flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs font-medium transition-colors active:scale-[0.99]"
              style={{
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
                background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                color: isDark ? '#fff' : '#111827',
              }}
            >
              <MapPin className="h-4 w-4 shrink-0" style={{ color: accentColor.color }} />
              Hududni tanlang
            </button>
          ) : (
            <div
              className="rounded-xl border px-2.5 py-2"
              style={{
                borderColor: `${accentColor.color}44`,
                background: isDark ? `${accentColor.color}14` : `${accentColor.color}0f`,
              }}
            >
              <div className="flex items-start gap-2">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundImage: accentColor.gradient }}
                >
                  <MessageCircle className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
                      {locationMeta.districtName} community
                    </p>
                    {sidebarUnread > 0 ? (
                      <span
                        className="inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                        style={{ backgroundImage: accentColor.gradient }}
                      >
                        {sidebarUnread > 99 ? '99+' : sidebarUnread}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[10px] leading-tight" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#6b7280' }}>
                    {locationMeta.regionName}, {locationMeta.districtName}
                  </p>
                  {roomSummaries[currentRoomId]?.lastMessageAt ? (
                    <p className="mt-1 text-[10px]" style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>
                      {new Date(String(roomSummaries[currentRoomId]!.lastMessageAt)).toLocaleTimeString('uz-UZ', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold transition-opacity active:opacity-80"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                  color: accentColor.color,
                }}
              >
                <MapPin className="h-3.5 w-3.5" />
                Hududni o‘zgartirish
              </button>
            </div>
          )}
        </div>
      </aside>
    );
  };

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
          <h1 className="truncate text-base font-bold md:text-lg" style={{ color: isDark ? '#fff' : '#111827' }}>
            {locationMeta.isReady ? `${locationMeta.districtName}` : 'Community'}
          </h1>
          <p className="truncate text-[11px] md:text-xs" style={{ color: isDark ? 'rgba(255,255,255,0.58)' : '#6b7280' }}>
            {locationMeta.isReady
              ? `${locationMeta.regionName} · mahalliy chat`
              : 'Hudud tanlang — faqat shu yerga oid chat'}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {locationMeta.isReady ? (
          <button
            type="button"
            onClick={() => setLocationModalOpen(true)}
            className="inline-flex h-9 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold transition-transform active:scale-[0.98] md:hidden"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
              color: accentColor.color,
            }}
            title="Hudud"
          >
            <MapPin className="h-4 w-4" />
          </button>
        ) : null}
        {locationMeta.isReady ? (
          <button
            type="button"
            onClick={() => {
              loadRoom();
              if (room && joined) {
                loadMessages({ targetRoom: room });
              }
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold transition-transform active:scale-[0.98]"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
              color: accentColor.color,
            }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Yangilash</span>
          </button>
        ) : null}
      </div>
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
      'Hududni tanlang',
      'Faqat tanlangan viloyat va tuman uchun community chati ochiladi. Boshqa hududlar ro‘yxatda ko‘rinmaydi.',
      <button
        onClick={() => setLocationModalOpen(true)}
        className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
        style={{ backgroundImage: accentColor.gradient, boxShadow: `0 14px 30px ${accentColor.color}35` }}
      >
        Hudud tanlash
      </button>
    );
  } else if (loadingRoom) {
    mainContent = <CommunityRoomSkeleton isDark={isDark} />;
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
          className="border-b px-3 py-2 md:px-4"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)' }}
        >
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] md:text-xs">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
                color: isDark ? 'rgba(255,255,255,0.75)' : '#4b5563',
              }}
            >
              <Users className="h-3 w-3" />
              {room?.memberCount ?? 0}
            </span>
            {lastSyncedAt ? (
              <span style={{ color: isDark ? 'rgba(255,255,255,0.4)' : '#9ca3af' }}>
                {new Date(lastSyncedAt).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col gap-2 p-2 sm:gap-2.5 sm:p-3 md:p-4">
          <div
            ref={messagesScrollRef}
            className="relative min-h-0 flex-1 overflow-y-auto rounded-2xl px-1 py-2 sm:px-2"
            style={{
              backgroundColor: isDark ? '#0e1620' : '#d1d5db',
              backgroundImage: isDark
                ? 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.055) 1px, transparent 0)'
                : 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
              backgroundSize: '22px 22px',
              border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(15,23,42,0.08)',
            }}
          >
            {loadingMessages ? (
              <div className="flex min-h-[240px] flex-col">
                <ChatMessagesSkeleton isDark={isDark} />
              </div>
            ) : safeMessagesList.length === 0 ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center px-4 text-center">
                <MessageCircle className="mb-2 h-8 w-8 opacity-80" style={{ color: accentColor.color }} />
                <p className="text-sm font-semibold" style={{ color: isDark ? '#fff' : '#111827' }}>
                  Hali xabar yo‘q
                </p>
                <p className="mt-0.5 text-[11px]" style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#6b7280' }}>
                  Rasm, ovoz, joylashuv — pastdagi tugmalar
                </p>
              </div>
            ) : (
              <div className="flex flex-col pb-10">
                {safeMessagesList.map((message, idx) => {
                  const isOwnMessage = String(message.userId || '').trim() === String(user?.id || '').trim();
                  const prev = idx > 0 ? safeMessagesList[idx - 1] : null;
                  const showSenderName = !isOwnMessage && (!prev || prev.userId !== message.userId);
                  const tightGroup = idx > 0 && prev?.userId === message.userId;
                  const msgType = message.type || 'text';
                  const nh = hueFromUserId(message.userId);
                  const senderColor = isDark ? `hsl(${nh}, 70%, 68%)` : `hsl(${nh}, 56%, 38%)`;
                  const textColorOwn = '#fff';
                  const textColorIn = isDark ? 'rgba(255,255,255,0.92)' : '#111827';

                  const avatarUrl = message.senderAvatar?.trim();
                  const showAvatar = !isOwnMessage;
                  const initial = (message.senderName || '?').trim().slice(0, 1).toUpperCase() || '?';

                  const replyHue = message.replyTo ? hueFromUserId(message.replyTo.userId) : 0;

                  return (
                    <div
                      id={`cm-${message.id}`}
                      key={message.id}
                      className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'} ${tightGroup && !showSenderName ? 'mt-0.5' : 'mt-2.5 first:mt-0'}`}
                    >
                      {showAvatar ? (
                        <div className="flex w-9 shrink-0 flex-col items-center justify-end">
                          {showSenderName ? (
                            avatarUrl && /^https?:\/\//i.test(avatarUrl) ? (
                              <img
                                src={avatarUrl}
                                alt=""
                                className="h-9 w-9 rounded-full object-cover ring-1 ring-black/10"
                              />
                            ) : (
                              <div
                                className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white ring-1 ring-black/10"
                                style={{ background: `linear-gradient(135deg, hsl(${nh},55%,45%), hsl(${(nh + 40) % 360},55%,35%))` }}
                              >
                                {initial}
                              </div>
                            )
                          ) : (
                            <div className="h-9 w-9" aria-hidden />
                          )}
                        </div>
                      ) : null}

                      <div
                        className={`min-w-0 flex flex-col ${isOwnMessage ? 'max-w-[82%] items-end sm:max-w-[72%]' : 'max-w-[calc(100%-2.75rem)] items-start sm:max-w-[min(72%,320px)]'}`}
                      >
                        {showSenderName ? (
                          <p
                            className="mb-0.5 max-w-full truncate px-0.5 text-[11px] font-semibold"
                            style={{ color: senderColor }}
                          >
                            {message.senderName}
                          </p>
                        ) : null}
                        <div
                          className={`rounded-[18px] px-2 py-1.5 shadow-sm ${
                            isOwnMessage ? 'rounded-br-[4px]' : 'rounded-bl-[4px]'
                          }`}
                          style={{
                            background: isOwnMessage
                              ? accentColor.gradient
                              : isDark
                                ? 'rgba(36,48,62,0.96)'
                                : '#ffffff',
                            boxShadow: isOwnMessage ? `0 2px 10px ${accentColor.color}28` : '0 1px 3px rgba(0,0,0,0.08)',
                          }}
                        >
                          {message.replyTo ? (
                            <button
                              type="button"
                              onClick={() => scrollToMessageId(message.replyTo!.messageId)}
                              className="mb-1.5 w-full max-w-full rounded-lg border-l-[3px] py-1 pl-2 pr-1 text-left transition-opacity active:opacity-80"
                              style={{
                                borderColor: accentColor.color,
                                background: isOwnMessage
                                  ? 'rgba(0,0,0,0.14)'
                                  : isDark
                                    ? 'rgba(0,0,0,0.25)'
                                    : 'rgba(0,0,0,0.05)',
                              }}
                            >
                              <p
                                className="text-[10px] font-bold"
                                style={{
                                  color: isOwnMessage
                                    ? 'rgba(255,255,255,0.95)'
                                    : isDark
                                      ? `hsl(${replyHue}, 70%, 72%)`
                                      : `hsl(${replyHue}, 56%, 36%)`,
                                }}
                              >
                                {message.replyTo.senderName}
                              </p>
                              <div className="mt-0.5 flex items-center gap-1.5">
                                {message.replyTo.mediaUrl ? (
                                  <img
                                    src={message.replyTo.mediaUrl}
                                    alt=""
                                    className="h-8 w-8 shrink-0 rounded-md object-cover"
                                  />
                                ) : null}
                                <p
                                  className="line-clamp-2 text-[11px] leading-snug"
                                  style={{
                                    color: isOwnMessage ? 'rgba(255,255,255,0.85)' : isDark ? 'rgba(255,255,255,0.65)' : '#4b5563',
                                  }}
                                >
                                  {message.replyTo.preview}
                                </p>
                              </div>
                            </button>
                          ) : null}
                          {msgType === 'image' && message.mediaUrl ? (
                            <>
                              <img
                                src={message.mediaUrl}
                                alt=""
                                className="max-h-52 max-w-[min(100%,280px)] rounded-xl object-cover"
                                loading="lazy"
                              />
                              {message.content ? (
                                <p
                                  className="mt-1 whitespace-pre-wrap text-[13px] leading-[1.38]"
                                  style={{ color: isOwnMessage ? textColorOwn : textColorIn }}
                                >
                                  {message.content}
                                </p>
                              ) : null}
                            </>
                          ) : null}
                          {msgType === 'voice' && message.mediaUrl ? (
                            <audio
                              src={message.mediaUrl}
                              controls
                              preload="metadata"
                              className="h-9 w-[min(100%,260px)] max-w-[260px]"
                            />
                          ) : null}
                          {msgType === 'location' && message.lat != null && message.lng != null ? (
                            <a
                              href={`https://www.google.com/maps?q=${encodeURIComponent(`${message.lat},${message.lng}`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[13px] font-medium underline decoration-1 underline-offset-2"
                              style={{ color: isOwnMessage ? '#fff' : accentColor.color }}
                            >
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              {message.locationLabel || 'Xaritada ochish'}
                            </a>
                          ) : null}
                          {msgType === 'text' ? (
                            <p
                              className="whitespace-pre-wrap text-[13px] leading-[1.38]"
                              style={{ color: isOwnMessage ? textColorOwn : textColorIn }}
                            >
                              {message.content}
                            </p>
                          ) : null}
                          <p
                            className="mt-0.5 text-right text-[10px] tabular-nums"
                            style={{
                              color: isOwnMessage
                                ? 'rgba(255,255,255,0.65)'
                                : isDark
                                  ? 'rgba(255,255,255,0.42)'
                                  : 'rgba(0,0,0,0.38)',
                            }}
                          >
                            {new Date(message.createdAt).toLocaleTimeString('uz-UZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {isOwnMessage ? <span className="ml-1 inline opacity-80">✓</span> : null}
                          </p>
                        </div>
                        <div
                          className={`mt-0.5 flex gap-0.5 ${isOwnMessage ? 'justify-end' : 'justify-start'} px-0.5`}
                        >
                          <button
                            type="button"
                            title="Javob berish"
                            disabled={sending || recordingVoice}
                            onClick={() => setReplyTarget(message)}
                            className="rounded-md p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                            style={{ color: isDark ? 'rgba(255,255,255,0.45)' : '#9ca3af' }}
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          {isOwnMessage ? (
                            <button
                              type="button"
                              title="O‘chirish"
                              disabled={
                                deletingId === String(message.id).trim() || sending || recordingVoice
                              }
                              onClick={() => void handleDeleteMessage(String(message.id))}
                              className="rounded-md p-1 transition-colors hover:bg-red-500/15"
                              style={{ color: '#f87171' }}
                            >
                              {deletingId === String(message.id).trim() ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {showScrollDown ? (
              <button
                type="button"
                onClick={() => {
                  const el = messagesScrollRef.current;
                  if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                }}
                className="absolute bottom-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
                style={{
                  background: isDark ? 'rgba(40,50,64,0.95)' : '#fff',
                  color: accentColor.color,
                  border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.2)',
                }}
                aria-label="Pastga"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickImage}
          />

          <form onSubmit={handleSend} className="flex flex-col gap-1">
            {replyTarget ? (
              <div
                className="flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left"
                style={{
                  borderColor: `${accentColor.color}55`,
                  background: isDark ? 'rgba(255,255,255,0.05)' : `${accentColor.color}10`,
                }}
              >
                <Reply className="h-4 w-4 shrink-0" style={{ color: accentColor.color }} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold" style={{ color: isDark ? '#fff' : '#111827' }}>
                    {replyTarget.senderName}
                  </p>
                  <p
                    className="truncate text-[10px]"
                    style={{ color: isDark ? 'rgba(255,255,255,0.55)' : '#6b7280' }}
                  >
                    {(replyTarget.type || 'text') === 'image'
                      ? replyTarget.content
                        ? `📷 ${replyTarget.content}`
                        : '📷 Rasm'
                      : (replyTarget.type || 'text') === 'voice'
                        ? '🎤 Ovozli xabar'
                        : (replyTarget.type || 'text') === 'location'
                          ? replyTarget.locationLabel || '📍 Joylashuv'
                          : replyTarget.content}
                  </p>
                </div>
                <button
                  type="button"
                  title="Bekor"
                  onClick={() => setReplyTarget(null)}
                  className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10"
                  style={{ color: isDark ? 'rgba(255,255,255,0.6)' : '#6b7280' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            {recordingVoice ? (
              <p className="px-1 text-center text-[11px] font-medium text-red-500">Ovoz yozilmoqda… qayta bosing — tugatish</p>
            ) : null}
            <div className="flex items-end gap-1 sm:gap-1.5">
              <button
                type="button"
                title="Rasm"
                disabled={sending || recordingVoice}
                onClick={() => imageInputRef.current?.click()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-opacity disabled:opacity-40 active:scale-[0.96]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                  color: isDark ? 'rgba(255,255,255,0.85)' : '#374151',
                }}
              >
                <Paperclip className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                title="Joylashuv"
                disabled={sending || recordingVoice}
                onClick={sendCurrentLocation}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-opacity disabled:opacity-40 active:scale-[0.96]"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                  color: accentColor.color,
                }}
              >
                <MapPin className="h-[18px] w-[18px]" />
              </button>
              <div className="min-w-0 flex-1">
                <textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={handleDraftKeyDown}
                  placeholder="Xabar…"
                  rows={1}
                  maxLength={1000}
                  className="max-h-28 min-h-[40px] w-full resize-y rounded-2xl border px-3 py-2 text-[13px] leading-snug outline-none transition-colors"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.07)' : '#ffffff',
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
                    color: isDark ? '#fff' : '#111827',
                  }}
                />
              </div>
              <button
                type="button"
                title={recordingVoice ? 'To‘xtatish' : 'Ovoz'}
                disabled={sending && !recordingVoice}
                onClick={() => void toggleVoiceRecording()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-opacity disabled:opacity-40 active:scale-[0.96]"
                style={{
                  background: recordingVoice ? 'rgba(239,68,68,0.25)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
                  color: recordingVoice ? '#ef4444' : isDark ? 'rgba(255,255,255,0.85)' : '#374151',
                }}
              >
                {recordingVoice ? <Square className="h-3.5 w-3.5 fill-current" /> : <Mic className="h-[18px] w-[18px]" />}
              </button>
              <button
                type="submit"
                disabled={sending || !draft.trim() || recordingVoice}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-transform disabled:opacity-45 active:scale-[0.96]"
                style={{ backgroundImage: accentColor.gradient, boxShadow: `0 6px 16px ${accentColor.color}35` }}
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-dvh flex-col overflow-hidden app-safe-pb"
      style={{ background: isDark ? '#000' : '#f8fafc' }}
    >
      <div className="app-safe-pt shrink-0">{renderTopBar()}</div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {renderSidebar()}
        {mainContent}
      </div>
    </div>
  );
}
