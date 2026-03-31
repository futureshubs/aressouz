import { useState, useEffect, useCallback, useRef } from 'react';
import { MapPin, Users, MessageCircle, Send, Search, Bell, Settings, Shield, Globe, Lock, Crown, Star, Clock, TrendingUp, Hash, Plus } from 'lucide-react';
import { toast } from 'sonner';

export interface ChatRoom {
  id: string;
  name: string;
  type: 'region' | 'city' | 'district' | 'community' | 'private';
  location: {
    region: string;
    city?: string;
    district?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  description: string;
  
  // Room settings
  isPublic: boolean;
  isJoinable: boolean;
  requiresApproval: boolean;
  
  // Member management
  memberCount: number;
  maxMembers?: number;
  onlineCount: number;
  
  // Activity
  lastMessage?: {
    id: string;
    content: string;
    senderName: string;
    timestamp: Date;
    type: 'text' | 'image' | 'file' | 'location';
  };
  messageCount: number;
  todayMessageCount: number;
  
  // Moderation
  moderators: string[];
  rules: string[];
  isModerated: boolean;
  
  // Tags and categories
  tags: string[];
  category: 'general' | 'trading' | 'help' | 'events' | 'news' | 'discussion';
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  isActive: boolean;
  featured: boolean;
}

export interface ChatUser {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  email: string;
  phone?: string;
  
  // Location
  location: {
    region: string;
    city?: string;
    district?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  
  // Profile
  bio?: string;
  interests: string[];
  languages: string[];
  
  // Chat settings
  isOnline: boolean;
  lastSeen: Date;
  status: 'online' | 'away' | 'busy' | 'offline';
  
  // Verification
  isVerified: boolean;
  isPremium: boolean;
  reputation: number;
  
  // Permissions
  role: 'user' | 'moderator' | 'admin';
  bannedUntil?: Date;
  warningCount: number;
  
  // Preferences
  notifications: boolean;
  soundEnabled: boolean;
  autoJoinLocal: boolean;
  
  // Metadata
  joinedAt: Date;
  lastActivity: Date;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'location' | 'system';
  
  // Media attachments
  attachments?: Array<{
    type: 'image' | 'file' | 'video' | 'audio';
    url: string;
    name: string;
    size?: number;
    thumbnail?: string;
  }>;
  
  // Location data
  location?: {
    name: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  
  // Timestamps
  timestamp: Date;
  editedAt?: Date;
  deletedAt?: Date;
  
  // Engagement
  reactions: Array<{
    emoji: string;
    userId: string;
    timestamp: Date;
  }>;
  replies: number;
  mentions: string[];
  
  // Moderation
  isReported: boolean;
  reportReason?: string;
  isHidden: boolean;
  moderatedBy?: string;
  
  // Metadata
  isEdited: boolean;
  isDeleted: boolean;
}

export interface ChatNotification {
  id: string;
  userId: string;
  type: 'message' | 'mention' | 'room_invite' | 'room_update' | 'moderation';
  roomId: string;
  roomName: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  createdAt: Date;
}

// Uzbekistan regions and cities data
const uzbekistanRegions = [
  {
    region: 'Toshkent',
    cities: ['Toshkent'],
    districts: ['Bektemir', 'Chilanzar', 'Mirzo Ulug\'bek', 'Sergeli', 'Shayxontohur', 'Uchtepa', 'Yakkasaray', 'Yashnobod', 'Yunusobod']
  },
  {
    region: 'Andijon',
    cities: ['Andijon', 'Xo\'jaobod', 'Qo\'qon', 'Marhamat', 'Baliqchi'],
    districts: ['Andijon shahar', 'Baliqchi', 'Buloqboshi', 'Jalaquduq', 'Kurgontepa', 'Marhamat', 'Qo\'qon', 'Xo\'jaobod']
  },
  {
    region: 'Buxoro',
    cities: ['Buxoro', 'Qorako\'l', 'G\'ijduvon', 'Vobkent', 'Jondor'],
    districts: ['Buxoro shahar', 'G\'ijduvon', 'Jondor', 'Kogon', 'Qorako\'l', 'Romitan', 'Shofirkon', 'Vobkent']
  },
  {
    region: 'Farg\'ona',
    cities: ['Farg\'ona', 'Qo\'qon', 'Quvasoy', 'Rishton', 'Oltinko\'l'],
    districts: ['Farg\'ona shahar', 'Beshariq', 'Buvayda', 'Dang\'ara', 'Oltinko\'l', 'Quva', 'Qo\'qon', 'Quvasoy', 'Rishton', 'So\'x', 'Uchko\'prik', 'Yozyovon']
  },
  {
    region: 'Jizzax',
    cities: ['Jizzax', 'Gallaorol', 'Paxtakor', 'Do\'stlik', 'Yangiqo\'rg\'on'],
    districts: ['Do\'stlik', 'Gallaorol', 'Jizzax shahar', 'Mirzachul', 'Paxtakor', 'Yangiqo\'rg\'on', 'Zarbdor']
  },
  {
    region: 'Qashqadaryo',
    cities: ['Qarshi', 'Qo\'ng\'ir', 'Kitob', 'Shahrisabz', 'Muborak'],
    districts: ['Dehqonobod', 'Guzor', 'Kasbi', 'Kitob', 'Mirishkor', 'Muborak', 'Nishon', 'Qarshi shahar', 'Qo\'ng\'ir', 'Shahrisabz', 'Yakkabog\'']
  },
  {
    region: 'Navoiy',
    cities: ['Navoiy', 'Zarafshon', 'Qiziltepa', 'Uchquduq', 'Nurota'],
    districts: ['Karmana', 'Kanimex', 'Navbahor', 'Navoiy shahar', 'Nurota', 'Qiziltepa', 'Tomdi', 'Uchquduq', 'Xatirchi']
  },
  {
    region: 'Namangan',
    cities: ['Namangan', 'Chust', 'Pop', 'Uchqo\'rg\'on', 'Kosonsoy'],
    districts: ['Chust', 'Kosonsoy', 'Mingbuloq', 'Namangan shahar', 'Norin', 'Pop', 'To\'raqo\'rg\'on', 'Uchqo\'rg\'on', 'Yangiqo\'rg\'on']
  },
  {
    region: 'Samarqand',
    cities: ['Samarqand', 'Bulung\'ur', 'Jomboy', 'Kattakurgon', 'Urgut'],
    districts: ['Bulung\'ur', 'Guzabuloq', 'Ishtixon', 'Jomboy', 'Kattakurgon', 'Narpay', 'Oqdaryo', 'Pastdarg\'om', 'Payariq', 'Qo\'shko\'prik', 'Samarqand shahar', 'Toshqent', 'Urgut']
  },
  {
    region: 'Sirdaryo',
    cities: ['Guliston', 'Yangiyer', 'Baxt', 'Oqoltin', 'Sirdaryo'],
    districts: ['Baxt', 'Guliston', 'Mirzaobod', 'Oqoltin', 'Sardoba', 'Sirdaryo', 'Xovos', 'Yangiyer']
  },
  {
    region: 'Surxondaryo',
    cities: ['Termiz', 'Denov', 'Qumqo\'rg\'on', 'Sho\'rchi', 'Sariosiy'],
    districts: ['Angor', 'Boysun', 'Denov', 'Jarqo\'rg\'on', 'Qiziriq', 'Qo\'shko\'prik', 'Qumqo\'rg\'on', 'Muzrabod', 'Sariosiy', 'Sho\'rchi', 'Termiz shahar', 'Uzun']
  },
  {
    region: 'Xorazm',
    cities: ['Urganch', 'Xiva', 'Bog\'ot', 'Xonqa', 'Shovot'],
    districts: ['Bog\'ot', 'Gurlan', 'Hazorasp', 'Xiva', 'Xonqa', 'Qo\'shko\'prik', 'Shovot', 'Urganch', 'Yangiariq', 'Yopirg\'on']
  },
  {
    region: 'Qoraqalpog\'iston',
    cities: ['Nukus', 'Berdaq', 'Chimbay', 'Qo\'ng\'irot', 'Taxtako\'pir'],
    districts: ['Amudaryo', 'Berdaq', 'Bo\'zatov', 'Chimbay', 'Elliqqala', 'Karakalpak', 'Kegeyli', 'Mo\'ynaq', 'Nukus', 'Qo\'n\'irot', 'Qorao\'zak', 'Taxtako\'pir', 'To\'rtku\'l', 'Xo\'jayli']
  }
];

const mockChatRooms: ChatRoom[] = [
  {
    id: 'room_toshkent',
    name: 'Toshkent shahri',
    type: 'city',
    location: {
      region: 'Toshkent',
      city: 'Toshkent',
      coordinates: { lat: 41.2995, lng: 69.2401 }
    },
    description: 'Toshkent shahri aholisi uchun umumiy chat xonasi',
    isPublic: true,
    isJoinable: true,
    requiresApproval: false,
    memberCount: 15420,
    onlineCount: 892,
    lastMessage: {
      id: 'msg_1',
      content: 'Assalomu alaykum Toshkent do\'stlari!',
      senderName: 'Admin',
      timestamp: new Date('2025-03-19T15:30:00'),
      type: 'text'
    },
    messageCount: 45670,
    todayMessageCount: 1234,
    moderators: ['admin', 'moderator_1'],
    rules: [
      'Hurmatli muomala qiling',
      'Spam va reklama taqiqlanadi',
      'Shaxsiy ma\'lumotlarni yoymang',
      'Zararli kontent taqiqlanadi'
    ],
    isModerated: true,
    tags: ['toshkent', 'umumiy', 'shahar'],
    category: 'general',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'admin',
    isActive: true,
    featured: true
  },
  {
    id: 'room_andijon_business',
    name: 'Andijon Biznes',
    type: 'community',
    location: {
      region: 'Andijon',
      city: 'Andijon',
      coordinates: { lat: 40.7821, lng: 72.3442 }
    },
    description: 'Andijon viloyati tadbirkorlari uchun biznes chat xonasi',
    isPublic: true,
    isJoinable: true,
    requiresApproval: true,
    memberCount: 3420,
    onlineCount: 156,
    lastMessage: {
      id: 'msg_2',
      content: 'Yangi biznes imkoniyatlari haqida gaplashamiz',
      senderName: 'Biznes_Admin',
      timestamp: new Date('2025-03-19T14:15:00'),
      type: 'text'
    },
    messageCount: 8900,
    todayMessageCount: 234,
    moderators: ['admin', 'andijon_mod'],
    rules: [
      'Faqat biznes mavzularida gapiring',
      'Reklama qilishdan oldin ruxsat oling',
      'Tadbirkorlar o\'rtasida hamkorlik qiling'
    ],
    isModerated: true,
    tags: ['andijon', 'biznes', 'tadbirkor', 'ish'],
    category: 'trading',
    createdAt: new Date('2025-02-01'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'admin',
    isActive: true,
    featured: false
  },
  {
    id: 'room_samarkand_tourists',
    name: 'Samarqand Tourists',
    type: 'community',
    location: {
      region: 'Samarqand',
      city: 'Samarqand',
      coordinates: { lat: 39.6542, lng: 66.9597 }
    },
    description: 'Samarqandga tashrif buyurgan sayyohlar uchun chat',
    isPublic: true,
    isJoinable: true,
    requiresApproval: false,
    memberCount: 2340,
    onlineCount: 89,
    lastMessage: {
      id: 'msg_3',
      content: 'Registon maydoniga qanday borish mumkin?',
      senderName: 'Tourist_Help',
      timestamp: new Date('2025-03-19T16:45:00'),
      type: 'text'
    },
    messageCount: 5670,
    todayMessageCount: 145,
    moderators: ['admin', 'samarkand_guide'],
    rules: [
      'Turistlar uchun yordam chat xonasi',
      'Savollarni inglizcha yoki o\'zbekcha yozing',
      'Mahalliy haqida ma\'lumot bering'
    ],
    isModerated: true,
    tags: ['samarqand', 'tourist', 'sayyoh', 'yordam'],
    category: 'help',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-03-19'),
    createdBy: 'admin',
    isActive: true,
    featured: true
  }
];

export function useRegionalChat() {
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>(mockChatRooms);
  const [currentUser, setCurrentUser] = useState<ChatUser | null>(null);
  const [userRooms, setUserRooms] = useState<ChatRoom[]>([]);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get user's location
  const getUserLocation = useCallback((): Promise<ChatUser['location']> => {
    return new Promise((resolve) => {
      // Mock geolocation - real implementation would use browser geolocation API
      setTimeout(() => {
        resolve({
          region: 'Toshkent',
          city: 'Toshkent',
          coordinates: { lat: 41.2995, lng: 69.2401 }
        });
      }, 1000);
    });
  }, []);

  // Detect user's region and auto-join local rooms
  const detectAndJoinLocalRooms = useCallback(async (user: ChatUser) => {
    setIsLoading(true);
    
    try {
      const userLocation = user.location;
      const localRooms = chatRooms.filter(room => {
        // Check if room matches user's location
        if (room.location.region === userLocation.region) {
          return true;
        }
        
        if (room.location.city && room.location.city === userLocation.city) {
          return true;
        }
        
        if (room.location.district && room.location.district === userLocation.district) {
          return true;
        }
        
        return false;
      });

      // Auto-join local rooms if enabled
      const autoJoinableRooms = localRooms.filter(room => 
        room.isPublic && 
        room.isJoinable && 
        !room.requiresApproval &&
        !userRooms.some(userRoom => userRoom.id === room.id)
      );

      setUserRooms(prev => [...prev, ...autoJoinableRooms]);
      
      // Create notifications for auto-joined rooms
      const newNotifications: ChatNotification[] = autoJoinableRooms.map(room => ({
        id: `notif_${Date.now()}_${room.id}`,
        userId: user.id,
        type: 'room_invite',
        roomId: room.id,
        roomName: room.name,
        title: 'Avtomatik ulandi',
        message: `${room.name} xonasiga avtomatik ulandingiz`,
        read: false,
        createdAt: new Date()
      }));

      setNotifications(prev => [...prev, ...newNotifications]);
      
    } catch (error) {
      console.error('Error detecting local rooms:', error);
    } finally {
      setIsLoading(false);
    }
  }, [chatRooms, userRooms]);

  // Join room
  const joinRoom = useCallback(async (roomId: string, userId: string) => {
    const room = chatRooms.find(r => r.id === roomId);
    if (!room) {
      throw new Error('Xona topilmadi');
    }

    if (!room.isJoinable) {
      throw new Error('Ushbu xonaga qo\'shib bo\'lmaydi');
    }

    if (room.requiresApproval) {
      // Request approval
      toast.info('So\'rov yuborildi. Tasdiqlash kutilmoqda...');
      return { status: 'pending', room };
    }

    // Direct join
    setUserRooms(prev => {
      const alreadyJoined = prev.some(r => r.id === roomId);
      if (alreadyJoined) {
        return prev;
      }
      return [...prev, room];
    });

    // Update room member count
    setChatRooms(prev => prev.map(r => 
      r.id === roomId 
        ? { ...r, memberCount: r.memberCount + 1 }
        : r
    ));

    toast.success(`${room.name} xonasiga qo\'shildingiz`);
    return { status: 'joined', room };
  }, [chatRooms]);

  // Leave room
  const leaveRoom = useCallback(async (roomId: string, userId: string) => {
    setUserRooms(prev => prev.filter(room => room.id !== roomId));
    
    // Update room member count
    setChatRooms(prev => prev.map(r => 
      r.id === roomId 
        ? { ...r, memberCount: Math.max(0, r.memberCount - 1) }
        : r
    ));

    toast.success('Xonadan chiqdingiz');
  }, []);

  // Get available rooms for user
  const getAvailableRooms = useCallback((user: ChatUser) => {
    return chatRooms.filter(room => {
      // User can see public rooms
      if (!room.isPublic) return false;
      
      // User can see rooms in their region/city
      if (room.location.region === user.location.region) return true;
      if (room.location.city && room.location.city === user.location.city) return true;
      if (room.location.district && room.location.district === user.location.district) return true;
      
      return false;
    });
  }, [chatRooms]);

  // Get rooms by location
  const getRoomsByLocation = useCallback((location: {
    region?: string;
    city?: string;
    district?: string;
  }) => {
    return chatRooms.filter(room => {
      if (location.region && room.location.region !== location.region) return false;
      if (location.city && room.location.city !== location.city) return false;
      if (location.district && room.location.district !== location.district) return false;
      return true;
    });
  }, [chatRooms]);

  // Search rooms
  const searchRooms = useCallback((query: string) => {
    const searchTerm = query.toLowerCase();
    return chatRooms.filter(room => 
      room.isPublic && (
        room.name.toLowerCase().includes(searchTerm) ||
        room.description.toLowerCase().includes(searchTerm) ||
        room.tags.some(tag => tag.toLowerCase().includes(searchTerm))
      )
    );
  }, [chatRooms]);

  // Get popular rooms
  const getPopularRooms = useCallback((limit: number = 10) => {
    return chatRooms
      .filter(room => room.isPublic)
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, limit);
  }, [chatRooms]);

  // Get trending rooms (by activity)
  const getTrendingRooms = useCallback((limit: number = 10) => {
    return chatRooms
      .filter(room => room.isPublic)
      .sort((a, b) => b.todayMessageCount - a.todayMessageCount)
      .slice(0, limit);
  }, [chatRooms]);

  // Create new room
  const createRoom = useCallback(async (roomData: Omit<ChatRoom, 'id' | 'memberCount' | 'onlineCount' | 'messageCount' | 'todayMessageCount' | 'createdAt' | 'updatedAt'>) => {
    setIsLoading(true);
    
    try {
      const newRoom: ChatRoom = {
        ...roomData,
        id: `room_${Date.now()}`,
        memberCount: 1,
        onlineCount: 1,
        messageCount: 0,
        todayMessageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setChatRooms(prev => [...prev, newRoom]);
      toast.success('Yangi chat xonasi yaratildi');
      
      // Auto-join creator
      setUserRooms(prev => [...prev, newRoom]);
      
      return newRoom;
    } catch (error) {
      toast.error('Xona yaratishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get room statistics
  const getRoomStats = useCallback(() => {
    const totalRooms = chatRooms.length;
    const publicRooms = chatRooms.filter(room => room.isPublic).length;
    const totalMembers = chatRooms.reduce((sum, room) => sum + room.memberCount, 0);
    const totalOnline = chatRooms.reduce((sum, room) => sum + room.onlineCount, 0);
    const totalMessages = chatRooms.reduce((sum, room) => sum + room.messageCount, 0);

    return {
      totalRooms,
      publicRooms,
      totalMembers,
      totalOnline,
      totalMessages,
      averageMembersPerRoom: totalRooms > 0 ? totalMembers / totalRooms : 0
    };
  }, [chatRooms]);

  // Initialize user and auto-join local rooms
  const initializeUser = useCallback(async (userData: Partial<ChatUser>) => {
    const userLocation = await getUserLocation();
    
    const user: ChatUser = {
      id: `user_${Date.now()}`,
      username: userData.username || `user_${Date.now()}`,
      displayName: userData.displayName || userData.username || 'Foydalanuvchi',
      email: userData.email || '',
      location: userLocation,
      bio: userData.bio,
      interests: userData.interests || [],
      languages: userData.languages || ['uz', 'ru'],
      isOnline: true,
      lastSeen: new Date(),
      status: 'online',
      isVerified: false,
      isPremium: false,
      reputation: 0,
      role: 'user',
      warningCount: 0,
      notifications: true,
      soundEnabled: true,
      autoJoinLocal: true,
      joinedAt: new Date(),
      lastActivity: new Date(),
      ...userData
    };

    setCurrentUser(user);
    await detectAndJoinLocalRooms(user);
    
    return user;
  }, [getUserLocation, detectAndJoinLocalRooms]);

  return {
    chatRooms,
    currentUser,
    userRooms,
    notifications,
    isLoading,
    uzbekistanRegions,
    initializeUser,
    getUserLocation,
    detectAndJoinLocalRooms,
    joinRoom,
    leaveRoom,
    getAvailableRooms,
    getRoomsByLocation,
    searchRooms,
    getPopularRooms,
    getTrendingRooms,
    createRoom,
    getRoomStats
  };
}

export default function RegionalChatSystem() {
  const {
    chatRooms,
    currentUser,
    userRooms,
    notifications,
    isLoading,
    uzbekistanRegions,
    initializeUser,
    joinRoom,
    leaveRoom,
    getAvailableRooms,
    getRoomsByLocation,
    searchRooms,
    getPopularRooms,
    getTrendingRooms,
    createRoom,
    getRoomStats
  } = useRegionalChat();

  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'popular' | 'trending'>('all');

  useEffect(() => {
    // Initialize demo user
    initializeUser({
      username: 'demo_user',
      displayName: 'Demo Foydalanuvchi',
      email: 'demo@example.com'
    });
  }, [initializeUser]);

  const availableRooms = selectedRegion 
    ? getRoomsByLocation({ region: selectedRegion, city: selectedCity || undefined })
    : getAvailableRooms(currentUser!);

  const filteredRooms = searchQuery 
    ? searchRooms(searchQuery).filter(room => 
      selectedRegion ? room.location.region === selectedRegion : true
    )
    : availableRooms;

  const displayRooms = activeTab === 'my' ? userRooms :
                       activeTab === 'popular' ? getPopularRooms() :
                       activeTab === 'trending' ? getTrendingRooms() :
                       filteredRooms;

  const roomStats = getRoomStats();

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    setSelectedCity(''); // Reset city when region changes
  };

  const handleJoinRoom = async (roomId: string) => {
    if (!currentUser) {
      toast.error('Avval tizimga kirishingiz kerak');
      return;
    }
    
    try {
      await joinRoom(roomId, currentUser.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Xonaga qo\'shib bo\'lmadi');
    }
  };

  const handleLeaveRoom = async (roomId: string) => {
    if (!currentUser) return;
    
    try {
      await leaveRoom(roomId, currentUser.id);
    } catch (error) {
      toast.error('Xonadan chiqib bo\'lmadi');
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <MessageCircle className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Hududiy Chat
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          {currentUser && (
            <div className="flex items-center space-x-2 px-3 py-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-green-700 dark:text-green-300 text-sm font-medium">
                {currentUser.displayName}
              </span>
              <span className="text-xs text-green-600 dark:text-green-400">
                ({currentUser.location.region})
              </span>
            </div>
          )}
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Yangi xona</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <MessageCircle className="w-8 h-8 text-blue-500" />
            <span className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {roomStats.totalRooms}
            </span>
          </div>
          <p className="text-blue-700 dark:text-blue-300">Jami xonalar</p>
        </div>
        
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-green-500" />
            <span className="text-2xl font-bold text-green-900 dark:text-green-100">
              {roomStats.totalMembers.toLocaleString()}
            </span>
          </div>
          <p className="text-green-700 dark:text-green-300">Jami a'zolar</p>
        </div>
        
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Globe className="w-8 h-8 text-purple-500" />
            <span className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {roomStats.totalOnline}
            </span>
          </div>
          <p className="text-purple-700 dark:text-purple-300">Onlayn</p>
        </div>
        
        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 text-orange-500" />
            <span className="text-2xl font-bold text-orange-900 dark:text-orange-100">
              {roomStats.totalMessages.toLocaleString()}
            </span>
          </div>
          <p className="text-orange-700 dark:text-orange-300">Xabarlar</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
        {/* Region Selector */}
        <select
          value={selectedRegion}
          onChange={(e) => handleRegionChange(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">Barcha viloyatlar</option>
          {uzbekistanRegions.map(region => (
            <option key={region.region} value={region.region}>
              {region.region}
            </option>
          ))}
        </select>

        {/* City Selector */}
        {selectedRegion && (
          <select
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="">Barcha shaharlar</option>
            {uzbekistanRegions
              .find(r => r.region === selectedRegion)
              ?.cities.map(city => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
          </select>
        )}

        {/* Search */}
        <div className="flex items-center space-x-2 flex-1">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Xonalarni qidirish..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        {/* Tabs */}
        <div className="flex items-center space-x-1 border border-gray-300 dark:border-gray-600 rounded-lg">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-2 text-sm font-medium rounded-l-lg transition-colors ${
              activeTab === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Barchasi
          </button>
          <button
            onClick={() => setActiveTab('my')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'my'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Mening
          </button>
          <button
            onClick={() => setActiveTab('popular')}
            className={`px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === 'popular'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Ommabop
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-3 py-2 text-sm font-medium rounded-r-lg transition-colors ${
              activeTab === 'trending'
                ? 'bg-blue-500 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Trend
          </button>
        </div>
      </div>

      {/* Rooms List */}
      <div className="space-y-4">
        {displayRooms.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Hech qanday xona topilmadi
            </p>
          </div>
        ) : (
          displayRooms.map(room => (
            <div key={room.id} className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {/* Room Icon */}
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                    {room.type === 'region' && <Globe className="w-6 h-6" />}
                    {room.type === 'city' && <MapPin className="w-6 h-6" />}
                    {room.type === 'district' && <Hash className="w-6 h-6" />}
                    {room.type === 'community' && <Users className="w-6 h-6" />}
                    {room.type === 'private' && <Lock className="w-6 h-6" />}
                  </div>

                  {/* Room Info */}
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {room.name}
                      </h3>
                      {room.featured && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                      {room.isModerated && (
                        <Shield className="w-4 h-4 text-blue-500" />
                      )}
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {room.description}
                    </p>

                    <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        {room.location.city || room.location.region}
                      </span>
                      <span className="flex items-center space-x-1">
                        <Users className="w-3 h-3" />
                        {room.memberCount.toLocaleString()} a'zo
                      </span>
                      <span className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        {room.onlineCount} onlayn
                      </span>
                      <span className="flex items-center space-x-1">
                        <MessageCircle className="w-3 h-3" />
                        {room.todayMessageCount} bugun
                      </span>
                    </div>

                    {/* Tags */}
                    {room.tags.length > 0 && (
                      <div className="flex items-center space-x-2 mt-2">
                        {room.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-xs rounded text-gray-700 dark:text-gray-300">
                            {tag}
                          </span>
                        ))}
                        {room.tags.length > 3 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            +{room.tags.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  {userRooms.some(userRoom => userRoom.id === room.id) ? (
                    <>
                      <button
                        onClick={() => handleLeaveRoom(room.id)}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm"
                      >
                        Chiqish
                      </button>
                      <button className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm">
                        Kirish
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleJoinRoom(room.id)}
                      className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                    >
                      Qo\'shilish
                    </button>
                  )}
                </div>
              </div>

              {/* Last Message Preview */}
              {room.lastMessage && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {room.lastMessage.senderName}:
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 truncate">
                      {room.lastMessage.content}
                    </span>
                    <span className="text-gray-500 dark:text-gray-500 text-xs">
                      {new Date(room.lastMessage.timestamp).toLocaleTimeString('uz-UZ', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="fixed bottom-4 right-4 max-w-sm">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
              Bildirishmalar ({notifications.length})
            </h4>
            <div className="space-y-2">
              {notifications.slice(0, 3).map(notif => (
                <div key={notif.id} className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <div className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {notif.title}
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    {notif.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
