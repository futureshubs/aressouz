import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Loader2, MessageCircle, Paperclip, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { projectId } from '../../../utils/supabase/info';
import { buildUserHeaders } from '../utils/requestAuth';
import { compressImageIfNeeded } from '../utils/uploadWithProgress';
import { useVisibilityTick } from '../utils/visibilityRefetch';

type UserBranchChatMode = 'split' | 'single';

/** Server bilan mos: `userChatsHandler` dagi USER_SUPPORT_BRANCH_ID */
const USER_SUPPORT_BRANCH_ID = 'aresso_support';

function userChatListTitle(branchId: string) {
  return branchId === USER_SUPPORT_BRANCH_ID ? 'Aresso support' : `Filial: ${branchId}`;
}

function userChatHeaderTitle(branchId: string) {
  return branchId === USER_SUPPORT_BRANCH_ID ? 'Aresso support' : branchId;
}

type ChatSummary = {
  id: string;
  branchId: string;
  participantName: string;
  lastMessage?: { content: string; timestamp: string; senderName: string; isOwn: boolean };
  updatedAt?: string;
  createdAt?: string;
};

type Message = {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: string;
  imageCaption?: string;
  timestamp: string;
  status: string;
  isOwn: boolean;
};

export interface UserBranchChatProps {
  /** split: list + chat yonma-yon (Profile). single: list -> chat (modal UX). */
  mode?: UserBranchChatMode;
  /** Support modal: ro‘yxatsiz, darhol Aresso support chat */
  embedTarget?: 'default' | 'support';
}

export function UserBranchChat({ mode = 'split', embedTarget = 'default' }: UserBranchChatProps) {
  const { theme, accentColor } = useTheme();
  const { isAuthenticated, setIsAuthOpen } = useAuth();
  const isDark = theme === 'dark';

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [singleView, setSingleView] = useState<'list' | 'chat'>('list');
  const visibilityRefetchTick = useVisibilityTick();

  const baseUrl = useMemo(
    () => `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c`,
    []
  );

  const loadChats = async () => {
    try {
      setLoading(true);
      const resp = await fetch(`${baseUrl}/user/chats`, {
        headers: buildUserHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        toast.error(data?.error || 'Suhbatlarni yuklashda xatolik');
        setChats([]);
        return;
      }
      const list: ChatSummary[] = Array.isArray(data.chats) ? data.chats : [];
      setChats(list);
      if (mode === 'single' && embedTarget === 'support' && list.length > 0) {
        const support = list.find(c => c.branchId === USER_SUPPORT_BRANCH_ID) || list[0];
        setSelectedChat(support);
        setSingleView('chat');
      }
    } catch (e) {
      console.error('UserBranchChat loadChats error:', e);
      toast.error('Suhbatlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (chatId: string) => {
    try {
      const resp = await fetch(`${baseUrl}/user/chats/${encodeURIComponent(chatId)}/messages`, {
        headers: buildUserHeaders({ 'Content-Type': 'application/json' }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        toast.error(data?.error || 'Xabarlarni yuklashda xatolik');
        setMessages([]);
        return;
      }
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (e) {
      console.error('UserBranchChat loadMessages error:', e);
      toast.error('Xabarlarni yuklashda xatolik');
    }
  };

  useEffect(() => {
    if (embedTarget === 'support' && !isAuthenticated) {
      setLoading(false);
      setChats([]);
      setSelectedChat(null);
      return;
    }
    loadChats();
  }, [visibilityRefetchTick, embedTarget, isAuthenticated]);

  // Chats yuklangach avtomatik ravishda birinchi chatni tanlab qo'yamiz
  // (UI: "Chat tanlang" bo'lib turib qolmasin, o'ng panel darhol ochilsin)
  useEffect(() => {
    if (mode !== 'split') return;
    if (!chats.length) return;
    if (selectedChat && chats.some((c) => c.id === selectedChat.id)) return;
    setSelectedChat(chats[0]);
  }, [chats, selectedChat?.id]);

  useEffect(() => {
    if (!selectedChat) return;
    loadMessages(selectedChat.id);
    const t = setInterval(() => loadMessages(selectedChat.id), 3500);
    return () => clearInterval(t);
  }, [selectedChat?.id, visibilityRefetchTick]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async () => {
    if (!selectedChat || !input.trim()) return;
    const content = input.trim();
    setInput('');

    try {
      const optimistic: Message = {
        id: `tmp_${Date.now()}`,
        chatId: selectedChat.id,
        senderId: 'me',
        senderName: 'Siz',
        content,
        type: 'text',
        timestamp: new Date().toISOString(),
        status: 'sent',
        isOwn: true,
      };
      setMessages(prev => [...prev, optimistic]);

      const resp = await fetch(`${baseUrl}/user/chats/${encodeURIComponent(selectedChat.id)}/messages`, {
        method: 'POST',
        headers: buildUserHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ content, type: 'text' }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        toast.error(data?.error || 'Xabar yuborilmadi');
        await loadMessages(selectedChat.id);
        return;
      }
      await loadMessages(selectedChat.id);
      await loadChats();
    } catch (e) {
      console.error('UserBranchChat sendMessage error:', e);
      toast.error('Xabar yuborishda xatolik');
      await loadMessages(selectedChat.id);
    }
  };

  const handlePickImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedChat || uploadingImage) return;

    setUploadingImage(true);
    try {
      const compressed = await compressImageIfNeeded(file, { maxSide: 2048, quality: 0.85, minBytes: 400_000 });
      const fd = new FormData();
      fd.append('file', compressed);
      const up = await fetch(`${baseUrl}/user/chats/upload-media`, {
        method: 'POST',
        headers: buildUserHeaders(),
        body: fd,
      });
      const upData = await up.json().catch(() => ({}));
      if (!up.ok || !upData?.success || !upData?.url) {
        toast.error(upData?.error || 'Rasm yuklanmadi');
        return;
      }
      const caption = input.trim();
      setInput('');
      const resp = await fetch(`${baseUrl}/user/chats/${encodeURIComponent(selectedChat.id)}/messages`, {
        method: 'POST',
        headers: buildUserHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          type: 'image',
          content: String(upData.url),
          ...(caption ? { caption } : {}),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        toast.error(data?.error || 'Rasm yuborilmadi');
        return;
      }
      await loadMessages(selectedChat.id);
      await loadChats();
    } catch (e) {
      console.error('UserBranchChat image error:', e);
      toast.error('Rasm yuborishda xatolik');
    } finally {
      setUploadingImage(false);
    }
  };

  const messageBubble = (m: Message) => (
    <div key={m.id} className={`flex ${m.isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[80%] px-3 py-2 rounded-2xl"
        style={{
          background: m.isOwn
            ? accentColor.gradient
            : isDark
              ? 'rgba(255,255,255,0.08)'
              : 'rgba(0,0,0,0.05)',
          color: m.isOwn ? '#fff' : isDark ? '#fff' : '#111827',
        }}
      >
        {m.type === 'image' ? (
          <div>
            <img src={m.content} alt="" className="rounded-xl max-w-full max-h-64 object-cover" loading="lazy" />
            {m.imageCaption ? (
              <div className="text-sm whitespace-pre-wrap mt-1.5 opacity-95">{m.imageCaption}</div>
            ) : null}
          </div>
        ) : (
          <div className="text-sm whitespace-pre-wrap">{m.content}</div>
        )}
      </div>
    </div>
  );

  const composer = (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePickImage}
      />
      <div
        className="p-3 border-t flex items-end gap-2 shrink-0"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
      >
        <button
          type="button"
          title="Rasm"
          disabled={uploadingImage || !selectedChat}
          onClick={() => imageInputRef.current?.click()}
          className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl transition-opacity disabled:opacity-40"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            color: isDark ? '#fff' : '#374151',
          }}
        >
          {uploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
        </button>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          rows={1}
          title="Enter — yuborish, Shift+Enter — yangi qator"
          className="flex-1 min-h-[40px] max-h-28 px-3 py-2 rounded-xl outline-none resize-y text-sm"
          style={{
            background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            color: isDark ? '#fff' : '#111827',
          }}
          placeholder="Xabar yozing…"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          className="px-3 py-2 rounded-xl font-semibold flex items-center gap-2 shrink-0"
          style={{ background: accentColor.gradient, color: '#fff' }}
          disabled={!input.trim() || !selectedChat}
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  if (mode === 'single' && embedTarget === 'support' && !isAuthenticated) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4 p-8 text-center rounded-2xl"
        style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}
      >
        <MessageCircle className="w-10 h-10" style={{ color: accentColor.color }} />
        <p className="text-sm font-medium" style={{ color: isDark ? '#fff' : '#111827' }}>
          Support bilan chat qilish uchun akkauntga kiring.
        </p>
        <button
          type="button"
          onClick={() => setIsAuthOpen(true)}
          className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
          style={{ backgroundImage: accentColor.gradient }}
        >
          Kirish
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}>
        <div className="flex items-center gap-2" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
          <MessageCircle className="w-5 h-5" />
          {embedTarget === 'support' ? 'Support chat ochilmoqda…' : 'Suhbatlar yuklanmoqda...'}
        </div>
      </div>
    );
  }

  const shellStyle = {
    background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    height: '100%',
    minHeight: 0,
  };

  if (mode === 'single' && embedTarget === 'support') {
    if (!selectedChat) {
      return (
        <div className="rounded-2xl border overflow-hidden flex flex-col p-6 text-center" style={shellStyle}>
          <p className="text-sm mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.75)' : '#4b5563' }}>
            Support chatni yuklab bo‘lmadi. Internet yoki sessiyani tekshiring.
          </p>
          <button
            type="button"
            onClick={() => void loadChats()}
            className="mx-auto rounded-xl px-4 py-2 text-sm font-semibold text-white"
            style={{ backgroundImage: accentColor.gradient }}
          >
            Qayta urinish
          </button>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border overflow-hidden flex flex-col h-full min-h-0" style={shellStyle}>
        <div
          className="px-4 py-3 border-b font-bold shrink-0"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', color: isDark ? '#fff' : '#111827' }}
        >
          {userChatHeaderTitle(selectedChat.branchId)}
        </div>
        <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0 overscroll-y-contain">
          {messages.map(messageBubble)}
          <div ref={messagesEndRef} />
        </div>
        {composer}
      </div>
    );
  }

  // Support modal UX (profil): avval filial chatlari ro'yxati, keyin tanlanganda bitta chat (Back bilan).
  if (mode === 'single') {
    return (
      <div className="rounded-2xl border overflow-hidden flex flex-col h-full min-h-0" style={shellStyle}>
        {singleView === 'list' && (
          <>
            <div className="p-4 font-bold shrink-0">Filial chatlari</div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
              {chats.length === 0 ? (
                <div className="p-4" style={{ opacity: 0.7 }}>
                  Hozircha chat yo‘q. Chatlar buyurtmalaringiz bo‘lgan filiallarga chiqadi.
                </div>
              ) : (
                chats.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedChat(c);
                      setSingleView('chat');
                    }}
                    className="w-full text-left p-4 border-t"
                    style={{
                      borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      background: selectedChat?.id === c.id ? `${accentColor.color}14` : 'transparent',
                    }}
                  >
                    <div className="font-semibold">{userChatListTitle(c.branchId)}</div>
                    <div className="text-sm" style={{ opacity: 0.7 }}>
                      {c.lastMessage?.senderName ? `${c.lastMessage.senderName}: ` : ''}
                      {c.lastMessage?.content || 'Suhbat'}
                    </div>
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {singleView === 'chat' && (
          <>
            <div
              className="p-4 border-b font-bold flex items-center gap-3 shrink-0"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
            >
              <button
                onClick={() => {
                  setSingleView('list');
                  setSelectedChat(null);
                }}
                className="p-1 rounded-xl"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: isDark ? '0.5px solid rgba(255,255,255,0.10)' : '0.5px solid rgba(0,0,0,0.08)',
                }}
                aria-label="Back"
              >
                <ArrowLeft className="size-5" style={{ color: isDark ? '#fff' : '#111827' }} />
              </button>
              <span style={{ color: isDark ? '#fff' : '#111827' }}>
                {selectedChat ? userChatHeaderTitle(selectedChat.branchId) : 'Chat'}
              </span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
              {selectedChat ? (
                messages.map(messageBubble)
              ) : (
                <div style={{ opacity: 0.7 }}>Chapdan filial chatini tanlang.</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {selectedChat ? composer : null}
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      style={{ height: '100%', overflow: 'hidden' }}
    >
      <div
        className="lg:col-span-1 rounded-2xl border overflow-hidden flex flex-col"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
        }}
      >
        <div className="p-4 font-bold">Filial chatlari</div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-4" style={{ opacity: 0.7 }}>
              Hozircha chat yo‘q. Chatlar buyurtmalaringiz bo‘lgan filiallarga chiqadi.
            </div>
          ) : (
            chats.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedChat(c)}
                className="w-full text-left p-4 border-t"
                style={{
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                  background: selectedChat?.id === c.id ? `${accentColor.color}14` : 'transparent',
                }}
              >
                <div className="font-semibold">{userChatListTitle(c.branchId)}</div>
                <div className="text-sm" style={{ opacity: 0.7 }}>
                  {c.lastMessage?.senderName ? `${c.lastMessage.senderName}: ` : ''}
                  {c.lastMessage?.content || 'Suhbat'}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="lg:col-span-2 rounded-2xl border overflow-hidden flex flex-col"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          minHeight: 0,
          height: '100%',
        }}
      >
        <div className="p-4 border-b font-bold"
          style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
        >
          {selectedChat ? userChatHeaderTitle(selectedChat.branchId) : 'Chat tanlang'}
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
          {selectedChat ? (
            messages.map(messageBubble)
          ) : (
            <div style={{ opacity: 0.7 }}>Chapdan filial chatini tanlang.</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedChat ? composer : null}
      </div>
    </div>
  );
}

