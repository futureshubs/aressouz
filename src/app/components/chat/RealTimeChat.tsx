import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Paperclip, Smile, Mic, Phone, Video, MoreVertical, Reply, Edit, Trash2, Copy, Share, Flag, Heart, ThumbsUp, Laugh, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';

export interface WebSocketMessage {
  type: 'message' | 'typing' | 'user_status' | 'room_update' | 'system';
  data: any;
  timestamp: Date;
  userId: string;
  roomId?: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'location' | 'voice' | 'video' | 'system';
  
  // Media attachments
  attachments?: Array<{
    type: 'image' | 'file' | 'video' | 'audio' | 'voice';
    url: string;
    name: string;
    size?: number;
    duration?: number;
    thumbnail?: string;
    metadata?: Record<string, any>;
  }>;
  
  // Location data
  location?: {
    name: string;
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  
  // Timestamps
  timestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  
  // Engagement
  reactions: Array<{
    emoji: string;
    userId: string;
    username: string;
    timestamp: Date;
  }>;
  replies: number;
  forwards: number;
  mentions: Array<{
    userId: string;
    username: string;
    type: 'user' | 'all' | 'here';
  }>;
  
  // Reply chain
  replyTo?: {
    messageId: string;
    content: string;
    senderName: string;
    type: string;
  };
  
  // Moderation
  isReported: boolean;
  reportReason?: string;
  isHidden: boolean;
  moderatedBy?: string;
  moderatedAt?: Date;
  
  // Status
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed' | 'deleted';
  
  // Metadata
  isEdited: boolean;
  isDeleted: boolean;
  isForwarded: boolean;
  isPinned: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

export interface TypingUser {
  userId: string;
  username: string;
  timestamp: Date;
  isTyping: boolean;
}

export interface OnlineUser {
  userId: string;
  username: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'invisible';
  lastSeen: Date;
  isTyping: boolean;
  customStatus?: string;
}

export interface ChatRoomState {
  id: string;
  name: string;
  members: OnlineUser[];
  typingUsers: TypingUser[];
  messages: ChatMessage[];
  unreadCount: number;
  lastMessage?: ChatMessage;
  isOnline: boolean;
  isConnected: boolean;
  typingTimeouts: Map<string, NodeJS.Timeout>;
}

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

const mockMessages: ChatMessage[] = [
  {
    id: 'msg_1',
    roomId: 'room_toshkent',
    senderId: 'user_1',
    senderName: 'Ali Karimov',
    senderAvatar: '/avatars/ali.jpg',
    content: 'Assalomu alaykum Toshkent do\'stlari! Qalay qalaysizlar?',
    type: 'text',
    timestamp: new Date('2025-03-19T14:30:00'),
    reactions: [
      { emoji: '👍', userId: 'user_2', username: 'John Doe', timestamp: new Date('2025-03-19T14:31:00') },
      { emoji: '😊', userId: 'user_3', username: 'Sarah Smith', timestamp: new Date('2025-03-19T14:32:00') }
    ],
    replies: 2,
    forwards: 0,
    mentions: [],
    status: 'read',
    isEdited: false,
    isDeleted: false,
    isForwarded: false,
    isPinned: false,
    priority: 'normal',
    isReported: false,
    isHidden: false
  },
  {
    id: 'msg_2',
    roomId: 'room_toshkent',
    senderId: 'user_2',
    senderName: 'John Doe',
    senderAvatar: '/avatars/john.jpg',
    content: 'Yaxshimisiz, rahmat! Sizlarni qanday qalaysizlar?',
    type: 'text',
    timestamp: new Date('2025-03-19T14:31:00'),
    replyTo: {
      messageId: 'msg_1',
      content: 'Assalomu alaykum Toshkent do\'stlari! Qalay qalaysizlar?',
      senderName: 'Ali Karimov',
      type: 'text'
    },
    reactions: [
      { emoji: '👋', userId: 'user_1', username: 'Ali Karimov', timestamp: new Date('2025-03-19T14:32:00') }
    ],
    replies: 1,
    forwards: 0,
    mentions: [],
    status: 'read',
    isEdited: false,
    isDeleted: false,
    isForwarded: false,
    isPinned: false,
    priority: 'normal',
    isReported: false,
    isHidden: false
  },
  {
    id: 'msg_3',
    roomId: 'room_toshkent',
    senderId: 'user_3',
    senderName: 'Sarah Smith',
    senderAvatar: '/avatars/sarah.jpg',
    content: 'Bugun ob-havo juda yaxshi! Tashqariga chiqishni reja qilyapsizmi?',
    type: 'text',
    timestamp: new Date('2025-03-19T14:32:00'),
    reactions: [],
    replies: 0,
    forwards: 0,
    mentions: [],
    status: 'delivered',
    isEdited: false,
    isDeleted: false,
    isForwarded: false,
    isPinned: false,
    priority: 'normal',
    isReported: false,
    isHidden: false
  }
];

export function useRealTimeChat() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('disconnected');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [rooms, setRooms] = useState<Map<string, ChatRoomState>>(new Map());
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<Map<string, OnlineUser>>(new Map());
  
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // WebSocket configuration
  const config: WebSocketConfig = {
    url: 'ws://localhost:8080/chat',
    protocols: ['chat-protocol'],
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  };

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      const websocket = new WebSocket(config.url, config.protocols);
      
      websocket.onopen = () => {
        setConnectionStatus('connected');
        setReconnectAttempts(0);
        setWs(websocket);
        
        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
              type: 'heartbeat',
              timestamp: new Date()
            }));
          }
        }, config.heartbeatInterval || 30000);
        
        // Send initial authentication
        websocket.send(JSON.stringify({
          type: 'auth',
          data: {
            token: localStorage.getItem('chat_auth_token'),
            userId: 'current_user_id'
          },
          timestamp: new Date()
        }));
        
        toast.success('Chatga ulandi');
      };

      websocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      websocket.onclose = (event) => {
        setConnectionStatus('disconnected');
        setWs(null);
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        // Attempt reconnection
        if (event.code !== 1000 && reconnectAttempts < (config.maxReconnectAttempts || 5)) {
          setConnectionStatus('reconnecting');
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, config.reconnectInterval || 3000);
        } else {
          toast.error('Chatdan uzildi. Qayta ulanishga harakat qiling.');
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Chat xatosi yuz berdi');
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionStatus('disconnected');
      toast.error('Chatga ulanib bo\'lmadi');
    }
  }, [ws, reconnectAttempts, config]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'message':
        handleNewMessage(message.data);
        break;
      case 'typing':
        handleTypingIndicator(message.data);
        break;
      case 'user_status':
        handleUserStatusUpdate(message.data);
        break;
      case 'room_update':
        handleRoomUpdate(message.data);
        break;
      case 'system':
        handleSystemMessage(message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }, []);

  // Handle new message
  const handleNewMessage = useCallback((messageData: ChatMessage) => {
    const { roomId } = messageData;
    
    setRooms(prev => {
      const room = prev.get(roomId);
      if (!room) return prev;
      
      const updatedRoom = {
        ...room,
        messages: [...room.messages, messageData],
        lastMessage: messageData,
        unreadCount: roomId === currentRoomId ? 0 : room.unreadCount + 1
      };
      
      return new Map(prev).set(roomId, updatedRoom);
    });

    // Play notification sound if not in current room
    if (roomId !== currentRoomId) {
      playNotificationSound();
    }
  }, [currentRoomId]);

  // Handle typing indicator
  const handleTypingIndicator = useCallback((typingData: TypingUser) => {
    const { userId, username, isTyping, timestamp } = typingData;
    
    if (isTyping) {
      setTypingUsers(prev => new Map(prev).set(userId, typingData));
      
      // Clear existing timeout
      if (typingTimeoutsRef.current.has(userId)) {
        clearTimeout(typingTimeoutsRef.current.get(userId)!);
      }
      
      // Set new timeout to remove typing indicator
      typingTimeoutsRef.current.set(userId, setTimeout(() => {
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.delete(userId);
          return newMap;
        });
        typingTimeoutsRef.current.delete(userId);
      }, 3000));
    } else {
      setTypingUsers(prev => {
        const newMap = new Map(prev);
        newMap.delete(userId);
        return newMap;
      });
      
      if (typingTimeoutsRef.current.has(userId)) {
        clearTimeout(typingTimeoutsRef.current.get(userId)!);
        typingTimeoutsRef.current.delete(userId);
      }
    }
  }, []);

  // Handle user status update
  const handleUserStatusUpdate = useCallback((statusData: OnlineUser) => {
    const { userId, status, lastSeen, customStatus } = statusData;
    
    setOnlineUsers(prev => {
      const newMap = new Map(prev);
      if (status === 'offline') {
        newMap.delete(userId);
      } else {
        newMap.set(userId, statusData);
      }
      return newMap;
    });
  }, []);

  // Handle room update
  const handleRoomUpdate = useCallback((roomData: any) => {
    const { roomId, type, data } = roomData;
    
    setRooms(prev => {
      const room = prev.get(roomId);
      if (!room) return prev;
      
      switch (type) {
        case 'member_joined':
          return new Map(prev).set(roomId, {
            ...room,
            members: [...room.members, data.user]
          });
        case 'member_left':
          return new Map(prev).set(roomId, {
            ...room,
            members: room.members.filter(m => m.userId !== data.userId)
          });
        case 'room_updated':
          return new Map(prev).set(roomId, {
            ...room,
            ...data
          });
        default:
          return prev;
      }
    });
  }, []);

  // Handle system message
  const handleSystemMessage = useCallback((systemData: any) => {
    const { type, message, roomId } = systemData;
    
    if (type === 'info') {
      toast.info(message);
    } else if (type === 'warning') {
      toast.warning(message);
    } else if (type === 'error') {
      toast.error(message);
    }
  }, []);

  // Send message
  const sendMessage = useCallback(async (roomId: string, content: string, type: ChatMessage['type'] = 'text', attachments?: any[], replyTo?: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Chatga ulanmagan. Qayta urinib ko\'ring.');
      return null;
    }

    const message: Partial<ChatMessage> = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      roomId,
      senderId: 'current_user_id',
      senderName: 'Current User',
      content,
      type,
      attachments,
      replyTo: replyTo ? mockMessages.find(m => m.id === replyTo) : undefined,
      timestamp: new Date(),
      status: 'sending',
      reactions: [],
      replies: 0,
      forwards: 0,
      mentions: [],
      isEdited: false,
      isDeleted: false,
      isForwarded: false,
      isPinned: false,
      priority: 'normal',
      isReported: false,
      isHidden: false
    };

    // Add message to local state immediately for better UX
    setRooms(prev => {
      const room = prev.get(roomId);
      if (!room) return prev;
      
      const updatedRoom = {
        ...room,
        messages: [...room.messages, message as ChatMessage],
        lastMessage: message as ChatMessage
      };
      
      return new Map(prev).set(roomId, updatedRoom);
    });

    // Send via WebSocket
    ws.send(JSON.stringify({
      type: 'message',
      data: message,
      timestamp: new Date()
    }));

    return message as ChatMessage;
  }, [ws]);

  // Send typing indicator
  const sendTypingIndicator = useCallback((roomId: string, isTyping: boolean) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    ws.send(JSON.stringify({
      type: 'typing',
      data: {
        roomId,
        userId: 'current_user_id',
        username: 'Current User',
        isTyping,
        timestamp: new Date()
      },
      timestamp: new Date()
    }));
  }, [ws]);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Chatga ulanmagan');
      return;
    }

    ws.send(JSON.stringify({
      type: 'edit_message',
      data: {
        messageId,
        content: newContent,
        editedAt: new Date()
      },
      timestamp: new Date()
    }));

    // Update local state
    setRooms(prev => {
      const updatedRooms = new Map();
      prev.forEach((room, roomId) => {
        const updatedMessages = room.messages.map(msg => 
          msg.id === messageId 
            ? { ...msg, content: newContent, editedAt: new Date(), isEdited: true }
            : msg
        );
        updatedRooms.set(roomId, { ...room, messages: updatedMessages });
      });
      return updatedRooms;
    });

    toast.success('Xabar tahrirlandi');
  }, [ws]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Chatga ulanmagan');
      return;
    }

    ws.send(JSON.stringify({
      type: 'delete_message',
      data: {
        messageId,
        deletedAt: new Date()
      },
      timestamp: new Date()
    }));

    // Update local state
    setRooms(prev => {
      const updatedRooms = new Map();
      prev.forEach((room, roomId) => {
        const updatedMessages = room.messages.map(msg => 
          msg.id === messageId 
            ? { ...msg, deletedAt: new Date(), isDeleted: true, content: 'Bu xabar o\'chirildi' }
            : msg
        );
        updatedRooms.set(roomId, { ...room, messages: updatedMessages });
      });
      return updatedRooms;
    });

    toast.success('Xabar o\'chirildi');
  }, [ws]);

  // Add reaction
  const addReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Chatga ulanmagan');
      return;
    }

    const reaction = {
      emoji,
      userId: 'current_user_id',
      username: 'Current User',
      timestamp: new Date()
    };

    ws.send(JSON.stringify({
      type: 'add_reaction',
      data: {
        messageId,
        reaction
      },
      timestamp: new Date()
    }));

    // Update local state
    setRooms(prev => {
      const updatedRooms = new Map();
      prev.forEach((room, roomId) => {
        const updatedMessages = room.messages.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                reactions: [...msg.reactions.filter(r => r.userId !== 'current_user_id'), reaction]
              }
            : msg
        );
        updatedRooms.set(roomId, { ...room, messages: updatedMessages });
      });
      return updatedRooms;
    });
  }, [ws]);

  // Join room
  const joinRoom = useCallback((roomId: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('Chatga ulanmagan');
      return;
    }

    ws.send(JSON.stringify({
      type: 'join_room',
      data: {
        roomId,
        userId: 'current_user_id'
      },
      timestamp: new Date()
    }));

    setCurrentRoomId(roomId);
    
    // Initialize room if not exists
    if (!rooms.has(roomId)) {
      setRooms(prev => new Map(prev).set(roomId, {
        id: roomId,
        name: `Room ${roomId}`,
        members: [],
        typingUsers: [],
        messages: mockMessages.filter(msg => msg.roomId === roomId),
        unreadCount: 0,
        isOnline: true,
        isConnected: true,
        typingTimeouts: new Map()
      }));
    }
  }, [ws, rooms]);

  // Leave room
  const leaveRoom = useCallback((roomId: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    ws.send(JSON.stringify({
      type: 'leave_room',
      data: {
        roomId,
        userId: 'current_user_id'
      },
      timestamp: new Date()
    }));

    if (currentRoomId === roomId) {
      setCurrentRoomId(null);
    }
  }, [ws, currentRoomId]);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore errors (user might have disabled audio)
      });
    } catch (error) {
      // Ignore errors
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    typingTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    typingTimeoutsRef.current.clear();
    
    if (ws) {
      ws.close(1000, 'User disconnected');
      setWs(null);
    }
    
    setConnectionStatus('disconnected');
  }, [ws]);

  // Initialize connection on mount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  // Get current room
  const getCurrentRoom = useCallback((): ChatRoomState | null => {
    return currentRoomId ? rooms.get(currentRoomId) || null : null;
  }, [currentRoomId, rooms]);

  // Get room messages
  const getRoomMessages = useCallback((roomId: string): ChatMessage[] => {
    return rooms.get(roomId)?.messages || [];
  }, [rooms]);

  // Get typing users for room
  const getTypingUsersForRoom = useCallback((roomId: string): TypingUser[] => {
    const room = rooms.get(roomId);
    return room?.typingUsers || [];
  }, [rooms]);

  return {
    ws,
    connectionStatus,
    reconnectAttempts,
    rooms,
    currentRoomId,
    typingUsers,
    onlineUsers,
    connect,
    disconnect,
    sendMessage,
    sendTypingIndicator,
    editMessage,
    deleteMessage,
    addReaction,
    joinRoom,
    leaveRoom,
    getCurrentRoom,
    getRoomMessages,
    getTypingUsersForRoom
  };
}

export default function RealTimeChatInterface() {
  const {
    connectionStatus,
    rooms,
    currentRoomId,
    typingUsers,
    sendMessage,
    sendTypingIndicator,
    editMessage,
    deleteMessage,
    addReaction,
    joinRoom,
    leaveRoom,
    getCurrentRoom,
    getRoomMessages,
    getTypingUsersForRoom
  } = useRealTimeChat();

  const [messageInput, setMessageInput] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentRoom = getCurrentRoom();
  const messages = currentRoom ? getRoomMessages(currentRoom.id) : [];
  const typingUsersList = currentRoom ? getTypingUsersForRoom(currentRoom.id) : [];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle message input
  const handleMessageSend = async () => {
    if (!messageInput.trim() || !currentRoomId) return;

    await sendMessage(currentRoomId, messageInput.trim(), 'text', undefined, replyingTo || undefined);
    setMessageInput('');
    setReplyingTo(null);
  };

  // Handle typing indicator
  const handleTyping = (value: string) => {
    setMessageInput(value);
    
    if (currentRoomId) {
      sendTypingIndicator(currentRoomId, value.length > 0);
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessageInput(prev => prev + emoji);
    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSend();
    }
  };

  // Format timestamp
  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) {
      const minutes = Math.floor(diff / (1000 * 60));
      return minutes === 0 ? 'hozir' : `${minutes} daqiqa oldin`;
    } else if (hours < 24) {
      return `${hours} soat oldin`;
    } else {
      return date.toLocaleDateString('uz-UZ');
    }
  };

  // Get connection status color
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'reconnecting': return 'bg-orange-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Connection Status */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-600">
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`}></div>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {connectionStatus === 'connected' && 'Ulangan'}
            {connectionStatus === 'connecting' && 'Ulanmoqda...'}
            {connectionStatus === 'reconnecting' && 'Qayta ulanmoqda...'}
            {connectionStatus === 'disconnected' && 'Ulanmagan'}
          </span>
        </div>
        
        {currentRoom && (
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {currentRoom.name}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              ({currentRoom.members.length} a'zo)
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Xonaga xabar yuboring
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.senderId === 'current_user_id' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {message.senderAvatar ? (
                      <img
                        src={message.senderAvatar}
                        alt={message.senderName}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      message.senderName.charAt(0).toUpperCase()
                    )}
                  </div>
                </div>

                {/* Message Content */}
                <div className={`flex-1 max-w-md ${
                  message.senderId === 'current_user_id' ? 'flex flex-col items-end' : ''
                }`}>
                  {/* Sender Name */}
                  <div className={`text-xs text-gray-500 dark:text-gray-400 mb-1 ${
                    message.senderId === 'current_user_id' ? 'text-right' : ''
                  }`}>
                    {message.senderName} • {formatTimestamp(message.timestamp)}
                  </div>

                  {/* Reply To */}
                  {message.replyTo && (
                    <div className={`p-2 bg-gray-100 dark:bg-gray-700 rounded-lg mb-2 ${
                      message.senderId === 'current_user_id' ? 'ml-auto' : ''
                    }`}>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {message.replyTo.senderName}ga javob:
                      </div>
                      <div className="text-sm text-gray-800 dark:text-gray-200 truncate">
                        {message.replyTo.content}
                      </div>
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`p-3 rounded-lg ${
                      message.senderId === 'current_user_id'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    } ${
                      message.isDeleted ? 'opacity-50' : ''
                    }`}
                  >
                    {message.isDeleted ? (
                      <p className="text-sm italic">
                        {message.content}
                      </p>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-wrap">
                          {message.content}
                        </p>
                        
                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {message.attachments.map((attachment, index) => (
                              <div key={index} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded">
                                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center">
                                  {attachment.type === 'image' && '🖼️'}
                                  {attachment.type === 'file' && '📄'}
                                  {attachment.type === 'video' && '🎥'}
                                  {attachment.type === 'audio' && '🎵'}
                                  {attachment.type === 'voice' && '🎤'}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">
                                    {attachment.name}
                                  </p>
                                  {attachment.size && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {(attachment.size / 1024).toFixed(1)} KB
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Location */}
                        {message.location && (
                          <div className="mt-2 p-2 bg-white dark:bg-gray-800 rounded">
                            <div className="flex items-center space-x-2">
                              <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                                📍
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {message.location.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {message.location.address}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Edit indicator */}
                        {message.isEdited && (
                          <p className="text-xs opacity-70 mt-1">
                            (tahrirlandi {message.editedAt && formatTimestamp(message.editedAt)})
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* Reactions */}
                  {message.reactions.length > 0 && (
                    <div className={`flex items-center space-x-1 mt-1 ${
                      message.senderId === 'current_user_id' ? 'flex-row-reverse' : ''
                    }`}>
                      {message.reactions.map((reaction, index) => (
                        <button
                          key={index}
                          onClick={() => addReaction(message.id, reaction.emoji)}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                        >
                          {reaction.emoji} {reaction.username}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Message Actions */}
                  {!message.isDeleted && (
                    <div className={`flex items-center space-x-1 mt-1 ${
                      message.senderId === 'current_user_id' ? 'flex-row-reverse' : ''
                    }`}>
                      <button
                        onClick={() => setReplyingTo(message.id)}
                        className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        title="Javob berish"
                      >
                        <Reply className="w-4 h-4" />
                      </button>
                      
                      {message.senderId === 'current_user_id' && (
                        <>
                          <button
                            onClick={() => editMessage(message.id, message.content)}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            title="Tahrirlash"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteMessage(message.id)}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            title="O'chirish"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      
                      <button
                        className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                        title="Reaksiya"
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                      
                      <button className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Indicators */}
            {typingUsersList.length > 0 && (
              <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span>
                  {typingUsersList.map(user => user.username).join(', ')} 
                  {typingUsersList.length === 1 ? ' yozmoqda' : ' yozmoqdalar'}
                </span>
              </div>
            )}
          </>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Reply To Indicator */}
      {replyingTo && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Reply className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-900 dark:text-blue-100">
                {messages.find(m => m.id === replyingTo)?.senderName}ga javob berish
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 text-blue-600 hover:text-blue-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-600">
        <div className="flex items-end space-x-2">
          {/* Attachment Button */}
          <button
            onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="Fayl biriktirish"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Message Input */}
          <div className="flex-1">
            <textarea
              ref={messageInputRef}
              value={messageInput}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Xabar yozing..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>

          {/* Emoji Button */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="Emoji"
          >
            <Smile className="w-5 h-5" />
          </button>

          {/* Voice Record Button */}
          <button
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="Ovoz yozish"
          >
            <Mic className="w-5 h-5" />
          </button>

          {/* Send Button */}
          <button
            onClick={handleMessageSend}
            disabled={!messageInput.trim() || !currentRoomId}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Yuborish"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2">
            <div className="grid grid-cols-8 gap-1">
              {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😴', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😱', '😖', '😵', '😶', '😐', '😑', '😒', '🙄', '😬', '🤥', '😴', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '🤠', '🥳', '😎', '🤓', '🧐'].map((emoji, index) => (
                <button
                  key={index}
                  onClick={() => handleEmojiSelect(emoji)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Attachment Menu */}
        {showAttachmentMenu && (
          <div className="absolute bottom-20 left-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-2">
            <div className="space-y-1">
              <button className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2">
                <div className="w-5 h-5 bg-blue-100 rounded flex items-center justify-center text-xs">🖼️</div>
                <span className="text-sm">Rasm</span>
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2">
                <div className="w-5 h-5 bg-green-100 rounded flex items-center justify-center text-xs">📄</div>
                <span className="text-sm">Fayl</span>
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2">
                <div className="w-5 h-5 bg-purple-100 rounded flex items-center justify-center text-xs">🎥</div>
                <span className="text-sm">Video</span>
              </button>
              <button className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center space-x-2">
                <div className="w-5 h-5 bg-orange-100 rounded flex items-center justify-center text-xs">📍</div>
                <span className="text-sm">Manzil</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
