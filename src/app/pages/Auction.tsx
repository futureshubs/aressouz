import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { X, Clock, Gavel, Users, DollarSign, Heart, AlertCircle, CheckCircle2, Grid3x3, Layers, Zap, TrendingUp, Award, Eye, Sparkles, Flame } from 'lucide-react';

interface AuctionItem {
  id: string;
  title: string;
  description: string;
  image: string;
  startingPrice: number;
  currentBid: number;
  minimumBid: number;
  bidCount: number;
  endTime: Date;
  category: string;
  seller: string;
  condition: string;
  isLiked?: boolean;
  views: number;
  isHot?: boolean;
}

interface Bid {
  auctionId: string;
  amount: number;
  timestamp: Date;
}

interface AuctionProps {
  onClose?: () => void;
}

const CATEGORIES = [
  { id: 'all', name: 'Hammasi', icon: Grid3x3, count: 8 },
  { id: 'Elektronika', name: 'Elektronika', icon: Zap, count: 2 },
  { id: 'Kompyuterlar', name: 'Kompyuterlar', icon: Layers, count: 1 },
  { id: 'Foto', name: 'Foto', icon: Eye, count: 2 },
  { id: 'Smart soatlar', name: 'Smart soatlar', icon: TrendingUp, count: 1 },
  { id: 'Gaming', name: 'Gaming', icon: Award, count: 1 },
  { id: 'Planshetlar', name: 'Planshetlar', icon: Grid3x3, count: 1 },
];

const MOCK_AUCTIONS: AuctionItem[] = [
  {
    id: 'auction-1',
    title: 'iPhone 14 Pro Max 256GB',
    description: 'Yangi holatda, barcha aksessuarlar bilan. Kafolat muddati 11 oy qolgan. Hech qanday tirnalish yoki nuqsonlar yo\'q.',
    image: 'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?w=800&q=80',
    startingPrice: 8000000,
    currentBid: 11500000,
    minimumBid: 100000,
    bidCount: 23,
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
    category: 'Elektronika',
    seller: 'TechStore_uz',
    condition: 'Yangi',
    views: 1247,
    isHot: true,
  },
  {
    id: 'auction-2',
    title: 'MacBook Pro M2 14" 512GB',
    description: '2023 yil modeli, ideal holatda. Faqat 3 oy ishlatilgan. Original qadoq va zaryadlovchi bilan.',
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80',
    startingPrice: 15000000,
    currentBid: 18900000,
    minimumBid: 200000,
    bidCount: 45,
    endTime: new Date(Date.now() + 5 * 60 * 60 * 1000),
    category: 'Kompyuterlar',
    seller: 'Premium_Tech',
    condition: 'Yangi kabi',
    views: 2156,
  },
  {
    id: 'auction-3',
    title: 'Sony A7 IV Camera Body',
    description: 'Professional kamera, juda kam ishlatilgan. Barcha original aksessuarlar va qo\'shimcha battereyalar.',
    image: 'https://images.unsplash.com/photo-1606980702781-fdf00c0f5c3a?w=800&q=80',
    startingPrice: 20000000,
    currentBid: 24500000,
    minimumBid: 300000,
    bidCount: 18,
    endTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
    category: 'Foto',
    seller: 'PhotoPro_Shop',
    condition: 'Yangi',
    views: 876,
    isHot: true,
  },
  {
    id: 'auction-4',
    title: 'Apple Watch Ultra',
    description: 'Titanium korpus, barcha sport bandalari bilan. 6 oy ishlatilgan, ideal holatda.',
    image: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=800&q=80',
    startingPrice: 5000000,
    currentBid: 6800000,
    minimumBid: 100000,
    bidCount: 31,
    endTime: new Date(Date.now() + 12 * 60 * 60 * 1000),
    category: 'Smart soatlar',
    seller: 'WatchMaster',
    condition: 'Yaxshi',
    views: 1543,
  },
  {
    id: 'auction-5',
    title: 'PlayStation 5 + 5ta o\'yin',
    description: 'Disk versiya, qo\'shimcha controller va 5ta premium o\'yin. 1 yil ishlatilgan.',
    image: 'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&q=80',
    startingPrice: 4000000,
    currentBid: 5200000,
    minimumBid: 100000,
    bidCount: 67,
    endTime: new Date(Date.now() + 8 * 60 * 60 * 1000),
    category: 'Gaming',
    seller: 'GameZone_uz',
    condition: 'Yaxshi',
    views: 3421,
    isHot: true,
  },
  {
    id: 'auction-6',
    title: 'iPad Pro 12.9" M2 WiFi 256GB',
    description: 'Space Gray, Magic Keyboard va Apple Pencil 2 bilan. 4 oy ishlatilgan.',
    image: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80',
    startingPrice: 10000000,
    currentBid: 12300000,
    minimumBid: 150000,
    bidCount: 28,
    endTime: new Date(Date.now() + 18 * 60 * 60 * 1000),
    category: 'Planshetlar',
    seller: 'TechStore_uz',
    condition: 'Yangi kabi',
    views: 987,
  },
  {
    id: 'auction-7',
    title: 'Canon EOS R5 + 24-70mm f/2.8',
    description: 'Professional to\'plam, juda kam ishlatilgan. Barcha karobkalar va garantiya.',
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80',
    startingPrice: 35000000,
    currentBid: 38500000,
    minimumBid: 500000,
    bidCount: 12,
    endTime: new Date(Date.now() + 36 * 60 * 60 * 1000),
    category: 'Foto',
    seller: 'PhotoPro_Shop',
    condition: 'Yangi',
    views: 654,
  },
  {
    id: 'auction-8',
    title: 'Samsung Galaxy S24 Ultra 512GB',
    description: 'Phantom Black rang, S Pen bilan. 2 oy ishlatilgan, ideal holat.',
    image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800&q=80',
    startingPrice: 9000000,
    currentBid: 10200000,
    minimumBid: 100000,
    bidCount: 34,
    endTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
    category: 'Elektronika',
    seller: 'TechStore_uz',
    condition: 'Yangi kabi',
    views: 1876,
  },
];

export default function Auction({ onClose }: AuctionProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'auction' | 'catalog'>('auction');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [showBidSuccess, setShowBidSuccess] = useState(false);

  // Load data from localStorage
  useEffect(() => {
    const savedBids = localStorage.getItem('auctionBids');
    const savedAuctions = localStorage.getItem('auctionData');
    
    if (savedBids) {
      setMyBids(JSON.parse(savedBids));
    }
    
    if (savedAuctions) {
      const parsed = JSON.parse(savedAuctions);
      setAuctions(parsed.map((a: any) => ({
        ...a,
        endTime: new Date(a.endTime),
      })));
    } else {
      setAuctions(MOCK_AUCTIONS);
      localStorage.setItem('auctionData', JSON.stringify(MOCK_AUCTIONS));
    }
  }, []);

  // Update countdown every second
  useEffect(() => {
    const interval = setInterval(() => {
      setAuctions(prev => [...prev]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Filter auctions by category
  const filteredAuctions = selectedCategory === 'all' 
    ? auctions 
    : selectedCategory === 'ending'
    ? auctions.filter(a => a.endTime.getTime() - Date.now() < 60 * 60 * 1000)
    : selectedCategory === 'hot'
    ? auctions.filter(a => a.isHot)
    : selectedCategory === 'popular'
    ? auctions.filter(a => a.bidCount > 30)
    : auctions.filter(a => a.category === selectedCategory);

  const getTimeRemaining = (endTime: Date) => {
    const now = new Date();
    const diff = endTime.getTime() - now.getTime();
    
    if (diff <= 0) return 'Tugadi';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    if (days > 0) return `${days}k ${hours}s`;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleBid = () => {
    if (!selectedAuction) return;
    
    const amount = parseInt(bidAmount.replace(/\s/g, ''));
    const minRequired = selectedAuction.currentBid + selectedAuction.minimumBid;
    
    if (isNaN(amount) || amount < minRequired) {
      alert(`Minimal taklif: ${minRequired.toLocaleString()} so'm`);
      return;
    }
    
    // Update auction
    const updatedAuctions = auctions.map(a => 
      a.id === selectedAuction.id 
        ? { ...a, currentBid: amount, bidCount: a.bidCount + 1 }
        : a
    );
    setAuctions(updatedAuctions);
    localStorage.setItem('auctionData', JSON.stringify(updatedAuctions));
    
    // Save bid
    const newBid: Bid = {
      auctionId: selectedAuction.id,
      amount,
      timestamp: new Date(),
    };
    const updatedBids = [...myBids, newBid];
    setMyBids(updatedBids);
    localStorage.setItem('auctionBids', JSON.stringify(updatedBids));
    
    // Update selected auction
    setSelectedAuction({ ...selectedAuction, currentBid: amount, bidCount: selectedAuction.bidCount + 1 });
    setBidAmount('');
    
    // Show success
    setShowBidSuccess(true);
    setTimeout(() => setShowBidSuccess(false), 3000);
  };

  const toggleLike = (id: string) => {
    const updated = auctions.map(a => 
      a.id === id ? { ...a, isLiked: !a.isLiked } : a
    );
    setAuctions(updated);
  };

  const handleQuickBid = (multiplier: number) => {
    if (!selectedAuction) return;
    const amount = selectedAuction.currentBid + (selectedAuction.minimumBid * multiplier);
    setBidAmount(amount.toLocaleString());
  };

  return (
    <div 
      className="min-h-screen"
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 50%, #ffffff 100%)',
      }}
    >
      {/* Header */}
      <div 
        className="sticky top-0 z-40 backdrop-blur-xl border-b"
        style={{
          background: isDark 
            ? 'rgba(10, 10, 10, 0.9)' 
            : 'rgba(255, 255, 255, 0.9)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          {/* Tabs */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setActiveTab('auction')}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300"
              style={{
                background: activeTab === 'auction' 
                  ? `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`
                  : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: activeTab === 'auction' ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'),
                boxShadow: activeTab === 'auction' ? `0 4px 16px ${accentColor.color}40` : 'none',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <Gavel className="size-4" />
                Auksion
              </div>
            </button>

            <button
              onClick={() => setActiveTab('catalog')}
              className="flex-1 py-3 px-4 rounded-xl font-bold text-sm transition-all duration-300"
              style={{
                background: activeTab === 'catalog' 
                  ? `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`
                  : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: activeTab === 'catalog' ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)'),
                boxShadow: activeTab === 'catalog' ? `0 4px 16px ${accentColor.color}40` : 'none',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <Layers className="size-4" />
                Kataloglar
              </div>
            </button>
          </div>

          {/* Filter - only show in auction tab */}
          {activeTab === 'auction' && (
            <div className="overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              <div className="flex gap-2 min-w-max">
                {['all', 'ending', 'hot', 'popular'].map((filterId) => {
                  const filters = {
                    all: { name: 'Hammasi', icon: Grid3x3, count: filteredAuctions.length },
                    ending: { name: 'Oz vaqt qolgan', icon: Clock, count: filteredAuctions.filter(a => a.endTime.getTime() - Date.now() < 60 * 60 * 1000).length },
                    hot: { name: 'TOP aksiya', icon: Flame, count: filteredAuctions.filter(a => a.isHot).length },
                    popular: { name: 'Ko\'p taklif', icon: TrendingUp, count: filteredAuctions.filter(a => a.bidCount > 30).length },
                  };
                  
                  const filter = filters[filterId as keyof typeof filters];
                  const Icon = filter.icon;
                  const isActive = selectedCategory === filterId;
                  
                  return (
                    <button
                      key={filterId}
                      onClick={() => setSelectedCategory(filterId)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold text-xs transition-all duration-300 active:scale-95 whitespace-nowrap"
                      style={{
                        background: isActive
                          ? accentColor.color
                          : isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        color: isActive ? '#ffffff' : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)'),
                        boxShadow: isActive ? `0 2px 8px ${accentColor.color}40` : 'none',
                      }}
                    >
                      <Icon className="size-3.5" />
                      {filter.name}
                      <span 
                        className="px-1.5 py-0.5 rounded text-xs font-black"
                        style={{
                          background: isActive ? 'rgba(255, 255, 255, 0.25)' : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                        }}
                      >
                        {filter.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Auction View */}
        {activeTab === 'auction' && (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {filteredAuctions.map((auction) => {
              const timeRemaining = getTimeRemaining(auction.endTime);
              const isEnding = auction.endTime.getTime() - Date.now() < 60 * 60 * 1000;
              const priceIncrease = ((auction.currentBid - auction.startingPrice) / auction.startingPrice * 100).toFixed(0);
              const priceIncreaseAmount = auction.currentBid - auction.startingPrice;
              
              return (
                <div
                  key={auction.id}
                  className="group"
                >
                  <div 
                    className="rounded-xl sm:rounded-2xl overflow-hidden transition-all duration-300"
                    style={{
                      background: isDark 
                        ? 'linear-gradient(145deg, rgba(40, 40, 40, 0.95), rgba(30, 30, 30, 0.95))'
                        : 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(245, 245, 245, 0.95))',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                      boxShadow: isDark
                        ? '0 2px 12px rgba(0, 0, 0, 0.5)'
                        : '0 2px 12px rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    {/* Image Section */}
                    <div 
                      className="relative aspect-square overflow-hidden cursor-pointer"
                      onClick={() => setSelectedAuction(auction)}
                    >
                      <img 
                        src={auction.image} 
                        alt={auction.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                      
                      {/* TOP badge */}
                      {auction.isHot && (
                        <div 
                          className="absolute top-2 left-2 px-2 py-1 rounded-full backdrop-blur-xl flex items-center gap-1"
                          style={{
                            background: accentColor.color,
                            boxShadow: `0 2px 8px ${accentColor.color}60`,
                          }}
                        >
                          <Sparkles className="size-2.5 text-white" />
                          <span className="text-xs font-black text-white">TOP</span>
                        </div>
                      )}
                      
                      {/* Like button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(auction.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-full backdrop-blur-xl transition-all duration-300 active:scale-90"
                        style={{
                          background: 'rgba(0, 0, 0, 0.4)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                        }}
                      >
                        <Heart 
                          className="size-3.5"
                          fill={auction.isLiked ? '#ffffff' : 'none'}
                          style={{ color: '#ffffff' }}
                        />
                      </button>

                      {/* Bottom stats overlay */}
                      <div 
                        className="absolute bottom-0 left-0 right-0 p-2 backdrop-blur-xl flex items-center gap-2.5"
                        style={{
                          background: 'rgba(0, 0, 0, 0.6)',
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <Clock className="size-3 text-white" />
                          <span className="text-xs font-bold text-white">
                            {timeRemaining}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="size-3 text-white" />
                          <span className="text-xs font-bold text-white">
                            {auction.bidCount}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Info Section */}
                    <div className="p-2.5">
                      {/* Title */}
                      <h3 
                        className="text-xs sm:text-sm font-bold mb-1.5 line-clamp-2 leading-tight"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      >
                        {auction.title}
                      </h3>

                      {/* Status badge */}
                      <div 
                        className="inline-block px-2 py-0.5 rounded-md mb-1.5"
                        style={{
                          background: `${accentColor.color}20`,
                          border: `1px solid ${accentColor.color}40`,
                        }}
                      >
                        <span 
                          className="text-xs font-bold"
                          style={{ color: accentColor.color }}
                        >
                          {auction.condition}
                        </span>
                      </div>

                      {/* Label */}
                      <div 
                        className="text-xs mb-0.5"
                        style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                      >
                        Joriy taklif
                      </div>

                      {/* Price */}
                      <div className="mb-1.5">
                        <div className="flex items-baseline gap-1">
                          <span 
                            className="text-lg sm:text-xl font-black"
                            style={{ color: accentColor.color }}
                          >
                            {auction.currentBid.toLocaleString('uz-UZ')}
                          </span>
                          <span 
                            className="text-xs font-bold"
                            style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}
                          >
                            so'm
                          </span>
                        </div>
                      </div>

                      {/* Price increase */}
                      <div 
                        className="text-xs mb-2 font-semibold"
                        style={{ color: '#22c55e' }}
                      >
                        +{priceIncrease}% (+{priceIncreaseAmount.toLocaleString('uz-UZ')} so'm)
                      </div>

                      {/* Bid button */}
                      <button
                        onClick={() => setSelectedAuction(auction)}
                        className="w-full py-2 rounded-lg sm:rounded-xl font-bold text-xs transition-all duration-300 active:scale-95 flex items-center justify-center gap-1.5"
                        style={{
                          background: accentColor.color,
                          boxShadow: `0 2px 12px ${accentColor.color}40`,
                          color: '#ffffff',
                        }}
                      >
                        <Gavel className="size-3.5" />
                        Taklif qilish
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Catalog View */}
        {activeTab === 'catalog' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {CATEGORIES.map((category) => {
                const Icon = category.icon;
                const isActive = selectedCategory === category.id;
                
                return (
                  <button
                    key={category.id}
                    onClick={() => {
                      setSelectedCategory(category.id);
                      setActiveTab('auction');
                    }}
                    className="group relative overflow-hidden rounded-2xl transition-all duration-300 active:scale-95"
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`
                        : isDark 
                          ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))'
                          : 'linear-gradient(145deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.03))',
                      border: isActive 
                        ? `2px solid ${accentColor.color}`
                        : isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                      boxShadow: isActive 
                        ? `0 8px 24px ${accentColor.color}40`
                        : isDark ? '0 4px 16px rgba(0, 0, 0, 0.3)' : '0 4px 16px rgba(0, 0, 0, 0.06)',
                    }}
                  >
                    <div className="relative z-10 p-6 text-center">
                      <div 
                        className="inline-flex p-4 rounded-2xl mb-3 transition-all duration-300"
                        style={{
                          background: isActive 
                            ? 'rgba(255, 255, 255, 0.2)'
                            : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <Icon 
                          className="size-8"
                          style={{ color: isActive ? '#ffffff' : accentColor.color }}
                          strokeWidth={2.5}
                        />
                      </div>
                      <h3 
                        className="text-sm font-bold mb-1"
                        style={{ color: isActive ? '#ffffff' : (isDark ? '#ffffff' : '#000000') }}
                      >
                        {category.name}
                      </h3>
                      <p 
                        className="text-xs font-medium"
                        style={{ color: isActive ? 'rgba(255,255,255,0.8)' : (isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)') }}
                      >
                        {category.count} ta auksion
                      </p>
                    </div>

                    {/* Glow effect */}
                    {isActive && (
                      <div 
                        className="absolute inset-0 opacity-50"
                        style={{
                          background: `radial-gradient(circle at center, ${accentColor.color}40, transparent 70%)`,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedAuction && (
        <div 
          className="fixed inset-0 app-safe-pad z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
          }}
          onClick={() => setSelectedAuction(null)}
        >
          <div 
            className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, #1a1a1a, #0f0f0f)'
                : 'linear-gradient(145deg, #ffffff, #f5f5f5)',
              boxShadow: isDark
                ? '0 20px 60px rgba(0, 0, 0, 0.9)'
                : '0 20px 60px rgba(0, 0, 0, 0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success message */}
            {showBidSuccess && (
              <div 
                className="absolute top-4 left-4 right-4 z-10 p-4 rounded-2xl backdrop-blur-xl flex items-center gap-3"
                style={{
                  background: 'rgba(34, 197, 94, 0.95)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  animation: 'slideDown 0.3s ease-out',
                }}
              >
                <CheckCircle2 className="size-5 text-white" />
                <span className="text-sm font-bold text-white">
                  Taklifingiz muvaffaqiyatli qabul qilindi! 🎉
                </span>
              </div>
            )}
            
            {/* Close button */}
            <button
              onClick={() => setSelectedAuction(null)}
              className="absolute top-4 right-4 z-10 p-2.5 rounded-full backdrop-blur-xl transition-all duration-300 active:scale-90"
              style={{
                background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <X className="size-5" style={{ color: isDark ? '#ffffff' : '#000000' }} />
            </button>
            
            {/* Image */}
            <div className="relative aspect-[16/10] overflow-hidden">
              <img 
                src={selectedAuction.image} 
                alt={selectedAuction.title}
                className="w-full h-full object-cover"
              />
              <div 
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
                }}
              />
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Title & Seller */}
              <div className="mb-6">
                <h2 
                  className="text-2xl font-black mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  {selectedAuction.title}
                </h2>
                <div className="flex items-center gap-2">
                  <span 
                    className="text-sm"
                    style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
                  >
                    Sotuvchi:
                  </span>
                  <span 
                    className="text-sm font-bold"
                    style={{ color: accentColor.color }}
                  >
                    @{selectedAuction.seller}
                  </span>
                </div>
              </div>
              
              {/* Current bid & Time */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div 
                  className="p-4 rounded-2xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="size-4" style={{ color: accentColor.color }} />
                    <span 
                      className="text-xs font-semibold"
                      style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
                    >
                      Joriy narx
                    </span>
                  </div>
                  <div className="text-2xl font-black" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {selectedAuction.currentBid.toLocaleString()}
                  </div>
                  <div 
                    className="text-xs mt-1"
                    style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                  >
                    so'm
                  </div>
                </div>
                
                <div 
                  className="p-4 rounded-2xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="size-4" style={{ color: accentColor.color }} />
                    <span 
                      className="text-xs font-semibold"
                      style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
                    >
                      Qolgan vaqt
                    </span>
                  </div>
                  <div className="text-2xl font-black" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    {getTimeRemaining(selectedAuction.endTime)}
                  </div>
                  <div 
                    className="text-xs mt-1"
                    style={{ color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)' }}
                  >
                    {selectedAuction.bidCount} taklif
                  </div>
                </div>
              </div>
              
              {/* Description */}
              <div className="mb-6">
                <h3 
                  className="text-sm font-bold mb-2"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  Ta'rif
                </h3>
                <p 
                  className="text-sm leading-relaxed"
                  style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)' }}
                >
                  {selectedAuction.description}
                </p>
              </div>
              
              {/* Info */}
              <div 
                className="p-4 rounded-2xl mb-6 flex items-start gap-3"
                style={{
                  background: `${accentColor.color}10`,
                  border: `1px solid ${accentColor.color}30`,
                }}
              >
                <AlertCircle className="size-5 flex-shrink-0 mt-0.5" style={{ color: accentColor.color }} />
                <div>
                  <div className="text-sm font-bold mb-1" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                    Minimal oshirish: {selectedAuction.minimumBid.toLocaleString()} so'm
                  </div>
                  <div 
                    className="text-xs"
                    style={{ color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }}
                  >
                    Yangi taklifingiz kamida {(selectedAuction.currentBid + selectedAuction.minimumBid).toLocaleString()} so'm bo'lishi kerak
                  </div>
                </div>
              </div>
              
              {/* Quick bid buttons */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[1, 2, 5].map((multiplier) => (
                  <button
                    key={multiplier}
                    onClick={() => handleQuickBid(multiplier)}
                    className="py-2.5 rounded-xl font-bold text-sm transition-all duration-300 active:scale-95"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                      border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(0, 0, 0, 0.1)',
                      color: isDark ? '#ffffff' : '#000000',
                    }}
                  >
                    +{(selectedAuction.minimumBid * multiplier).toLocaleString()}
                  </button>
                ))}
              </div>
              
              {/* Bid input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={bidAmount}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setBidAmount(value ? parseInt(value).toLocaleString() : '');
                  }}
                  placeholder={`Taklifingiz (min: ${(selectedAuction.currentBid + selectedAuction.minimumBid).toLocaleString()})`}
                  className="w-full px-4 py-4 rounded-2xl text-base font-bold outline-none transition-all duration-300"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    border: `2px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                />
              </div>
              
              {/* Submit button */}
              <button
                onClick={handleBid}
                className="w-full py-4 rounded-2xl font-black text-base transition-all duration-300 active:scale-95 flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                  boxShadow: `0 8px 24px ${accentColor.color}60`,
                  color: '#ffffff',
                }}
              >
                <Gavel className="size-5" />
                Taklif Berish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}