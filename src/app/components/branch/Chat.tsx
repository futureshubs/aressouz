import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { 
  MessageCircle, 
  Send, 
  Search, 
  Filter, 
  Phone, 
  Video, 
  MoreVertical, 
  Check, 
  CheckCheck, 
  Clock,
  User,
  Bot,
  AlertCircle,
  Smile,
  Paperclip,
  Image,
  File,
  Archive,
  Trash2,
  Star,
  Users,
  Settings,
  RefreshCw,
  X,
  Plus,
  Circle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '../../../../utils/supabase/info';
import { buildBranchHeaders } from '../../utils/requestAuth';
import { useVisibilityTick } from '../../utils/visibilityRefetch';
import { useChatPoll } from '../../hooks/useChatPoll';
import {
  isPlatformSupportChat,
  formatChatPreview,
  formatChatTime,
} from '../../utils/chatIntegration';
import {
  chatImageFallbackLabel,
  isChatImageMessage,
} from '../../utils/chatMessageDisplay';

interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  imageCaption?: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  isOwn: boolean;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  }>;
}

interface Chat {
  id: string;
  branchId: string;
  participantId: string;
  participantName: string;
  participantPhone?: string;
  participantAvatar?: string;
  participantType: 'customer' | 'courier' | 'employee' | 'system';
  lastMessage: {
    content: string;
    timestamp: string;
    senderName: string;
    isOwn: boolean;
  };
  unreadCount: number;
  isOnline: boolean;
  isTyping: boolean;
  isArchived: boolean;
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ChatProps {
  branchId: string;
  /** Support panel: `aresso_support` — widget xabarlari */
  chatBranchId?: string;
  panelLabel?: string;
  branchInfo?: {
    region?: string;
    district?: string;
    phone?: string;
  };
}

export function Chat({ branchId, chatBranchId, panelLabel, branchInfo }: ChatProps) {
  const effectiveBranchId = (chatBranchId || branchId).trim();
  const isSupportPanel = isPlatformSupportChat(effectiveBranchId);
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [filter, setFilter] = useState('all'); // all, unread, starred, archived
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesLoadSeqRef = useRef(0);
  const visibilityRefetchTick = useVisibilityTick();

  const loadChats = async () => {
    try {
      setIsLoading(true);
      console.log('💬 Loading chats for branch:', effectiveBranchId);

      const params = new URLSearchParams({
        branchId: effectiveBranchId,
        search: searchTerm,
        filter: filter,
      });

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/chats?${params}`,
        {
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        }
      );

      if (!response.ok) {
        setChats([]);
        console.error('❌ Chats API response not ok:', response.status, response.statusText);
        toast.error('Suhbatlarni yuklashda xatolik');
        return;
      }

      const data = await response.json();
      if (data.success) {
        setChats(data.chats);
        console.log('✅ Chats loaded from API');
      }
    } catch (error) {
      console.error('❌ Error loading chats:', error);
      toast.error('Suhbatlarni yuklashda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async (chatId: string, options?: { silent?: boolean }) => {
    const reqId = ++messagesLoadSeqRef.current;
    const isLatest = () => reqId === messagesLoadSeqRef.current;
    if (!options?.silent) setMessagesLoading(true);
    try {
      console.log('📨 Loading messages for chat:', chatId);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/chats/${encodeURIComponent(chatId)}/messages`,
        {
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
        }
      );

      if (!response.ok) {
        if (isLatest()) {
          setMessages([]);
          console.error('❌ Messages API response not ok:', response.status, response.statusText);
          toast.error('Xabarlarni yuklashda xatolik');
        }
        return;
      }

      const data = await response.json();
      if (!isLatest()) return;
      if (data.success) {
        const rows = Array.isArray(data.messages) ? data.messages : [];
        setMessages(
          rows.map((m: Message) => ({
            ...m,
            type:
              m.type === 'image' || /^https?:\/\//i.test(String(m.content || '').trim())
                ? 'image'
                : 'text',
            isOwn: String(m.senderId || '') === 'branch',
          })),
        );
        console.log('✅ Messages loaded from API', rows.length);
      } else {
        setMessages([]);
      }
    } catch (error) {
      if (isLatest()) {
        console.error('❌ Error loading messages:', error);
        toast.error('Xabarlarni yuklashda xatolik');
      }
    } finally {
      if (isLatest()) setMessagesLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, [effectiveBranchId, searchTerm, filter, visibilityRefetchTick]);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      setMessagesLoading(false);
    } else {
      setMessages([]);
    }
  }, [selectedChat?.id]);

  useChatPoll(selectedChat?.id, loadMessages, undefined, Boolean(selectedChat));

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedChat) return;

    const optimisticId = `tmp_${Date.now()}`;
    const content = messageInput.trim();
    const senderName = isSupportPanel ? 'Aresso support' : 'Filial';

    const newMessage: Message = {
      id: optimisticId,
      chatId: selectedChat.id,
      senderId: 'branch',
      senderName,
      content,
      type: 'text',
      timestamp: new Date().toISOString(),
      status: 'sent',
      isOwn: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setMessageInput('');

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/chats/${encodeURIComponent(selectedChat.id)}/messages`,
        {
          method: 'POST',
          headers: buildBranchHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ content, type: 'text', senderName }),
        },
      );

      if (!response.ok) {
        throw new Error('Xabarni yuborishda xatolik');
      }

      await loadMessages(selectedChat.id, { silent: true });
      await loadChats();
    } catch (error) {
      console.error('❌ Error sending message:', error);
      toast.error('Xabarni yuborishda xatolik');
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === optimisticId ? { ...msg, status: 'failed' as const } : msg,
        ),
      );
    }
  };

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    if (chat.unreadCount > 0) {
      setChats(prev => prev.map(c =>
        c.id === chat.id ? { ...c, unreadCount: 0 } : c
      ));
      fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/chats/${encodeURIComponent(chat.id)}/read`,
        { method: 'PUT', headers: buildBranchHeaders() },
      ).catch(() => {});
    }
  };


  const handleStarChat = async (chatId: string) => {
    try {
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, isStarred: !chat.isStarred }
          : chat
      ));

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/chats/${chatId}/star`,
        {
          method: 'PUT',
          headers: buildBranchHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Suhbatni yulduzcha qo\'yishda xatolik');
      }

      console.log('✅ Chat starred successfully');
    } catch (error) {
      console.error('❌ Error starring chat:', error);
      // Revert on error
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, isStarred: !chat.isStarred }
          : chat
      ));
    }
  };

  const handleArchiveChat = async (chatId: string) => {
    try {
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, isArchived: !chat.isArchived }
          : chat
      ));

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/chats/${chatId}/archive`,
        {
          method: 'PUT',
          headers: buildBranchHeaders(),
        }
      );

      if (!response.ok) {
        throw new Error('Suhbatni arxivlashda xatolik');
      }

      console.log('✅ Chat archived successfully');
    } catch (error) {
      console.error('❌ Error archiving chat:', error);
      // Revert on error
      setChats(prev => prev.map(chat => 
        chat.id === chatId 
          ? { ...chat, isArchived: !chat.isArchived }
          : chat
      ));
    }
  };

  const formatTime = formatChatTime;

  const getParticipantIcon = (type: string) => {
    switch (type) {
      case 'customer': return User;
      case 'courier': return MessageCircle;
      case 'employee': return Users;
      case 'system': return Bot;
      default: return User;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return Check;
      case 'delivered': return CheckCheck;
      case 'read': return CheckCheck;
      case 'failed': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return '#6b7280';
      case 'delivered': return '#3b82f6';
      case 'read': return '#10b981';
      case 'failed': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" aria-hidden>
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: accentColor.color }} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] flex">
      {/* Chat List */}
      <div 
        className="w-80 border-r flex flex-col"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Header */}
        <div className="p-4 border-b"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
          }}
        >
          <h2 className="text-xl font-bold mb-1">{panelLabel || 'Suhbatlar'}</h2>
          {isSupportPanel && (
            <p className="text-xs mb-3" style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}>
              Sayt widgetidagi mijoz xabarlari
            </p>
          )}
          
          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }} />
            <input
              type="text"
              placeholder="Suhbatlarni qidirish..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border outline-none text-sm"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              }}
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === 'all' ? 'text-white' : ''
              }`}
              style={{
                background: filter === 'all' ? accentColor.gradient : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'),
              }}
            >
              Barchasi
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === 'unread' ? 'text-white' : ''
              }`}
              style={{
                background: filter === 'unread' ? accentColor.gradient : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'),
              }}
            >
              O'qilmagan
            </button>
            <button
              onClick={() => setFilter('starred')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                filter === 'starred' ? 'text-white' : ''
              }`}
              style={{
                background: filter === 'starred' ? accentColor.gradient : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)'),
              }}
            >
              Yulduzcha
            </button>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => {
            const ParticipantIcon = getParticipantIcon(chat.participantType);
            
            return (
              <div
                key={chat.id}
                onClick={() => handleSelectChat(chat)}
                className={`p-4 border-b cursor-pointer transition-all hover:shadow-md ${
                  selectedChat?.id === chat.id ? '' : ''
                }`}
                style={{
                  background: selectedChat?.id === chat.id 
                    ? `${accentColor.color}10`
                    : 'transparent',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ 
                        background: accentColor.gradient,
                        color: '#ffffff'
                      }}
                    >
                      {chat.participantName[0]}
                    </div>
                    {chat.isOnline && (
                      <div 
                        className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
                        style={{
                          background: '#10b981',
                          borderColor: isDark ? '#1a1a1a' : '#ffffff'
                        }}
                      />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <ParticipantIcon className="w-4 h-4" style={{ color: accentColor.color }} />
                        <h3 className="font-semibold truncate">{chat.participantName}</h3>
                      </div>
                      <span className="text-xs" style={{ 
                        color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' 
                      }}>
                        {formatTime(chat.lastMessage.timestamp)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm truncate" style={{ 
                        color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' 
                      }}>
                        {chat.lastMessage.senderName}: {formatChatPreview(
                          chat.lastMessage.content,
                          chat.lastMessage.content.startsWith('📷') ? 'image' : 'text',
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        {chat.isStarred && <Star className="w-3 h-3 text-yellow-500" />}
                        {chat.unreadCount > 0 && (
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"
                            style={{ background: accentColor.color }}
                          >
                            {chat.unreadCount}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div 
            className="p-4 border-b flex items-center justify-between"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
                  style={{ 
                    background: accentColor.gradient,
                    color: '#ffffff'
                  }}
                >
                  {selectedChat.participantName[0]}
                </div>
                {selectedChat.isOnline && (
                  <div 
                    className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                    style={{
                      background: '#10b981',
                      borderColor: isDark ? '#1a1a1a' : '#ffffff'
                    }}
                  />
                )}
              </div>
              <div>
                <h3 className="font-semibold">{selectedChat.participantName}</h3>
                <p className="text-xs" style={{ 
                  color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' 
                }}>
                  {selectedChat.participantPhone || 'Telefon yo‘q'}
                  {selectedChat.isOnline ? ' • Onlayn' : ' • Oflayn'}
                  {selectedChat.isTyping && ' • Yozmoqda...'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleStarChat(selectedChat.id)}
                className="p-2 rounded-lg hover:bg-opacity-10 transition-all"
                style={{ color: selectedChat.isStarred ? '#f59e0b' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)') }}
              >
                <Star className="w-5 h-5" />
              </button>
              <button
                onClick={() => handleArchiveChat(selectedChat.id)}
                className="p-2 rounded-lg hover:bg-opacity-10 transition-all"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                <Archive className="w-5 h-5" />
              </button>
              <button className="p-2 rounded-lg hover:bg-opacity-10 transition-all"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 relative min-h-[200px]">
            {messagesLoading ? (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10"
                style={{
                  background: isDark ? 'rgba(26,26,26,0.75)' : 'rgba(255,255,255,0.85)',
                }}
              >
                <Loader2
                  className="w-8 h-8 animate-spin"
                  style={{ color: accentColor.color }}
                  aria-hidden
                />
              </div>
            ) : null}
            {!messagesLoading && messages.length === 0 ? (
              <p
                className="text-center text-sm py-8"
                style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }}
              >
                Hali xabar yo‘q. Mijoz support widget orqali yozsa, shu yerda ko‘rinadi.
              </p>
            ) : null}
            {messages.map((message) => {
              const StatusIcon = getStatusIcon(message.status);
              
              return (
                <div
                  key={message.id}
                  className={`flex ${message.isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-xs lg:max-w-md ${
                    message.isOwn ? 'order-1' : 'order-2'
                  }`}>
                    {!message.isOwn && (
                      <p className="text-xs mb-1" style={{ 
                        color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' 
                      }}>
                        {message.senderName}
                      </p>
                    )}
                    <div 
                      className={`px-4 py-2 rounded-2xl ${
                        message.isOwn 
                          ? 'rounded-br-sm' 
                          : 'rounded-bl-sm'
                      }`}
                      style={{
                        ...(message.isOwn
                          ? {
                              backgroundColor: accentColor.color,
                              backgroundImage: accentColor.gradient,
                            }
                          : {
                              background: isDark
                                ? 'rgba(255, 255, 255, 0.12)'
                                : 'rgba(0, 0, 0, 0.06)',
                            }),
                        color: message.isOwn ? '#ffffff' : (isDark ? '#f3f4f6' : '#111827'),
                      }}
                    >
                      {isChatImageMessage(message.type, message.content) ? (
                        <div>
                          <a
                            href={message.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block"
                          >
                            <img
                              src={message.content}
                              alt={message.imageCaption || 'Rasm'}
                              className="max-w-full max-h-72 rounded-xl object-cover min-h-[80px] bg-black/10"
                              loading="lazy"
                              onError={(e) => {
                                const el = e.currentTarget;
                                el.style.display = 'none';
                              }}
                            />
                          </a>
                          <p className="text-sm mt-1.5 whitespace-pre-wrap break-words">
                            {chatImageFallbackLabel(message.isOwn, message.imageCaption)}
                          </p>
                          {message.content ? (
                            <p className="text-xs mt-1 opacity-80 underline break-all">
                              Havolani ochish
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content?.trim() || '—'}
                        </p>
                      )}
                    </div>
                    <div className={`flex items-center gap-1 mt-1 text-xs ${
                      message.isOwn ? 'justify-end' : 'justify-start'
                    }`} style={{ 
                      color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' 
                    }}>
                      <span>{formatTime(message.timestamp)}</span>
                      {message.isOwn && (
                        <StatusIcon 
                          className="w-3 h-3" 
                          style={{ color: getStatusColor(message.status) }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div 
            className="p-4 border-t"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.8)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            }}
          >
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-lg hover:bg-opacity-10 transition-all"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                ref={inputRef}
                type="text"
                placeholder="Xabar yozing..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 px-4 py-2 rounded-xl border outline-none"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                }}
              />
              <button className="p-2 rounded-lg hover:bg-opacity-10 transition-all"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim()}
                className="p-2 rounded-xl transition-all"
                style={{
                  background: messageInput.trim() ? accentColor.gradient : 'transparent',
                  color: messageInput.trim() ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)')
                }}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MessageCircle className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor.color }} />
            <h3 className="text-xl font-bold mb-2">Suhbat tanlang</h3>
            <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
              Suhbatni boshlash uchun chap tomondan suhbatni tanlang
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
