import { useState, useEffect, useCallback } from 'react';
import { User, Mail, Phone, MapPin, Shield, Star, Camera, Edit, Save, X, Check, AlertCircle, Lock, Key, Eye, EyeOff, Crown } from 'lucide-react';
import { toast } from 'sonner';

export interface ChatUserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  
  // Profile info
  avatar?: string;
  bio?: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  
  // Location
  location: {
    region: string;
    city?: string;
    district?: string;
    neighborhood?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  
  // Interests and preferences
  interests: string[];
  languages: string[];
  hobbies: string[];
  
  // Social links
  socialLinks?: {
    telegram?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    website?: string;
  };
  
  // Verification and status
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  isLocationVerified: boolean;
  isVerified: boolean;
  verificationLevel: 'basic' | 'standard' | 'premium';
  
  // Chat settings
  isOnline: boolean;
  lastSeen: Date;
  status: 'online' | 'away' | 'busy' | 'invisible' | 'offline';
  customStatus?: string;
  
  // Privacy settings
  privacySettings: {
    showEmail: boolean;
    showPhone: boolean;
    showLocation: boolean;
    showLastSeen: boolean;
    allowDirectMessages: boolean;
    allowLocationSharing: boolean;
    allowProfileView: 'everyone' | 'friends' | 'none';
  };
  
  // Notification settings
  notificationSettings: {
    messageNotifications: boolean;
    mentionNotifications: boolean;
    roomInvitations: boolean;
    systemNotifications: boolean;
    soundEnabled: boolean;
    vibrationEnabled: boolean;
    desktopNotifications: boolean;
    emailNotifications: boolean;
  };
  
  // Chat preferences
  chatPreferences: {
    autoJoinLocalRooms: boolean;
    showOnlineStatus: boolean;
    messageSound: 'default' | 'none' | 'custom';
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    language: 'uz' | 'ru' | 'en';
    autoTranslate: boolean;
  };
  
  // Security settings
  securitySettings: {
    twoFactorEnabled: boolean;
    loginAlerts: boolean;
    sessionTimeout: number;
    allowedDevices: Array<{
      id: string;
      name: string;
      type: string;
      lastUsed: Date;
      isActive: boolean;
    }>;
  };
  
  // Reputation and activity
  reputation: {
    score: number;
    level: number;
    badges: string[];
    achievements: string[];
    warnings: number;
    bans: Array<{
      reason: string;
      startDate: Date;
      endDate: Date;
      type: 'temporary' | 'permanent';
    }>;
  };
  
  // Activity stats
  activityStats: {
    messagesSent: number;
    roomsJoined: number;
    timeSpent: number; // in minutes
    lastActivity: Date;
    joinDate: Date;
    dailyAverage: number;
    weeklyAverage: number;
    monthlyAverage: number;
  };
  
  // Subscription
  subscription?: {
    type: 'free' | 'premium' | 'vip';
    startDate: Date;
    endDate?: Date;
    features: string[];
  };
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
  isBanned: boolean;
  banReason?: string;
  banUntil?: Date;
}

export interface AuthCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegistrationData {
  username: string;
  displayName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  region: string;
  city?: string;
  agreeToTerms: boolean;
  agreeToPrivacy: boolean;
}

export interface VerificationCode {
  type: 'email' | 'phone';
  code: string;
  expiresAt: Date;
  attempts: number;
}

const mockUserProfile: ChatUserProfile = {
  id: 'user_123',
  username: 'john_doe',
  displayName: 'John Doe',
  email: 'john.doe@example.com',
  phone: '+998901234567',
  avatar: '/avatars/john_doe.jpg',
  bio: 'Toshkentda yashaydigan dasturchi. Texnologiyalar va innovatsiyalarni yaxshi ko\'raman.',
  dateOfBirth: new Date('1990-05-15'),
  gender: 'male',
  location: {
    region: 'Toshkent',
    city: 'Toshkent',
    district: 'Mirzo Ulug\'bek',
    neighborhood: 'Olmazor',
    coordinates: { lat: 41.2995, lng: 69.2401 }
  },
  interests: ['texnologiya', 'dasturlash', 'innovatsiya', 'startup', 'ai', 'blockchain'],
  languages: ['uz', 'ru', 'en'],
  hobbies: ['kitob o\'qish', 'sayr qilish', 'futbol', 'musiqa'],
  socialLinks: {
    telegram: '@john_doe',
    instagram: '@john_doe_uz',
    website: 'https://johndoe.uz'
  },
  isEmailVerified: true,
  isPhoneVerified: true,
  isLocationVerified: true,
  isVerified: true,
  verificationLevel: 'premium',
  isOnline: true,
  lastSeen: new Date(),
  status: 'online',
  customStatus: 'Ishlayapman',
  privacySettings: {
    showEmail: false,
    showPhone: false,
    showLocation: true,
    showLastSeen: true,
    allowDirectMessages: true,
    allowLocationSharing: true,
    allowProfileView: 'everyone'
  },
  notificationSettings: {
    messageNotifications: true,
    mentionNotifications: true,
    roomInvitations: true,
    systemNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
    desktopNotifications: true,
    emailNotifications: false
  },
  chatPreferences: {
    autoJoinLocalRooms: true,
    showOnlineStatus: true,
    messageSound: 'default',
    theme: 'auto',
    fontSize: 'medium',
    language: 'uz',
    autoTranslate: false
  },
  securitySettings: {
    twoFactorEnabled: true,
    loginAlerts: true,
    sessionTimeout: 30,
    allowedDevices: [
      {
        id: 'device_1',
        name: 'Chrome - Windows',
        type: 'desktop',
        lastUsed: new Date(),
        isActive: true
      },
      {
        id: 'device_2',
        name: 'iPhone 13',
        type: 'mobile',
        lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
        isActive: false
      }
    ]
  },
  reputation: {
    score: 850,
    level: 5,
    badges: ['verified', 'helper', 'active', 'friendly'],
    achievements: ['first_message', 'week_active', 'helper_100', 'social_butterfly'],
    warnings: 0,
    bans: []
  },
  activityStats: {
    messagesSent: 1234,
    roomsJoined: 15,
    timeSpent: 54320,
    lastActivity: new Date(),
    joinDate: new Date('2024-01-15'),
    dailyAverage: 45,
    weeklyAverage: 315,
    monthlyAverage: 1260
  },
  subscription: {
    type: 'premium',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2025-06-01'),
    features: ['unlimited_rooms', 'custom_avatar', 'priority_support', 'no_ads']
  },
  createdAt: new Date('2024-01-15'),
  updatedAt: new Date('2025-03-19'),
  lastLoginAt: new Date('2025-03-19T09:30:00'),
  isActive: true,
  isBanned: false
};

export function useChatAuth() {
  const [currentUser, setCurrentUser] = useState<ChatUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCodes, setVerificationCodes] = useState<Map<string, VerificationCode>>(new Map());
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Login
  const login = useCallback(async (credentials: AuthCredentials) => {
    setIsLoading(true);
    
    try {
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock user data
      const user: ChatUserProfile = {
        ...mockUserProfile,
        email: credentials.email,
        lastLoginAt: new Date(),
        lastSeen: new Date(),
        isOnline: true,
        status: 'online'
      };
      
      // Generate mock token
      const token = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      setCurrentUser(user);
      setAuthToken(token);
      
      // Store in localStorage
      if (credentials.rememberMe) {
        localStorage.setItem('chat_auth_token', token);
        localStorage.setItem('chat_user_data', JSON.stringify(user));
      }
      
      toast.success('Tizimga muvaffaqiyatli kirdingiz');
      return { success: true, user, token };
      
    } catch (error) {
      toast.error('Login xatolik. Email yoki parol noto\'g\'ri');
      return { success: false, error: 'Invalid credentials' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Register
  const register = useCallback(async (data: RegistrationData) => {
    setIsLoading(true);
    
    try {
      // Validate data
      if (data.password !== data.confirmPassword) {
        throw new Error('Parollar mos kelmadi');
      }
      
      if (data.password.length < 8) {
        throw new Error('Parol kamida 8 ta belgidan iborat bo\'lishi kerak');
      }
      
      if (!data.agreeToTerms || !data.agreeToPrivacy) {
        throw new Error('Shartlarga rozi bo\'lishingiz kerak');
      }
      
      // Mock API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create new user
      const newUser: ChatUserProfile = {
        id: `user_${Date.now()}`,
        username: data.username,
        displayName: data.displayName,
        email: data.email,
        phone: data.phone,
        location: {
          region: data.region,
          city: data.city
        },
        interests: [],
        languages: ['uz'],
        hobbies: [],
        isEmailVerified: false,
        isPhoneVerified: !!data.phone,
        isLocationVerified: false,
        isVerified: false,
        verificationLevel: 'basic',
        isOnline: true,
        lastSeen: new Date(),
        status: 'online',
        privacySettings: {
          showEmail: false,
          showPhone: false,
          showLocation: true,
          showLastSeen: true,
          allowDirectMessages: true,
          allowLocationSharing: true,
          allowProfileView: 'everyone'
        },
        notificationSettings: {
          messageNotifications: true,
          mentionNotifications: true,
          roomInvitations: true,
          systemNotifications: true,
          soundEnabled: true,
          vibrationEnabled: true,
          desktopNotifications: true,
          emailNotifications: false
        },
        chatPreferences: {
          autoJoinLocalRooms: true,
          showOnlineStatus: true,
          messageSound: 'default',
          theme: 'auto',
          fontSize: 'medium',
          language: 'uz',
          autoTranslate: false
        },
        securitySettings: {
          twoFactorEnabled: false,
          loginAlerts: true,
          sessionTimeout: 30,
          allowedDevices: []
        },
        reputation: {
          score: 0,
          level: 1,
          badges: [],
          achievements: ['new_user'],
          warnings: 0,
          bans: []
        },
        activityStats: {
          messagesSent: 0,
          roomsJoined: 0,
          timeSpent: 0,
          lastActivity: new Date(),
          joinDate: new Date(),
          dailyAverage: 0,
          weeklyAverage: 0,
          monthlyAverage: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true,
        isBanned: false
      };
      
      // Generate verification code for email
      const emailCode = Math.random().toString(36).substr(2, 6).toUpperCase();
      const verificationCode: VerificationCode = {
        type: 'email',
        code: emailCode,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        attempts: 0
      };
      
      setVerificationCodes(prev => new Map(prev).set(newUser.email, verificationCode));
      
      setCurrentUser(newUser);
      
      toast.success('Ro\'yxatdan o\'tildi! Emailga tasdiqlash kodi yuborildi');
      return { success: true, user: newUser, needsVerification: true };
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ro\'yxatdan o\'tish xatolik');
      return { success: false, error: error instanceof Error ? error.message : 'Registration failed' };
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Verify email/phone
  const verifyCode = useCallback(async (email: string, code: string) => {
    const storedCode = verificationCodes.get(email);
    
    if (!storedCode) {
      throw new Error('Tasdiqlash kodi topilmadi');
    }
    
    if (storedCode.attempts >= 3) {
      throw new Error('Urunishlar soni tugadi. Qayta urinib ko\'ring');
    }
    
    if (storedCode.expiresAt < new Date()) {
      throw new Error('Tasdiqlash kodi muddati o\'tgan');
    }
    
    if (storedCode.code !== code) {
      storedCode.attempts++;
      throw new Error('Noto\'g\'ri kod');
    }
    
    // Update user verification status
    if (currentUser && currentUser.email === email) {
      const updatedUser = {
        ...currentUser,
        isEmailVerified: true,
        verificationLevel: (currentUser.isPhoneVerified ? 'standard' : 'basic') as 'basic' | 'standard' | 'premium',
        updatedAt: new Date()
      };
      
      setCurrentUser(updatedUser);
      setVerificationCodes(prev => {
        const newMap = new Map(prev);
        newMap.delete(email);
        return newMap;
      });
      
      toast.success('Email muvaffaqiyatli tasdiqlandi!');
      return { success: true };
    }
    
    throw new Error('Foydalanuvchi topilmadi');
  }, [verificationCodes, currentUser]);

  // Logout
  const logout = useCallback(() => {
    setCurrentUser(null);
    setAuthToken(null);
    
    // Clear localStorage
    localStorage.removeItem('chat_auth_token');
    localStorage.removeItem('chat_user_data');
    
    toast.success('Tizimdan chiqdingiz');
  }, []);

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<ChatUserProfile>) => {
    if (!currentUser) {
      throw new Error('Foydalanuvchi tizimga kirmagan');
    }
    
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const updatedUser = {
        ...currentUser,
        ...updates,
        updatedAt: new Date()
      };
      
      setCurrentUser(updatedUser);
      
      // Update localStorage if remember me is enabled
      if (authToken) {
        localStorage.setItem('chat_user_data', JSON.stringify(updatedUser));
      }
      
      toast.success('Profil muvaffaqiyatli yangilandi');
      return updatedUser;
      
    } catch (error) {
      toast.error('Profilni yangilashda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, authToken]);

  // Upload avatar
  const uploadAvatar = useCallback(async (file: File) => {
    if (!currentUser) {
      throw new Error('Foydalanuvchi tizimga kirmagan');
    }
    
    setIsLoading(true);
    
    try {
      // Mock upload
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const avatarUrl = `/avatars/${currentUser.id}_${Date.now()}.jpg`;
      
      await updateProfile({ avatar: avatarUrl });
      
      toast.success('Avatar muvaffaqiyatli yuklandi');
      return avatarUrl;
      
    } catch (error) {
      toast.error('Avatar yuklashda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, updateProfile]);

  // Change password
  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!currentUser) {
      throw new Error('Foydalanuvchi tizimga kirmagan');
    }
    
    setIsLoading(true);
    
    try {
      // Mock validation (in real app, validate current password)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (newPassword.length < 8) {
        throw new Error('Yangi parol kamida 8 ta belgidan iborat bo\'lishi kerak');
      }
      
      // Mock password change
      toast.success('Parol muvaffaqiyatli o\'zgartirildi');
      return { success: true };
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Parolni o\'zgartirishda xatolik');
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Check authentication status
  const checkAuthStatus = useCallback(() => {
    const token = localStorage.getItem('chat_auth_token');
    const userData = localStorage.getItem('chat_user_data');
    
    if (token && userData) {
      try {
        const user = JSON.parse(userData);
        setCurrentUser(user);
        setAuthToken(token);
        return true;
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('chat_auth_token');
        localStorage.removeItem('chat_user_data');
      }
    }
    
    return false;
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  return {
    currentUser,
    isLoading,
    authToken,
    login,
    register,
    logout,
    verifyCode,
    updateProfile,
    uploadAvatar,
    changePassword,
    checkAuthStatus
  };
}

export default function ChatUserProfileManager() {
  const {
    currentUser,
    isLoading,
    updateProfile,
    uploadAvatar,
    changePassword
  } = useChatAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<ChatUserProfile>>({});
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  if (!currentUser) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
        <div className="text-center py-12">
          <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">
            Profilni ko\'rish uchun tizimga kiring
          </p>
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    setEditData({
      displayName: currentUser.displayName,
      bio: currentUser.bio,
      phone: currentUser.phone,
      location: currentUser.location,
      interests: currentUser.interests,
      languages: currentUser.languages,
      hobbies: currentUser.hobbies,
      socialLinks: currentUser.socialLinks,
      customStatus: currentUser.customStatus
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      await updateProfile(editData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await uploadAvatar(file);
      } catch (error) {
        console.error('Error uploading avatar:', error);
      }
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Parollar mos kelmadi');
      return;
    }

    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setShowPasswordChange(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error changing password:', error);
    }
  };

  const getVerificationLevelColor = (level: string) => {
    switch (level) {
      case 'basic': return 'text-gray-600';
      case 'standard': return 'text-blue-600';
      case 'premium': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getVerificationLevelIcon = (level: string) => {
    switch (level) {
      case 'basic': return <Shield className="w-4 h-4" />;
      case 'standard': return <Star className="w-4 h-4" />;
      case 'premium': return <Crown className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <User className="w-6 h-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profil
          </h2>
        </div>
        
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Saqlash</span>
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center space-x-2"
              >
                <X className="w-4 h-4" />
                <span>Bekor qilish</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setShowPasswordChange(true)}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center space-x-2"
              >
                <Key className="w-4 h-4" />
                <span>Parol</span>
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Tahrirlash</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Profile Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Section */}
        <div className="lg:col-span-1">
          <div className="text-center">
            <div className="relative inline-block">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                {currentUser.avatar ? (
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.displayName}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  currentUser.displayName.charAt(0).toUpperCase()
                )}
              </div>
              
              {isEditing && (
                <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-2 rounded-full cursor-pointer hover:bg-blue-600">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mt-4">
              {currentUser.displayName}
            </h3>
            
            <p className="text-gray-600 dark:text-gray-400">
              @{currentUser.username}
            </p>
            
            <div className="flex items-center justify-center space-x-2 mt-2">
              {getVerificationLevelIcon(currentUser.verificationLevel)}
              <span className={`text-sm font-medium ${getVerificationLevelColor(currentUser.verificationLevel)}`}>
                {currentUser.verificationLevel === 'basic' && 'Asosiy'}
                {currentUser.verificationLevel === 'standard' && 'Standart'}
                {currentUser.verificationLevel === 'premium' && 'Premium'}
              </span>
              
              {currentUser.isVerified && (
                <Check className="w-4 h-4 text-blue-500" />
              )}
            </div>
            
            {/* Status */}
            <div className="flex items-center justify-center space-x-2 mt-3">
              <div className={`w-2 h-2 rounded-full ${
                currentUser.status === 'online' ? 'bg-green-500' :
                currentUser.status === 'away' ? 'bg-yellow-500' :
                currentUser.status === 'busy' ? 'bg-red-500' :
                'bg-gray-500'
              }`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentUser.status === 'online' && 'Onlayn'}
                {currentUser.status === 'away' && 'Uzoqda'}
                {currentUser.status === 'busy' && 'Band'}
                {currentUser.status === 'invisible' && 'Ko\'rinmas'}
                {currentUser.status === 'offline' && 'Oflayn'}
              </span>
            </div>
            
            {currentUser.customStatus && (
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                {currentUser.customStatus}
              </p>
            )}
          </div>
          
          {/* Quick Stats */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Reyting</span>
              <div className="flex items-center space-x-1">
                <Star className="w-4 h-4 text-yellow-400 fill-current" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {currentUser.reputation.score}
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Xabarlar</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {currentUser.activityStats.messagesSent.toLocaleString()}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-sm text-gray-600 dark:text-gray-400">Xonalar</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {currentUser.activityStats.roomsJoined}
              </span>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              Asosiy ma\'lumotlar
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ism
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.displayName || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{currentUser.displayName}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <p className="text-gray-900 dark:text-white">@{currentUser.username}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <p className="text-gray-900 dark:text-white">{currentUser.email}</p>
                  {currentUser.isEmailVerified && (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Telefon
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={editData.phone || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                ) : (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-900 dark:text-white">
                      {currentUser.phone || 'Kiritilmagan'}
                    </p>
                    {currentUser.phone && currentUser.isPhoneVerified && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                )}
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bio
                </label>
                {isEditing ? (
                  <textarea
                    value={editData.bio || ''}
                    onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {currentUser.bio || 'Bio kiritilmagan'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              Manzil
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Viloyat
                </label>
                {isEditing ? (
                  <select
                    value={editData.location?.region || ''}
                    onChange={(e) => setEditData(prev => ({
                      ...prev,
                      location: { ...prev.location, region: e.target.value || '' }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  >
                    <option value="">Viloyatni tanlang</option>
                    {/* Add regions here */}
                  </select>
                ) : (
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <p className="text-gray-900 dark:text-white">{currentUser.location.region}</p>
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Shahar
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.location?.city || ''}
                    onChange={(e) => setEditData(prev => ({
                      ...prev,
                      location: { ...prev.location, city: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {currentUser.location.city || 'Kiritilmagan'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Interests */}
          <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
              Qiziqishlar
            </h4>
            
            {isEditing ? (
              <div>
                <input
                  type="text"
                  placeholder="Qiziqishlarni vergul bilan ajrating"
                  value={editData.interests?.join(', ') || ''}
                  onChange={(e) => setEditData(prev => ({
                    ...prev,
                    interests: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {currentUser.interests.length > 0 ? (
                  currentUser.interests.map((interest, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                    >
                      {interest}
                    </span>
                  ))
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">Qiziqishlar kiritilmagan</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Parolni o\'zgartirish
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Joriy parol
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Yangi parol
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Yangi parolni tasdiqlang
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowPasswordChange(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Bekor qilish
              </button>
              <button
                onClick={handlePasswordChange}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                O\'zgartirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
