import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, MessageCircle, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from '../context/ThemeContext';
import { projectId } from '../../../utils/supabase/info';
import { buildUserHeaders } from '../utils/requestAuth';
import { useVisibilityTick } from '../utils/visibilityRefetch';

type UserBranchChatMode = 'split' | 'single';

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
  timestamp: string;
  status: string;
  isOwn: boolean;
};

export interface UserBranchChatProps {
  /** split: list + chat yonma-yon (Profile). single: list -> chat (modal UX). */
  mode?: UserBranchChatMode;
}

export function UserBranchChat({ mode = 'split' }: UserBranchChatProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSummary | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
      setChats(Array.isArray(data.chats) ? data.chats : []);
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
    loadChats();
  }, [visibilityRefetchTick]);

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
      setMessages((prev) => [...prev, optimistic]);

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

  if (loading) {
    return (
      <div className="p-6 rounded-2xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#fff' }}>
        <div className="flex items-center gap-2" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
          <MessageCircle className="w-5 h-5" />
          Suhbatlar yuklanmoqda...
        </div>
      </div>
    );
  }

  // Support modal UX: avval filial chatlari ro'yxati, keyin tanlanganda bitta chat (Back bilan).
  if (mode === 'single') {
    return (
      <div
        className="rounded-2xl border overflow-hidden flex flex-col"
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          height: '100%',
          minHeight: 0,
        }}
      >
        {singleView === 'list' && (
          <>
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
                    <div className="font-semibold">Filial: {c.branchId}</div>
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
              className="p-4 border-b font-bold flex items-center gap-3"
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
              <span>{selectedChat ? `Chat: ${selectedChat.branchId}` : 'Chat'}</span>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
              {selectedChat ? (
                messages.map((m) => (
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
                        <img src={m.content} className="rounded-xl max-w-full" />
                      ) : (
                        <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ opacity: 0.7 }}>Chapdan filial chatini tanlang.</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {selectedChat && (
              <div
                className="p-3 border-t flex items-center gap-2"
                style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendMessage();
                  }}
                  className="flex-1 px-3 py-2 rounded-xl outline-none"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: isDark ? '#fff' : '#111827',
                  }}
                  placeholder="Xabar yozing..."
                />
                <button
                  onClick={sendMessage}
                  className="px-4 py-2 rounded-xl font-semibold flex items-center gap-2"
                  style={{ background: accentColor.gradient, color: '#fff' }}
                  disabled={!input.trim()}
                >
                  <Send className="w-4 h-4" />
                  Yuborish
                </button>
              </div>
            )}
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
                <div className="font-semibold">Filial: {c.branchId}</div>
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
          {selectedChat ? `Chat: ${selectedChat.branchId}` : 'Chat tanlang'}
        </div>

        <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
          {selectedChat ? (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[80%] px-3 py-2 rounded-2xl"
                  style={{
                    background: m.isOwn ? accentColor.gradient : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                    color: m.isOwn ? '#fff' : (isDark ? '#fff' : '#111827'),
                  }}
                >
                  {m.type === 'image' ? (
                    <img src={m.content} className="rounded-xl max-w-full" />
                  ) : (
                    <div className="text-sm whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div style={{ opacity: 0.7 }}>Chapdan filial chatini tanlang.</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedChat && (
          <div className="p-3 border-t flex items-center gap-2"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendMessage();
              }}
              className="flex-1 px-3 py-2 rounded-xl outline-none"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                color: isDark ? '#fff' : '#111827',
              }}
              placeholder="Xabar yozing..."
            />
            <button
              onClick={sendMessage}
              className="px-4 py-2 rounded-xl font-semibold flex items-center gap-2"
              style={{ background: accentColor.gradient, color: '#fff' }}
              disabled={!input.trim()}
            >
              <Send className="w-4 h-4" />
              Yuborish
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

