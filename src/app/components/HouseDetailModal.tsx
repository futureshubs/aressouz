import { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin, BedDouble, Bath, Maximize2, Phone, MessageCircle, Building2, Layers, Calendar, Home, Car, Sofa, ArrowUpDown, Wind, Building, DollarSign, User, Send, Check, Image, Box, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { House, formatCurrency, calculatePayment, paymentPlans } from '../data/houses';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { PannellumViewer } from './PannellumViewer';
import { useVisibilityTick } from '../utils/visibilityRefetch';

interface HouseDetailModalProps {
  house: House;
  isOpen: boolean;
  onClose: () => void;
}

export function HouseDetailModal({ house, isOpen, onClose }: HouseDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const visibilityTick = useVisibilityTick();

  /** Bir xil rasm URL takrorlansa (server/client xato) — galereyada bitta marta */
  const galleryImages = useMemo(() => {
    const raw = Array.isArray(house.images) ? house.images : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const x of raw) {
      const s = String(x ?? '').trim();
      if (!s || seen.has(s)) continue;
      seen.add(s);
      out.push(s);
    }
    return out;
  }, [house.id, house.images]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'gallery' | '3d'>('gallery');
  const [paymentTab, setPaymentTab] = useState<'naqd' | 'kredit' | 'ipoteka' | 'halal'>('naqd');
  const [selectedYears, setSelectedYears] = useState(3);
  const [downPaymentPercent, setDownPaymentPercent] = useState(30);
  const [showBankApplicationModal, setShowBankApplicationModal] = useState(false);
  const [availableBanks, setAvailableBanks] = useState<any[]>([]);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [isSubmittingApplication, setIsSubmittingApplication] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [imageScale, setImageScale] = useState(1);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });

  // Calculate payment based on selected bank or house defaults
  const getPaymentRate = () => {
    if (paymentTab === 'ipoteka' && selectedBank) {
      return selectedBank.mortgagePercent || 18;
    }
    if (paymentTab === 'kredit') {
      return house.creditInterestRate || 0;
    }
    return 18;
  };
  
  const getMinDownPayment = () => {
    if (paymentTab === 'ipoteka' && selectedBank) {
      return selectedBank.minDownPayment || 30;
    }
    return house.initialPayment || 20;
  };

  const currentRate = getPaymentRate();
  const minDownPayment = getMinDownPayment();
  const payment = calculatePayment(house.price, downPaymentPercent, selectedYears, currentRate);

  // Reset down payment when bank changes
  useEffect(() => {
    if (paymentTab === 'ipoteka' && selectedBank) {
      setDownPaymentPercent(selectedBank.minDownPayment || 30);
    }
  }, [selectedBank, paymentTab]);

  useEffect(() => {
    const root = document.documentElement;
    if (isOpen) {
      root.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      setCurrentImageIndex(0);
      // Set initial payment tab based on available options
      if (house.hasHalalInstallment) {
        setPaymentTab('halal');
      } else if (house.mortgageAvailable) {
        setPaymentTab('ipoteka');
      } else {
        setPaymentTab('naqd');
      }
    } else {
      root.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      root.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  /** Ochish, boshqa uy tanlanganda va tabdan qaytganda banklar; galereya indeksini bu buzmaydi */
  useEffect(() => {
    if (!isOpen) return;
    void loadAvailableBanks();
  }, [isOpen, visibilityTick, house.id, house.region]);

  useEffect(() => {
    setCurrentImageIndex(0);
  }, [house.id]);

  // Handle ESC key for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        closeFullscreen();
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (!isOpen) {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }
    };
  }, [isFullscreen, isOpen]);

  // Galereya: Swiper uslubida har 3 s da keyingi rasm (faqat galereya rejimi, to‘liq ekran emas)
  const galleryImageCount = galleryImages.length;
  useEffect(() => {
    if (!isOpen || galleryImageCount < 2 || viewMode !== 'gallery' || isFullscreen) {
      return;
    }

    let id: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (id != null) window.clearInterval(id);
      id = window.setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % galleryImageCount);
      }, 3000);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (id != null) window.clearInterval(id);
        id = undefined;
      } else {
        start();
      }
    };

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (id != null) window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isOpen, galleryImageCount, viewMode, isFullscreen, house.id]);

  // Load available banks
  const loadAvailableBanks = async () => {
    try {
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banks`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Filter banks by region if house has region info
        const filteredBanks = data.banks?.filter((bank: any) => 
          !bank.viloyat || bank.viloyat === house.region
        ) || [];
        setAvailableBanks(filteredBanks);
        // Auto-select first bank with mortgage
        const mortgageBanks = filteredBanks.filter((b: any) => b.mortgagePercent && b.mortgagePercent > 0);
        if (mortgageBanks.length > 0) {
          setSelectedBank(mortgageBanks[0]);
        }
      }
    } catch (error) {
      console.error('Load banks error:', error);
    }
  };

  // Submit bank application
  const handleSubmitApplication = async () => {
    if (!selectedBank || !customerName || !customerPhone) {
      alert('Iltimos, barcha maydonlarni to\'ldiring!');
      return;
    }

    try {
      setIsSubmittingApplication(true);

      const applicationData = {
        bankId: selectedBank.id,
        customerName,
        customerPhone,
        houseAddress: house.address || `${house.district}, ${house.region}`,
        housePrice: house.price,
        rooms: house.rooms,
        area: house.area,
        downPayment: (house.price * downPaymentPercent) / 100,
        downPaymentPercent,
        period: selectedYears,
        monthlyPayment: payment.monthlyPayment,
      };

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/banks/apply`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(applicationData),
      });

      const result = await response.json();
      
      if (response.ok) {
        alert(result.message || 'Ariza muvaffaqiyatli yuborildi!');
        setShowBankApplicationModal(false);
        setCustomerName('');
        setCustomerPhone('');
      } else {
        alert(result.error || 'Xatolik yuz berdi!');
      }
    } catch (error) {
      console.error('Application submit error:', error);
      alert('Ariza yuborishda xatolik yuz berdi!');
    } finally {
      setIsSubmittingApplication(false);
    }
  };

  if (!isOpen) return null;

  const nextImage = () => {
    const n = galleryImages.length;
    if (n <= 1) return;
    setCurrentImageIndex((prev) => (prev + 1) % n);
  };

  const prevImage = () => {
    const n = galleryImages.length;
    if (n <= 1) return;
    setCurrentImageIndex((prev) => (prev - 1 + n) % n);
  };

  const openFullscreen = (index: number) => {
    setFullscreenImageIndex(index);
    setIsFullscreen(true);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const closeFullscreen = () => {
    setIsFullscreen(false);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const nextFullscreenImage = () => {
    const n = galleryImages.length || 1;
    setFullscreenImageIndex((prev) => (prev + 1) % n);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const prevFullscreenImage = () => {
    const n = galleryImages.length || 1;
    setFullscreenImageIndex((prev) => (prev - 1 + n) % n);
    setImageScale(1);
    setImagePosition({ x: 0, y: 0 });
  };

  const downloadImage = async () => {
    try {
      const imageUrl = galleryImages[fullscreenImageIndex];
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${house.title}-${fullscreenImageIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Rasmni yuklab olishda xatolik:', error);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextFullscreenImage();
    }
    if (isRightSwipe) {
      prevFullscreenImage();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const handleZoom = (delta: number) => {
    setImageScale((prev) => {
      const newScale = prev + delta;
      if (newScale < 1) return 1;
      if (newScale > 3) return 3;
      return newScale;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden overscroll-none md:items-center md:justify-center md:p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.95)',
      }}
      onClick={onClose}
    >
      {/* Modal Content — min-h-0: flex ichida bitta scroll (ichki panel) */}
      <div
        className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden md:h-auto md:max-h-[90vh] md:max-w-2xl md:flex-none md:rounded-3xl"
        style={{
          background: isDark
            ? 'linear-gradient(145deg, #1a1a1a, #0a0a0a)'
            : 'linear-gradient(145deg, #ffffff, #f5f5f5)',
          boxShadow: isDark
            ? '0 24px 64px rgba(0, 0, 0, 0.8)'
            : '0 24px 64px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button - Fixed Position */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl backdrop-blur-xl transition-all active:scale-90 z-50"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          <X className="size-6 text-white" strokeWidth={2.5} />
        </button>

        {/* Scrollable Content - faqat shu qatlam scroll (sahifa scrolli yo‘q) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {/* View Mode Selector */}
          {house.panoramaScenes && house.panoramaScenes.length > 0 && (
            <div className="absolute top-20 left-4 z-30 flex gap-2">
              <button
                onClick={() => setViewMode('gallery')}
                className="px-3 py-2 rounded-xl backdrop-blur-xl transition-all flex items-center gap-2"
                style={{
                  background: viewMode === 'gallery' ? accentColor.color : 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                }}
              >
                <Image className="size-4" strokeWidth={2.5} />
                <span className="text-xs font-bold">Rasmlar</span>
              </button>
              <button
                onClick={() => setViewMode('3d')}
                className="px-3 py-2 rounded-xl backdrop-blur-xl transition-all flex items-center gap-2"
                style={{
                  background: viewMode === '3d' ? accentColor.color : 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                }}
              >
                <Box className="size-4" strokeWidth={2.5} />
                <span className="text-xs font-bold">360° 3D</span>
              </button>
            </div>
          )}

          {/* Image Carousel / 3D View */}
          <div className="relative w-full aspect-[16/10] md:aspect-video flex-shrink-0">
            {viewMode === 'gallery' ? (
              <>
                <img
                  src={galleryImages[currentImageIndex]}
                  alt={house.title}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => openFullscreen(currentImageIndex)}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                />
                
                {/* Gradient overlay */}
                <div 
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent 50%)',
                  }}
                />

                {/* Navigation Arrows */}
                {galleryImages.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        prevImage();
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-xl transition-all active:scale-90 z-20"
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <ChevronLeft className="size-6 text-white" strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        nextImage();
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full backdrop-blur-xl transition-all active:scale-90 z-20"
                      style={{
                        background: 'rgba(0, 0, 0, 0.5)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <ChevronRight className="size-6 text-white" strokeWidth={2.5} />
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full">
                {house.panoramaScenes && house.panoramaScenes.length > 0 ? (
                  <PannellumViewer scenes={house.panoramaScenes} />
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background: isDark ? '#0a0a0a' : '#f5f5f5',
                    }}
                  >
                    <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                      360° ko'rinish mavjud emas
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Category Badge */}
            <div
              className="absolute top-4 left-4 px-3 py-1.5 rounded-xl backdrop-blur-xl text-xs font-bold z-20"
              style={{
                background: accentColor.color,
                color: '#ffffff',
              }}
            >
              {house.condition === 'yangi' ? 'Yangi qurilish' : house.condition === 'ta\'mirlangan' ? 'Ta\'mirlangan' : house.categoryId === 'kvartira' ? 'Kvartira' : 'Villa'}
            </div>

            {/* Title & Location - Only in gallery mode */}
            {viewMode === 'gallery' && (
              <div className="absolute bottom-4 left-4 right-4 z-20">
                <h2 className="text-xl md:text-2xl font-black text-white mb-2 drop-shadow-2xl">
                  {house.title}
                </h2>
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-white" strokeWidth={2.5} />
                  <span className="text-sm text-white font-medium drop-shadow-lg">
                    {house.district}, {house.region}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 md:p-6 space-y-6 pb-32">
            {/* Price */}
            <div>
              <p
                className="text-3xl md:text-4xl font-black"
                style={{ color: accentColor.color }}
              >
                {formatCurrency(house.price, house.currency)} {house.currency}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div
                className="p-4 rounded-2xl text-center"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                }}
              >
                <BedDouble
                  className="size-6 mx-auto mb-2"
                  style={{ color: accentColor.color }}
                  strokeWidth={2}
                />
                <p className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  {house.rooms}
                </p>
                <p className="text-xs font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Xona
                </p>
              </div>
              <div
                className="p-4 rounded-2xl text-center"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                }}
              >
                <Bath
                  className="size-6 mx-auto mb-2"
                  style={{ color: accentColor.color }}
                  strokeWidth={2}
                />
                <p className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  {house.bathrooms}
                </p>
                <p className="text-xs font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  Hammom
                </p>
              </div>
              <div
                className="p-4 rounded-2xl text-center"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                }}
              >
                <Maximize2
                  className="size-6 mx-auto mb-2"
                  style={{ color: accentColor.color }}
                  strokeWidth={2}
                />
                <p className="text-2xl font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  {house.area}
                </p>
                <p className="text-xs font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                  m²
                </p>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="text-lg font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Ta'rif
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                {house.description}
              </p>
            </div>

            {/* Property Details */}
            <div>
              <h3 className="text-lg font-bold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Batafsil ma'lumot
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {/* Property Type */}
                {house.propertyType && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-3"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <Building2 className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                    <div>
                      <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        Turi
                      </p>
                      <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        {house.propertyType === 'apartment' ? 'Kvartira' :
                         house.propertyType === 'house' ? 'Uy' :
                         house.propertyType === 'commercial' ? 'Tijorat' :
                         house.propertyType === 'land' ? 'Yer' :
                         house.propertyType === 'cottage' ? 'Kottej' : 'Ofis'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Floor */}
                {house.floor && house.totalFloors && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-3"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <Layers className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                    <div>
                      <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        Qavat
                      </p>
                      <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        {house.floor}/{house.totalFloors}
                      </p>
                    </div>
                  </div>
                )}

                {/* Build Year */}
                {house.buildYear && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-3"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <Calendar className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                    <div>
                      <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        Qurilgan yili
                      </p>
                      <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        {house.buildYear}
                      </p>
                    </div>
                  </div>
                )}

                {/* Condition */}
                <div
                  className="p-3 rounded-xl flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <Home className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                  <div>
                    <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                      Holati
                    </p>
                    <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      {house.condition === 'yangi' ? 'Yangi' :
                       house.condition === 'ta\'mirlangan' ? 'Ta\'mirlangan' : 'Oddiy'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <h3 className="text-lg font-bold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Qulayliklar
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {house.hasParking && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-2"
                    style={{
                      background: `${accentColor.color}15`,
                      borderColor: `${accentColor.color}40`,
                      border: '1px solid',
                    }}
                  >
                    <Car className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                    <span className="text-sm font-bold" style={{ color: accentColor.color }}>
                      Parking
                    </span>
                  </div>
                )}
                {house.hasFurniture && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-2"
                    style={{
                      background: `${accentColor.color}15`,
                      borderColor: `${accentColor.color}40`,
                      border: '1px solid',
                    }}
                  >
                    <Sofa className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                    <span className="text-sm font-bold" style={{ color: accentColor.color }}>
                      Mebel
                    </span>
                  </div>
                )}
                {house.hasElevator && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-2"
                    style={{
                      background: `${accentColor.color}15`,
                      borderColor: `${accentColor.color}40`,
                      border: '1px solid',
                    }}
                  >
                    <ArrowUpDown className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                    <span className="text-sm font-bold" style={{ color: accentColor.color }}>
                      Lift
                    </span>
                  </div>
                )}
                {house.hasBalcony && (
                  <div
                    className="p-3 rounded-xl flex items-center gap-2"
                    style={{
                      background: `${accentColor.color}15`,
                      borderColor: `${accentColor.color}40`,
                      border: '1px solid',
                    }}
                  >
                    <Wind className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                    <span className="text-sm font-bold" style={{ color: accentColor.color }}>
                      Balkon
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Full Address */}
            {house.address && (
              <div>
                <h3 className="text-lg font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  To'liq manzil
                </h3>
                <div
                  className="p-4 rounded-xl flex items-start gap-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <MapPin className="size-5 mt-0.5" style={{ color: accentColor.color }} strokeWidth={2} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)' }}>
                      {house.address}
                    </p>
                    <p className="text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                      {house.district}, {house.region}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Contact Person */}
            {(house.contactName || house.contactPhone) && (
              <div>
                <h3 className="text-lg font-bold mb-2" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Aloqa uchun
                </h3>
                <div
                  className="p-4 rounded-xl flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <User className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                  <div className="flex-1">
                    {house.contactName && (
                      <p className="text-sm font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                        {house.contactName}
                      </p>
                    )}
                    {house.contactPhone && (
                      <p className="text-xs mt-0.5" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        {house.contactPhone}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Features */}
            {house.features && house.features.length > 0 && (
              <div>
                <h3 className="text-lg font-bold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                  Qo'shimcha xususiyatlar
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {house.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="size-2 rounded-full"
                        style={{ background: accentColor.color }}
                      />
                      <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Options */}
            <div>
              <h3 className="text-lg font-bold mb-3" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                To'lov usullari
              </h3>
              
              {/* Tabs */}
              <div
                className="inline-flex p-1 rounded-2xl mb-4"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                <button
                  onClick={() => setPaymentTab('naqd')}
                  className="relative px-4 py-2 rounded-xl transition-all text-sm font-medium"
                  style={{
                    color: paymentTab === 'naqd' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                  }}
                >
                  {paymentTab === 'naqd' && (
                    <div
                      className="absolute inset-0 rounded-xl"
                      style={{
                        background: accentColor.color,
                      }}
                    />
                  )}
                  <span className="relative z-10">Naqd</span>
                </button>
                {house.mortgageAvailable && (
                  <button
                    onClick={() => setPaymentTab('ipoteka')}
                    className="relative px-4 py-2 rounded-xl transition-all text-sm font-medium"
                    style={{
                      color: paymentTab === 'ipoteka' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                    }}
                  >
                    {paymentTab === 'ipoteka' && (
                      <div
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background: accentColor.color,
                        }}
                      />
                    )}
                    <span className="relative z-10">Ipoteka</span>
                  </button>
                )}
                {house.hasHalalInstallment && (
                  <button
                    onClick={() => setPaymentTab('halal')}
                    className="relative px-4 py-2 rounded-xl transition-all text-sm font-bold flex items-center gap-1"
                    style={{
                      color: paymentTab === 'halal' ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                    }}
                  >
                    {paymentTab === 'halal' && (
                      <div
                        className="absolute inset-0 rounded-xl"
                        style={{
                          background: accentColor.color,
                        }}
                      />
                    )}
                    <span className="relative z-10">✓ Xalol Nasiya</span>
                  </button>
                )}
              </div>

              {/* Payment Details */}
              {paymentTab === 'naqd' ? (
                <div
                  className="p-4 rounded-2xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  }}
                >
                  <p className="text-sm font-medium mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                    To'liq narx:
                  </p>
                  <p className="text-2xl font-black" style={{ color: accentColor.color }}>
                    {formatCurrency(house.price, house.currency)} {house.currency}
                  </p>
                  <div
                    className="flex items-center gap-2 mt-3 p-2 rounded-xl"
                    style={{
                      background: `${accentColor.color}15`,
                    }}
                  >
                    <div className="text-xl">🔥</div>
                    <p className="text-xs font-medium" style={{ color: accentColor.color }}>
                      Naqd to'lovda maxsus chegirmalar mavjud!
                    </p>
                  </div>
                </div>
              ) : paymentTab === 'ipoteka' ? (
                <div className="space-y-4">
                  {/* Bank Selection for Ipoteka */}
                  {availableBanks.filter(b => b.mortgagePercent && b.mortgagePercent > 0).length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                        Bank tanlang:
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        {availableBanks.filter(b => b.mortgagePercent && b.mortgagePercent > 0).map((bank) => (
                          <button
                            key={bank.id}
                            onClick={() => setSelectedBank(bank)}
                            className="w-full p-3 rounded-xl transition-all text-left"
                            style={{
                              background: selectedBank?.id === bank.id 
                                ? `${accentColor.color}20`
                                : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'),
                              borderColor: selectedBank?.id === bank.id ? accentColor.color : 'transparent',
                              border: '2px solid',
                            }}
                          >
                            <div className="flex items-center gap-3">
                              {bank.logo && (
                                <img src={bank.logo} alt={bank.name} className="w-10 h-10 object-contain rounded" />
                              )}
                              <div className="flex-1">
                                <p className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                                  {bank.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-bold" style={{ color: accentColor.color }}>
                                    {bank.mortgagePercent}% foiz
                                  </span>
                                  <span className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                                    • {bank.maxPeriod} yilgacha
                                  </span>
                                </div>
                              </div>
                              {selectedBank?.id === bank.id && (
                                <Check className="size-5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedBank && (
                    <div
                      className="p-4 rounded-2xl space-y-4"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      {/* Years Selection */}
                      <div>
                        <p className="text-sm font-medium mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                          Ipoteka muddati:
                        </p>
                        <div className="flex gap-2">
                          {[3, 6, 12, 20].filter(y => y <= (selectedBank.maxPeriod || 20)).map((years) => (
                            <button
                              key={years}
                              onClick={() => setSelectedYears(years)}
                              className="flex-1 px-3 py-2 rounded-xl text-sm font-bold transition-all"
                              style={{
                                background: selectedYears === years ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                                color: selectedYears === years ? '#ffffff' : (isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)'),
                              }}
                            >
                              {years} yil
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Down Payment Slider */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium" style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}>
                            Dastlabki to'lov:
                          </p>
                          <p className="text-sm font-bold" style={{ color: accentColor.color }}>
                            {downPaymentPercent}%
                          </p>
                        </div>
                        <input
                          type="range"
                          min={minDownPayment}
                          max="50"
                          value={downPaymentPercent}
                          onChange={(e) => setDownPaymentPercent(Number(e.target.value))}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer"
                          style={{
                            background: `linear-gradient(to right, ${accentColor.color} 0%, ${accentColor.color} ${(downPaymentPercent - minDownPayment) / (50 - minDownPayment) * 100}%, ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'} ${(downPaymentPercent - minDownPayment) / (50 - minDownPayment) * 100}%, ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'} 100%)`,
                          }}
                        />
                        <div className="flex justify-between text-xs mt-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                          <span>{minDownPayment}%</span>
                          <span>50%</span>
                        </div>
                      </div>

                      {/* Payment Breakdown */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Bank:
                          </span>
                          <span className="font-bold" style={{ color: accentColor.color }}>
                            {selectedBank.name}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Foiz stavka:
                          </span>
                          <span className="font-bold" style={{ color: accentColor.color }}>
                            {currentRate}% yillik
                          </span>
                        </div>
                        <div className="h-px" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                        <div className="flex justify-between text-sm">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Dastlabki to'lov:
                          </span>
                          <span className="font-bold" style={{ color: accentColor.color }}>
                            {formatCurrency(payment.downPayment, house.currency)} {house.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Kredit miqdori:
                          </span>
                          <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            {formatCurrency(payment.loanAmount, house.currency)} {house.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Oylik to'lov:
                          </span>
                          <span className="font-bold text-lg" style={{ color: accentColor.color }}>
                            {formatCurrency(payment.monthlyPayment, house.currency)} {house.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Jami to'lov:
                          </span>
                          <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                            {formatCurrency(payment.totalPayment, house.currency)} {house.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Ortiqcha to'lov:
                          </span>
                          <span className="font-bold text-red-500">
                            +{formatCurrency(payment.totalInterest, house.currency)} {house.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedBank && availableBanks.filter(b => b.mortgagePercent && b.mortgagePercent > 0).length > 0 && (
                    <div
                      className="p-4 rounded-2xl text-center"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                      }}
                    >
                      <p className="text-sm" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        Ipoteka hisoblash uchun bank tanlang
                      </p>
                    </div>
                  )}
                </div>
              ) : paymentTab === 'halal' ? (
                <div className="space-y-4">
                  {/* Halal Installment Info */}
                  <div
                    className="p-4 rounded-2xl"
                    style={{
                      background: `${accentColor.color}15`,
                      borderColor: `${accentColor.color}40`,
                      border: '1px solid',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">✓</span>
                      <p className="text-sm font-bold" style={{ color: accentColor.color }}>
                        HALAL MUDDATLI TO'LOV{parseFloat(house.halalInstallmentBank || '0') === 0 ? ' - FOIZSIZ!' : ''}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          Muddat:
                        </span>
                        <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                          {house.halalInstallmentMonths} oy ({Math.ceil((house.halalInstallmentMonths || 12) / 12)} yil)
                        </span>
                      </div>
                      {parseFloat(house.halalInstallmentBank || '0') > 0 && (
                        <div className="flex justify-between text-sm">
                          <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                            Yillik foiz:
                          </span>
                          <span className="font-bold" style={{ color: accentColor.color }}>
                            {house.halalInstallmentBank}%
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          Boshlang'ich to'lov:
                        </span>
                        <span className="font-bold" style={{ color: accentColor.color }}>
                          {house.halalDownPayment}% ({formatCurrency(house.price * (house.halalDownPayment || 0) / 100, house.currency)} {house.currency})
                        </span>
                      </div>
                      <div className="h-px" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          Oylik to'lov:
                        </span>
                        <span className="font-bold text-lg" style={{ color: accentColor.color }}>
                          {(() => {
                            const financedAmount = house.price - (house.price * (house.halalDownPayment || 0) / 100);
                            const months = house.halalInstallmentMonths || 1;
                            const yearlyRate = parseFloat(house.halalInstallmentBank || '0');
                            let monthlyPayment;
                            
                            if (yearlyRate === 0) {
                              monthlyPayment = financedAmount / months;
                            } else {
                              const monthlyRate = yearlyRate / 100 / 12;
                              monthlyPayment = financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
                            }
                            
                            return formatCurrency(monthlyPayment, house.currency);
                          })()} {house.currency}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                          Jami to'lov:
                        </span>
                        <span className="font-bold text-xl" style={{ color: accentColor.color }}>
                          {(() => {
                            const downPaymentAmount = house.price * (house.halalDownPayment || 0) / 100;
                            const financedAmount = house.price - downPaymentAmount;
                            const months = house.halalInstallmentMonths || 1;
                            const yearlyRate = parseFloat(house.halalInstallmentBank || '0');
                            let monthlyPayment;
                            
                            if (yearlyRate === 0) {
                              monthlyPayment = financedAmount / months;
                            } else {
                              const monthlyRate = yearlyRate / 100 / 12;
                              monthlyPayment = financedAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
                            }
                            
                            const totalPayment = downPaymentAmount + (monthlyPayment * months);
                            return formatCurrency(totalPayment, house.currency);
                          })()} {house.currency}
                        </span>
                      </div>
                    </div>
                    <div
                      className="mt-3 p-3 rounded-xl text-center"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.8)',
                      }}
                    >
                      <p className="text-xs font-bold" style={{ color: accentColor.color }}>
                        {parseFloat(house.halalInstallmentBank || '0') === 0 ? '⭐ FOIZ YO\'Q! E\'lon beruvchi bilan to\'g\'ridan-to\'g\'ri kelishuv. Bank arizasi yo\'q!' : `📊 ${house.halalInstallmentBank}% yillik foiz bilan. E'lon beruvchi bilan kelishuv. Bank arizasi yo'q!`}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Fixed Bottom Contact Buttons */}
        <div 
          className="absolute bottom-0 left-0 right-0 p-4 z-40"
          style={{
            background: isDark 
              ? 'linear-gradient(to top, #1a1a1a 80%, transparent)'
              : 'linear-gradient(to top, #ffffff 80%, transparent)',
          }}
        >
          <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
            <a
              href={`tel:${house.ownerPhone}`}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-white transition-all active:scale-95"
              style={{
                background: accentColor.color,
                boxShadow: `0 8px 24px ${accentColor.color}66`,
              }}
            >
              <Phone className="size-5" strokeWidth={2.5} />
              <span>Qo'ng'iroq</span>
            </a>
            {paymentTab === 'ipoteka' && selectedBank ? (
              <button
                onClick={() => setShowBankApplicationModal(true)}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: `linear-gradient(135deg, ${accentColor.color}, ${accentColor.color}dd)`,
                  boxShadow: `0 8px 24px ${accentColor.color}66`,
                  color: '#ffffff',
                }}
              >
                <Send className="size-5" strokeWidth={2.5} />
                <span>Ariza yuborish</span>
              </button>
            ) : (
              <a
                href={`sms:${house.ownerPhone}`}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  color: isDark ? '#ffffff' : '#111827',
                }}
              >
                <MessageCircle className="size-5" strokeWidth={2.5} />
                <span>Xabar</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bank Application Modal */}
      {showBankApplicationModal && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(8px)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowBankApplicationModal(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl p-6"
            style={{
              background: isDark
                ? 'linear-gradient(145deg, #1a1a1a, #0a0a0a)'
                : 'linear-gradient(145deg, #ffffff, #f5f5f5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                Ipoteka uchun ariza
              </h3>
              <button
                onClick={() => setShowBankApplicationModal(false)}
                className="p-2 rounded-xl transition-all"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <X className="size-5" strokeWidth={2.5} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Selected Bank Display */}
              {selectedBank && (
                <div
                  className="p-4 rounded-xl"
                  style={{
                    background: `${accentColor.color}15`,
                    borderColor: `${accentColor.color}40`,
                    border: '1px solid',
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    {selectedBank.logo && (
                      <img src={selectedBank.logo} alt={selectedBank.name} className="w-12 h-12 object-contain rounded" />
                    )}
                    <div>
                      <p className="font-bold" style={{ color: accentColor.color }}>
                        {selectedBank.name}
                      </p>
                      <p className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                        {selectedBank.mortgagePercent}% yillik foiz
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Customer Info */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                  Ismingiz *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Masalan: Alisher Alimov"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}>
                  Telefon raqamingiz *
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full px-4 py-3 rounded-xl border outline-none transition-all"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#111827',
                  }}
                />
              </div>

              {/* Summary */}
              <div
                className="p-4 rounded-xl space-y-2"
                style={{
                  background: `${accentColor.color}10`,
                  borderColor: `${accentColor.color}30`,
                  border: '1px solid',
                }}
              >
                <p className="text-xs font-bold" style={{ color: accentColor.color }}>
                  ARIZA TAFSILOTI:
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      Uy narxi:
                    </span>
                    <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      {formatCurrency(house.price, house.currency)} {house.currency}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      Boshlang'ich to'lov:
                    </span>
                    <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      {formatCurrency((house.price * downPaymentPercent) / 100, house.currency)} ({downPaymentPercent}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      Muddat:
                    </span>
                    <span className="font-bold" style={{ color: isDark ? '#ffffff' : '#111827' }}>
                      {selectedYears} yil
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}>
                      Oylik to'lov:
                    </span>
                    <span className="font-bold" style={{ color: accentColor.color }}>
                      ≈ {formatCurrency(payment.monthlyPayment, house.currency)} {house.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleSubmitApplication}
                disabled={isSubmittingApplication || !selectedBank || !customerName || !customerPhone}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-white transition-all disabled:opacity-50"
                style={{
                  background: accentColor.color,
                  boxShadow: `0 8px 24px ${accentColor.color}40`,
                }}
              >
                {isSubmittingApplication ? (
                  <>
                    <div className="size-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Yuborilmoqda...</span>
                  </>
                ) : (
                  <>
                    <Send className="size-5" strokeWidth={2.5} />
                    <span>Ariza yuborish</span>
                  </>
                )}
              </button>

              <p className="text-xs text-center" style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}>
                Ariza yuborilgandan so'ng bank xodimlari siz bilan bog'lanishadi
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Viewer */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: 'rgba(0, 0, 0, 0.98)',
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              closeFullscreen();
            }}
            className="absolute top-4 right-4 p-3 rounded-full backdrop-blur-xl transition-all active:scale-90 z-50"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <X className="size-6 text-white" strokeWidth={2.5} />
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void downloadImage();
            }}
            className="absolute top-4 right-20 p-3 rounded-full backdrop-blur-xl transition-all active:scale-90 z-50"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <Download className="size-6 text-white" strokeWidth={2.5} />
          </button>

          {/* Zoom Controls */}
          <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-50">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleZoom(0.25);
              }}
              className="p-3 rounded-full backdrop-blur-xl transition-all active:scale-90"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <ZoomIn className="size-5 text-white" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleZoom(-0.25);
              }}
              className="p-3 rounded-full backdrop-blur-xl transition-all active:scale-90"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <ZoomOut className="size-5 text-white" strokeWidth={2.5} />
            </button>
          </div>

          {/* Image Container */}
          <div
            className="relative w-full h-full flex items-center justify-center overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={galleryImages[fullscreenImageIndex]}
              alt={house.title}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{
                transform: `scale(${imageScale}) translate(${imagePosition.x}px, ${imagePosition.y}px)`,
              }}
            />
          </div>

          {/* Navigation Arrows */}
          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevFullscreenImage();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full backdrop-blur-xl transition-all active:scale-90 z-50"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <ChevronLeft className="size-8 text-white" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextFullscreenImage();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full backdrop-blur-xl transition-all active:scale-90 z-50"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                }}
              >
                <ChevronRight className="size-8 text-white" strokeWidth={2.5} />
              </button>
            </>
          )}

          {/* Image Counter */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full backdrop-blur-xl z-50"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <p className="text-white text-sm font-bold">
              {fullscreenImageIndex + 1} / {galleryImages.length}
            </p>
          </div>

          {/* Thumbnails */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-2 max-w-full overflow-x-auto px-4 z-50">
            {galleryImages.map((img, idx) => (
              <button
                type="button"
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setFullscreenImageIndex(idx);
                  setImageScale(1);
                  setImagePosition({ x: 0, y: 0 });
                }}
                className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden transition-all"
                style={{
                  border: idx === fullscreenImageIndex ? `2px solid ${accentColor.color}` : '2px solid rgba(255, 255, 255, 0.3)',
                  opacity: idx === fullscreenImageIndex ? 1 : 0.6,
                }}
              >
                <img
                  src={img}
                  alt={`Thumbnail ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}