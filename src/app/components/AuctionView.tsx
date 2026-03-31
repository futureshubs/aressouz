import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { 
  Clock, 
  Gavel, 
  Users, 
  DollarSign, 
  Heart,
  AlertCircle,
  CheckCircle2,
  Grid3x3,
  Layers,
  Zap,
  TrendingUp,
  Award,
  Eye,
  FileText,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Package,
  ShoppingBag,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { useVisibilityRefetch } from '../utils/visibilityRefetch';
import { ProductGridSkeleton } from './skeletons';
import { Header } from './Header';
import { BottomNav } from './BottomNav';
import { AuctionDetailModal } from './AuctionDetailModal';

interface AuctionViewProps {
  onClose?: () => void;
  cartCount?: number;
  onCartClick?: () => void;
  onProfileClick?: () => void;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

interface Auction {
  id: string;
  branchId: string;
  name: string;
  description: string;
  category: string;
  images: string[];
  startPrice: number;
  maxPrice: number;
  currentPrice: number;
  participationFee: number;
  bidIncrementPercent: number;
  durationDays: number;
  endDate: string;
  status: string;
  totalBids: number;
  totalParticipants: number;
  participants: string[];
  createdAt: string;
  updatedAt: string;
  condition?: string;
  startingPrice?: number;
}

const CATEGORIES = [
  { id: 'all', label: 'Hammasi', emoji: '📦' },
  { id: 'electronics', label: 'Elektronika', emoji: '📱' },
  { id: 'furniture', label: 'Mebel', emoji: '🛋️' },
  { id: 'vehicles', label: 'Transport', emoji: '🚗' },
  { id: 'real_estate', label: 'Ko\'chmas mulk', emoji: '🏠' },
  { id: 'clothing', label: 'Kiyim-kechak', emoji: '👔' },
  { id: 'jewelry', label: 'Zargarlik', emoji: '💍' },
  { id: 'art', label: 'San\'at', emoji: '🎨' },
  { id: 'other', label: 'Boshqa', emoji: '📦' },
];

// Kataloglar ro'yxati
const CATALOGS = [
  { 
    id: 'electronics', 
    name: 'Elektronika', 
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400',
    itemCount: 245
  },
  { 
    id: 'furniture', 
    name: 'Mebel', 
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400',
    itemCount: 189
  },
  { 
    id: 'vehicles', 
    name: 'Transport', 
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400',
    itemCount: 156
  },
  { 
    id: 'real_estate', 
    name: 'Ko\'chmas mulk', 
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400',
    itemCount: 98
  },
  { 
    id: 'clothing', 
    name: 'Kiyim-kechak', 
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400',
    itemCount: 312
  },
  { 
    id: 'jewelry', 
    name: 'Zargarlik', 
    image: 'https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400',
    itemCount: 87
  },
  { 
    id: 'art', 
    name: 'San\'at', 
    image: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400',
    itemCount: 124
  },
  { 
    id: 'sports', 
    name: 'Sport buyumlari', 
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400',
    itemCount: 203
  },
];

export function AuctionView({ onClose, cartCount, onCartClick, onProfileClick, activeTab, onTabChange }: AuctionViewProps) {
  const { theme, accentColor } = useTheme();
  const { user } = useAuth();
  const isDark = theme === 'dark';

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [bidAmount, setBidAmount] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'auction' | 'catalog'>('auction');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Auction[]>([]);
  
  // Request form state
  const [requestData, setRequestData] = useState({
    productName: '',
    productDescription: '',
    category: '',
    estimatedPrice: '',
  });

  useEffect(() => {
    loadAuctions();
  }, [selectedCategory]);

  const loadAuctions = async () => {
    try {
      setLoading(true);
      const categoryParam = selectedCategory === 'all' ? '' : `&category=${selectedCategory}`;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions?status=active${categoryParam}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        setAuctions(data.auctions || []);
      } else {
        toast.error(data.error || 'Auksionlarni yuklashda xatolik');
      }
    } catch (error) {
      console.error('Error loading auctions:', error);
      toast.error('Auksionlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  useVisibilityRefetch(() => {
    void loadAuctions();
  });

  const getTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Tugagan';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) return `${days} kun ${hours} soat ${minutes} daqiqa`;
    if (hours > 0) return `${hours} soat ${minutes} daqiqa ${seconds} sekund`;
    if (minutes > 0) return `${minutes} daqiqa ${seconds} sekund`;
    return `${seconds} sekund`;
  };

  const calculateMinimumBid = (auction: Auction) => {
    return Math.ceil(auction.currentPrice * (1 + auction.bidIncrementPercent / 100));
  };

  const handleParticipate = async (auction: Auction) => {
    if (!user) {
      toast.error('Ishtirok etish uchun tizimga kiring');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${auction.id}/participate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            userName: user.name,
            userPhone: user.phone,
            paymentMethod: 'cash',
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Ishtirok to\'lovi qabul qilindi!');
        loadAuctions();
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error participating:', error);
      toast.error('Ishtirok etishda xatolik');
    }
  };

  const handlePlaceBid = async () => {
    if (!selectedAuction || !user) {
      toast.error('Tizimga kiring');
      return;
    }

    const amount = parseFloat(bidAmount);
    const minimumBid = calculateMinimumBid(selectedAuction);

    if (isNaN(amount) || amount < minimumBid) {
      toast.error(`Minimal taklif: ${minimumBid.toLocaleString()} so'm`);
      return;
    }

    if (amount > selectedAuction.maxPrice) {
      toast.error(`Maksimal narx: ${selectedAuction.maxPrice.toLocaleString()} so'm`);
      return;
    }

    try {
      setSubmittingBid(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${selectedAuction.id}/bid`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            userName: user.name,
            userPhone: user.phone,
            amount,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Taklifingiz qabul qilindi!');
        setBidAmount('');
        loadAuctions();
        setSelectedAuction(null);
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error placing bid:', error);
      toast.error('Taklif berishda xatolik');
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Tizimga kiring');
      return;
    }

    if (!requestData.productName || !requestData.category) {
      toast.error('Barcha majburiy maydonlarni to\'ldiring');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auction-requests`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.id,
            userName: user.name,
            userPhone: user.phone,
            productName: requestData.productName,
            productDescription: requestData.productDescription,
            category: requestData.category,
            estimatedPrice: parseFloat(requestData.estimatedPrice) || 0,
            images: [],
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('Arizangiz yuborildi!');
        setShowRequestForm(false);
        setRequestData({
          productName: '',
          productDescription: '',
          category: '',
          estimatedPrice: '',
        });
      } else {
        toast.error(data.error || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Ariza yuborishda xatolik');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto flex flex-col"
      style={{ background: isDark ? '#000000' : '#f9fafb' }}
    >
      {/* Real System Header */}
      <Header
        cartCount={cartCount || 0}
        onCartClick={onCartClick || (() => {})}
        onProfileClick={onProfileClick || (() => {})}
      />

      {/* Search and View Mode */}
      <div
        className="sticky top-[73px] z-30 border-b"
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="p-4">
          {/* View Mode Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('auction')}
              className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: viewMode === 'auction' 
                  ? `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`
                  : isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.03)',
                color: viewMode === 'auction' ? '#ffffff' : 'inherit',
                borderWidth: '1px',
                borderColor: viewMode === 'auction' 
                  ? accentColor.color 
                  : isDark 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.1)',
                boxShadow: viewMode === 'auction' ? `0 4px 16px ${accentColor.color}40` : 'none',
              }}
            >
              <Gavel className="w-4 h-4" />
              <span>Auksion</span>
            </button>
            <button
              onClick={() => setViewMode('catalog')}
              className="flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style={{
                background: viewMode === 'catalog' 
                  ? `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`
                  : isDark
                  ? 'rgba(255, 255, 255, 0.05)'
                  : 'rgba(0, 0, 0, 0.03)',
                color: viewMode === 'catalog' ? '#ffffff' : 'inherit',
                borderWidth: '1px',
                borderColor: viewMode === 'catalog' 
                  ? accentColor.color 
                  : isDark 
                  ? 'rgba(255, 255, 255, 0.1)' 
                  : 'rgba(0, 0, 0, 0.1)',
                boxShadow: viewMode === 'catalog' ? `0 4px 16px ${accentColor.color}40` : 'none',
              }}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Katalog</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* AUKSION VIEW */}
          {viewMode === 'auction' && (
            <>
              {loading ? (
                <ProductGridSkeleton
                  isDark={isDark}
                  count={6}
                  gridClassName="grid grid-cols-2 gap-3 sm:gap-4"
                />
              ) : auctions.length === 0 ? (
                <div
                  className="text-center py-20 rounded-3xl border"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(30, 30, 30, 1), rgba(20, 20, 20, 1))'
                      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark 
                      ? '0 8px 32px rgba(0, 0, 0, 0.4)' 
                      : '0 8px 32px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div
                    className="inline-flex p-4 rounded-2xl mb-4"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <Gavel className="w-12 h-12" style={{ color: accentColor.color }} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Auksionlar topilmadi</h3>
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Tez orada yangi auksionlar qo'shiladi
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {auctions.map((auction) => {
                    const timeRemaining = getTimeRemaining(auction.endDate);
                    const minimumBid = calculateMinimumBid(auction);
                    const isUserParticipating = user && auction.participants.includes(user.id);
                    
                    const priceIncrease = ((auction.currentPrice - auction.startPrice) / auction.startPrice * 100).toFixed(0);
                    const priceIncreaseAmount = auction.currentPrice - auction.startPrice;
                    
                    const conditions = ['Yangi', 'Yangi kabli', 'Ishlashi'];
                    const condition = auction.condition || conditions[Math.floor(Math.random() * conditions.length)];
                    
                    const isTopAuction = auction.totalBids > 15 || auction.currentPrice > 10000000;

                    return (
                      <div
                        key={auction.id}
                        onClick={() => setSelectedAuction(auction)}
                        className="rounded-2xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                        style={{
                          background: isDark
                            ? 'linear-gradient(145deg, rgba(30, 30, 30, 1), rgba(20, 20, 20, 1))'
                            : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
                          boxShadow: isDark 
                            ? '0 4px 20px rgba(0, 0, 0, 0.4)' 
                            : '0 4px 20px rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <div className="relative w-full aspect-square">
                          <img
                            src={auction.images[0]}
                            alt={auction.name}
                            className="w-full h-full object-cover"
                          />
                          
                          {isTopAuction && (
                            <div
                              className="absolute top-2 left-2 px-2 py-1 rounded-lg backdrop-blur-md flex items-center gap-1"
                              style={{ 
                                background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                                boxShadow: '0 4px 12px rgba(20, 184, 166, 0.4)'
                              }}
                            >
                              <span className="text-xs font-bold text-white">⭐ TOP</span>
                            </div>
                          )}
                          
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                            <div
                              className="px-2 py-1 rounded-lg backdrop-blur-md flex items-center gap-1"
                              style={{ background: 'rgba(0, 0, 0, 0.6)' }}
                            >
                              <Clock className="w-3 h-3 text-white" />
                              <span className="text-xs font-medium text-white">{timeRemaining}</span>
                            </div>
                            <div
                              className="px-2 py-1 rounded-lg backdrop-blur-md flex items-center gap-1"
                              style={{ background: 'rgba(0, 0, 0, 0.6)' }}
                            >
                              <Users className="w-3 h-3 text-white" />
                              <span className="text-xs font-medium text-white">{auction.totalBids}</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3">
                          <h3 className="text-sm font-bold mb-1.5 line-clamp-1">{auction.name}</h3>
                          
                          <div className="mb-2">
                            <span
                              className="inline-block px-2 py-0.5 rounded-md text-xs font-medium"
                              style={{
                                background: condition === 'Yangi' 
                                  ? `${accentColor.color}20` 
                                  : condition === 'Yangi kabli'
                                  ? 'rgba(34, 197, 94, 0.15)'
                                  : 'rgba(59, 130, 246, 0.15)',
                                color: condition === 'Yangi' 
                                  ? accentColor.color 
                                  : condition === 'Yangi kabli'
                                  ? '#22c55e'
                                  : '#3b82f6',
                              }}
                            >
                              {condition}
                            </span>
                          </div>
                          
                          <div className="mb-2">
                            <div
                              className="text-xs mb-0.5"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                            >
                              Joriy taklif
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-lg font-bold" style={{ color: accentColor.color }}>
                                {(auction.currentPrice / 1000).toFixed(3).replace('.', ',')}
                              </span>
                              <span className="text-xs" style={{ color: accentColor.color }}>so'm</span>
                            </div>
                            
                            {priceIncrease > '0' && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-xs font-medium" style={{ color: '#22c55e' }}>
                                  +{priceIncrease}% (+{(priceIncreaseAmount / 1000).toFixed(3).replace('.', ',')} so'm)
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAuction(auction);
                            }}
                            className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            style={{
                              background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                              color: 'white',
                              boxShadow: `0 4px 16px ${accentColor.color}40`,
                            }}
                          >
                            <Gavel className="w-4 h-4" />
                            <span>Taklif qilish</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* KATALOG VIEW - Kataloglar ro'yxati */}
          {viewMode === 'catalog' && !selectedCatalogId && (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {CATALOGS.map((catalog) => (
                <div
                  key={catalog.id}
                  onClick={() => setSelectedCatalogId(catalog.id)}
                  className="rounded-2xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(30, 30, 30, 1), rgba(20, 20, 20, 1))'
                      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark 
                      ? '0 4px 20px rgba(0, 0, 0, 0.4)' 
                      : '0 4px 20px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="relative w-full aspect-square">
                    <img
                      src={catalog.image}
                      alt={catalog.name}
                      className="w-full h-full object-cover"
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.7) 100%)',
                      }}
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <h3 className="text-lg font-bold text-white mb-1">{catalog.name}</h3>
                      <p className="text-sm text-white/80">{catalog.itemCount} mahsulot</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* KATALOG VIEW - Tanlangan katalog mahsulotlari */}
          {viewMode === 'catalog' && selectedCatalogId && (
            <>
              {/* Orqaga qaytish tugmasi */}
              <button
                onClick={() => setSelectedCatalogId(null)}
                className="flex items-center gap-2 mb-4 px-4 py-2 rounded-xl transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  borderWidth: '1px',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <ChevronLeft className="w-5 h-5" />
                <span className="font-medium">Orqaga</span>
              </button>

              {/* Katalog nomi */}
              <h2 className="text-2xl font-bold mb-6">
                {CATALOGS.find(c => c.id === selectedCatalogId)?.name}
              </h2>

              {/* Mahsulotlar (auksion mahsulotlaridan filter qilamiz) */}
              {auctions.filter(a => a.category === selectedCatalogId).length === 0 ? (
                <div
                  className="text-center py-20 rounded-3xl border"
                  style={{
                    background: isDark
                      ? 'linear-gradient(145deg, rgba(30, 30, 30, 1), rgba(20, 20, 20, 1))'
                      : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
                    boxShadow: isDark 
                      ? '0 8px 32px rgba(0, 0, 0, 0.4)' 
                      : '0 8px 32px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div
                    className="inline-flex p-4 rounded-2xl mb-4"
                    style={{ background: `${accentColor.color}20` }}
                  >
                    <Package className="w-12 h-12" style={{ color: accentColor.color }} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Mahsulotlar topilmadi</h3>
                  <p style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    Bu katalogda hali mahsulotlar yo'q
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {auctions.filter(a => a.category === selectedCatalogId).map((product) => (
                    <div
                      key={product.id}
                      onClick={() => setSelectedAuction(product)}
                      className="rounded-2xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                      style={{
                        background: isDark
                          ? 'linear-gradient(145deg, rgba(30, 30, 30, 1), rgba(20, 20, 20, 1))'
                          : 'linear-gradient(145deg, #ffffff, #f9fafb)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)',
                        boxShadow: isDark 
                          ? '0 4px 20px rgba(0, 0, 0, 0.4)' 
                          : '0 4px 20px rgba(0, 0, 0, 0.1)',
                      }}
                    >
                      <div className="relative w-full aspect-square">
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="p-3">
                        <h3 className="text-sm font-bold mb-2 line-clamp-2">{product.name}</h3>
                        
                        <div className="mb-3">
                          <div
                            className="text-xs mb-0.5"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                          >
                            Narx
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-lg font-bold" style={{ color: accentColor.color }}>
                              {(product.currentPrice / 1000).toFixed(3).replace('.', ',')}
                            </span>
                            <span className="text-xs" style={{ color: accentColor.color }}>so'm</span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAuction(product);
                          }}
                          className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{
                            background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                            color: 'white',
                            boxShadow: `0 4px 16px ${accentColor.color}40`,
                          }}
                        >
                          <ShoppingBag className="w-4 h-4" />
                          <span>Ko'rish</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab || 'auksion'}
        onTabChange={onTabChange || (() => {})}
      />

      {/* Auction Detail Modal - MOBILE STYLE */}
      {selectedAuction && (
        <AuctionDetailModal
          auction={selectedAuction}
          onClose={() => {
            setSelectedAuction(null);
            setSelectedImageIndex(0);
            setBidAmount('');
          }}
          onPlaceBid={async (amount: string) => {
            const amountNum = parseFloat(amount);
            const minimumBid = calculateMinimumBid(selectedAuction);

            if (isNaN(amountNum) || amountNum < minimumBid) {
              toast.error(`Minimal taklif: ${minimumBid.toLocaleString()} so'm`);
              throw new Error('Invalid bid amount');
            }

            if (amountNum > selectedAuction.maxPrice) {
              toast.error(`Maksimal narx: ${selectedAuction.maxPrice.toLocaleString()} so'm`);
              throw new Error('Bid exceeds maximum');
            }

            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/auctions/${selectedAuction.id}/bid`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${publicAnonKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  userId: user?.id,
                  userName: user?.name,
                  userPhone: user?.phone,
                  amount: amountNum,
                }),
              }
            );

            const data = await response.json();
            if (data.success) {
              toast.success('Taklifingiz qabul qilindi!');
              await loadAuctions();
              setSelectedAuction(null);
            } else {
              toast.error(data.error || 'Xatolik yuz berdi');
              throw new Error(data.error);
            }
          }}
          onParticipate={() => handleParticipate(selectedAuction)}
          getTimeRemaining={getTimeRemaining}
          calculateMinimumBid={calculateMinimumBid}
        />
      )}

      {/* Request Form Modal */}
      {showRequestForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setShowRequestForm(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border p-6"
            style={{
              background: isDark ? '#0a0a0a' : '#ffffff',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold mb-6">Auksion Arizasi</h2>

            <form onSubmit={handleSubmitRequest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Mahsulot nomi <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={requestData.productName}
                  onChange={(e) =>
                    setRequestData({ ...requestData, productName: e.target.value })
                  }
                  placeholder="Mahsulot nomini kiriting"
                  className="w-full px-4 py-3 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Ta'rif</label>
                <textarea
                  value={requestData.productDescription}
                  onChange={(e) =>
                    setRequestData({ ...requestData, productDescription: e.target.value })
                  }
                  placeholder="Mahsulot haqida ma'lumot..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border outline-none resize-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Kategoriya <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setRequestData({ ...requestData, category: cat.id })}
                      className="p-3 rounded-xl border transition-all"
                      style={{
                        background:
                          requestData.category === cat.id
                            ? accentColor.gradient
                            : isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.03)',
                        borderColor:
                          requestData.category === cat.id
                            ? accentColor.color
                            : isDark
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.1)',
                        color: requestData.category === cat.id ? '#ffffff' : 'inherit',
                      }}
                    >
                      <div className="text-2xl mb-1">{cat.emoji}</div>
                      <div className="text-xs font-medium">{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Taxminiy narx (so'm)</label>
                <input
                  type="number"
                  value={requestData.estimatedPrice}
                  onChange={(e) =>
                    setRequestData({ ...requestData, estimatedPrice: e.target.value })
                  }
                  placeholder="0"
                  className="w-full px-4 py-3 rounded-xl border outline-none"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="flex-1 py-3 rounded-xl font-bold border transition-all active:scale-95"
                  style={{
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl font-bold transition-all active:scale-95"
                  style={{
                    background: accentColor.gradient,
                    color: '#ffffff',
                  }}
                >
                  Yuborish
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}