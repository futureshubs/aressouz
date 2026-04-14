import { useState, useEffect } from 'react';
import { X, MapPin, Phone, Clock, ChevronLeft, ChevronRight, ChevronDown, Navigation, Instagram, Youtube, Send, Heart, MessageSquare, Star, Loader2 } from 'lucide-react';
import { Place } from '../data/places';
import { useTheme } from '../context/ThemeContext';
import { ReviewModal } from './ReviewModal';
import { ShareModal } from './ShareModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { useVisibilityTick } from '../utils/visibilityRefetch';
import { openExternalUrlSync } from '../utils/openExternalUrl';

interface PlaceDetailModalProps {
  place: Place;
  isOpen: boolean;
  onClose: () => void;
}

interface Review {
  id: string;
  placeId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// Helper function to check if place is currently open
function checkIsOpen(openingHours?: string): boolean {
  if (!openingHours) return false;
  
  // Parse opening hours format: "08:00-22:00" or "24/7"
  if (openingHours === '24/7' || openingHours === '24 soat') return true;
  
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    // Extract hours from format like "08:00-22:00"
    const match = openingHours.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (!match) return false;
    
    const [, startHour, startMin, endHour, endMin] = match;
    const startTime = parseInt(startHour) * 60 + parseInt(startMin);
    const endTime = parseInt(endHour) * 60 + parseInt(endMin);
    
    return currentTime >= startTime && currentTime <= endTime;
  } catch {
    return false;
  }
}

export function PlaceDetailModal({ place, isOpen, onClose }: PlaceDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isCallingInProgress, setIsCallingInProgress] = useState(false);
  
  // Swipe states
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchMoveX, setTouchMoveX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const visibilityRefetchTick = useVisibilityTick();

  const isDark = theme === 'dark';
  
  // Check if place is open based on current time
  const isCurrentlyOpen = checkIsOpen(place.openingHours);
  
  // Extract images - support multiple images from place.images, fallback to single image
  const images = place.images && place.images.length > 0 ? place.images : [place.image];
  
  // Fetch reviews
  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/places/${place.id}/reviews`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        console.log('✅ Reviews loaded:', data.reviews?.length || 0);
      }
    } catch (error) {
      console.error('❌ Error fetching reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  useEffect(() => {
    // Reset image index when modal opens
    if (isOpen) {
      setCurrentImageIndex(0);
      setIsLoading(true);
      fetchReviews();
      // Simulate loading delay
      setTimeout(() => setIsLoading(false), 300);
    }
  }, [isOpen, place.id, visibilityRefetchTick]);

  if (!isOpen) return null;

  const handleShare = () => {
    setShowShareModal(true);
  };

  const handleGetDirections = () => {
    const [lat, lng] = place.coordinates;
    openExternalUrlSync(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
  };

  const handleCall = () => {
    setIsCallingInProgress(true);
    window.location.href = `tel:${place.phone}`;
    
    // Show review modal after call
    setTimeout(() => {
      setIsCallingInProgress(false);
      // Open review modal after a delay
      setTimeout(() => {
        setShowReviewModal(true);
      }, 2000);
    }, 3000);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartX(e.targetTouches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchMoveX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    setTouchEnd(touchEndX);
    
    // Detect swipe direction
    const swipeDistance = touchStartX - touchEndX;
    if (Math.abs(swipeDistance) > 50) {
      if (swipeDistance > 0) {
        // Swiped left - next image
        nextImage();
      } else {
        // Swiped right - previous image
        prevImage();
      }
    }
    
    setIsSwiping(false);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-2xl sm:max-h-[90vh] overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(145deg, rgba(25, 25, 25, 0.98), rgba(15, 15, 15, 0.98))'
            : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
          backdropFilter: 'blur(40px)',
          borderRadius: '32px 32px 0 0',
          boxShadow: isDark
            ? '0 -8px 48px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 -8px 48px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.05)',
          maxHeight: '85vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-20 p-3 rounded-2xl transition-all active:scale-90"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <X className="size-5 text-white" strokeWidth={2.5} />
        </button>

        {/* Favorite Button */}
        <button
          onClick={() => setIsFavorite(!isFavorite)}
          className="absolute top-6 right-20 z-20 p-3 rounded-2xl transition-all active:scale-90"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <Heart 
            className={`size-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`}
            strokeWidth={2.5} 
          />
        </button>

        {/* Share Button */}
        <button
          onClick={handleShare}
          className="absolute top-6 right-[136px] z-20 p-3 rounded-2xl transition-all active:scale-90"
          style={{
            background: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
          }}
        >
          <Send className="size-5 text-white" strokeWidth={2.5} />
        </button>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[85vh] custom-scrollbar">
          {/* Image Gallery */}
          <div className="relative h-80 sm:h-96 overflow-hidden bg-black/20" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove}>
            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div 
                  className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent"
                  style={{ 
                    borderColor: `${accentColor.color}44`, 
                    borderTopColor: 'transparent' 
                  }}
                />
              </div>
            ) : (
              <img
                src={images[currentImageIndex]}
                alt={place.name}
                className="w-full h-full object-cover"
              />
            )}
            
            {/* Image Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all active:scale-90"
                  style={{
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <ChevronLeft className="size-6 text-white" strokeWidth={2.5} />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all active:scale-90"
                  style={{
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(20px)',
                  }}
                >
                  <ChevronRight className="size-6 text-white" strokeWidth={2.5} />
                </button>
                
                {/* Image Indicators */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: currentImageIndex === idx ? '24px' : '8px',
                        background: currentImageIndex === idx 
                          ? 'rgba(255, 255, 255, 0.9)' 
                          : 'rgba(255, 255, 255, 0.4)',
                      }}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Status Badge on Image */}
            <div 
              className="absolute top-6 left-6 px-4 py-2 rounded-2xl backdrop-blur-md"
              style={{
                background: isCurrentlyOpen 
                  ? 'rgba(34, 197, 94, 0.95)' 
                  : 'rgba(239, 68, 68, 0.95)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
              }}
            >
              <span className="text-sm font-black text-white flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-white animate-pulse" />
                {isCurrentlyOpen ? 'OCHIQ' : 'YOPIQ'}
              </span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between mb-3">
                <h1 
                  className="text-2xl font-bold pr-4"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  {place.name}
                </h1>
              </div>

              {/* Category */}
              <div className="flex items-center gap-2 mb-3">
                <span 
                  className="text-sm font-semibold px-3 py-1.5 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    color: accentColor.color,
                  }}
                >
                  {place.category}
                </span>
                <span 
                  className="text-sm font-semibold px-3 py-1.5 rounded-xl"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)',
                  }}
                >
                  📍 {place.distance}
                </span>
              </div>

              {/* Rating - Enhanced */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`size-5 ${
                        i < Math.floor(place.rating)
                          ? 'fill-yellow-400 text-yellow-400'
                          : i < place.rating
                          ? 'fill-yellow-400/50 text-yellow-400'
                          : 'fill-gray-600/20 text-gray-600/20'
                      }`}
                      strokeWidth={2.5}
                    />
                  ))}
                </div>
                <span 
                  className="text-lg font-bold"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  {place.rating.toFixed(1)}
                </span>
                <span 
                  className="text-sm"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                >
                  ({place.reviews} baho)
                </span>
              </div>
            </div>

            {/* Description */}
            {place.description && (
              <div>
                <h3 
                  className="text-sm font-bold mb-2"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  Tavsif
                </h3>
                <p 
                  className="text-sm leading-relaxed"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                >
                  {place.description}
                </p>
              </div>
            )}

            {/* Info Cards */}
            <div className="space-y-3">
              {/* Address */}
              <div 
                className="flex items-start gap-4 p-4 rounded-2xl"
                style={{
                  background: isDark 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(0, 0, 0, 0.03)',
                  border: isDark 
                    ? '1px solid rgba(255, 255, 255, 0.1)' 
                    : '1px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <div 
                  className="p-2.5 rounded-xl"
                  style={{ background: `${accentColor.color}22` }}
                >
                  <MapPin className="size-5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p 
                    className="text-xs font-semibold mb-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                  >
                    Manzil
                  </p>
                  <p 
                    className="text-sm font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}
                  >
                    {place.address}
                  </p>
                  {place.region && place.district && (
                    <p 
                      className="text-xs mt-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      {place.region}, {place.district}
                    </p>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div 
                className="flex items-start gap-4 p-4 rounded-2xl"
                style={{
                  background: isDark 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(0, 0, 0, 0.03)',
                  border: isDark 
                    ? '1px solid rgba(255, 255, 255, 0.1)' 
                    : '1px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <div 
                  className="p-2.5 rounded-xl"
                  style={{ background: `${accentColor.color}22` }}
                >
                  <Phone className="size-5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <p 
                    className="text-xs font-semibold mb-1"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                  >
                    Telefon
                  </p>
                  <p 
                    className="text-sm font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}
                  >
                    {place.phone}
                  </p>
                </div>
              </div>

              {/* Opening Hours */}
              {place.openingHours && (
                <div 
                  className="flex items-start gap-4 p-4 rounded-2xl"
                  style={{
                    background: isDark 
                      ? 'rgba(255, 255, 255, 0.05)' 
                      : 'rgba(0, 0, 0, 0.03)',
                    border: isDark 
                      ? '1px solid rgba(255, 255, 255, 0.1)' 
                      : '1px solid rgba(0, 0, 0, 0.08)',
                  }}
                >
                  <div 
                    className="p-2.5 rounded-xl"
                    style={{ background: `${accentColor.color}22` }}
                  >
                    <Clock className="size-5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                  </div>
                  <div className="flex-1">
                    <p 
                      className="text-xs font-semibold mb-1"
                      style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    >
                      Ish vaqti
                    </p>
                    <p 
                      className="text-sm font-semibold"
                      style={{ color: isDark ? '#ffffff' : '#000000' }}
                    >
                      {place.openingHours}
                    </p>
                    <p 
                      className="text-xs mt-1 font-semibold"
                      style={{ 
                        color: isCurrentlyOpen 
                          ? 'rgb(34, 197, 94)' 
                          : 'rgb(239, 68, 68)' 
                      }}
                    >
                      {isCurrentlyOpen ? '• Hozir ochiq' : '• Hozir yopiq'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Services */}
            {place.services && place.services.length > 0 && (
              <div>
                <h3 
                  className="text-sm font-bold mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  Xizmatlar
                </h3>
                <div className="flex flex-wrap gap-2">
                  {place.services.map((service, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                      style={{
                        background: isDark 
                          ? 'rgba(255, 255, 255, 0.08)' 
                          : 'rgba(0, 0, 0, 0.05)',
                        color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)',
                        border: isDark 
                          ? '1px solid rgba(255, 255, 255, 0.1)' 
                          : '1px solid rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Working Days */}
            {(place as any).workingDays && (place as any).workingDays.length > 0 && (
              <div>
                <h3 
                  className="text-sm font-bold mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  📅 Ish kunlari
                </h3>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'monday', label: 'Dushanba' },
                    { id: 'tuesday', label: 'Seshanba' },
                    { id: 'wednesday', label: 'Chorshanba' },
                    { id: 'thursday', label: 'Payshanba' },
                    { id: 'friday', label: 'Juma' },
                    { id: 'saturday', label: 'Shanba' },
                    { id: 'sunday', label: 'Yakshanba' },
                  ].map((day) => (
                    <span
                      key={day.id}
                      className="text-xs font-semibold px-3 py-1.5 rounded-xl"
                      style={{
                        background: (place as any).workingDays.includes(day.id)
                          ? accentColor.color
                          : isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        color: (place as any).workingDays.includes(day.id)
                          ? '#ffffff'
                          : isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
                        border: `1px solid ${(place as any).workingDays.includes(day.id) ? accentColor.color : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}`,
                      }}
                    >
                      {day.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Social Media */}
            {((place as any).instagram || (place as any).youtube || (place as any).telegram) && (
              <div>
                <h3 
                  className="text-sm font-bold mb-3"
                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                >
                  🌐 Ijtimoiy tarmoqlar
                </h3>
                <div className="space-y-2">
                  {(place as any).instagram && (
                    <a
                      href={(place as any).instagram.startsWith('http') ? (place as any).instagram : `https://${(place as any).instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl transition-all active:scale-95"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)',
                        }}
                      >
                        <Instagram className="size-5 text-white" />
                      </div>
                      <span className="text-sm font-semibold flex-1" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        Instagram
                      </span>
                      <span className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        →
                      </span>
                    </a>
                  )}

                  {(place as any).youtube && (
                    <a
                      href={(place as any).youtube.startsWith('http') ? (place as any).youtube : `https://${(place as any).youtube}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl transition-all active:scale-95"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: '#FF0000' }}
                      >
                        <Youtube className="size-5 text-white" />
                      </div>
                      <span className="text-sm font-semibold flex-1" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        YouTube
                      </span>
                      <span className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        →
                      </span>
                    </a>
                  )}

                  {(place as any).telegram && (
                    <a
                      href={(place as any).telegram.startsWith('http') ? (place as any).telegram : `https://${(place as any).telegram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl transition-all active:scale-95"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                      }}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: '#0088cc' }}
                      >
                        <Send className="size-5 text-white" />
                      </div>
                      <span className="text-sm font-semibold flex-1" style={{ color: isDark ? '#ffffff' : '#000000' }}>
                        Telegram
                      </span>
                      <span className="text-xs" style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}>
                        →
                      </span>
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                type="button"
                onClick={handleCall}
                disabled={isCallingInProgress}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold text-white transition-all active:scale-95 disabled:opacity-60"
                style={{
                  backgroundImage: accentColor.gradient,
                  boxShadow: `0 8px 24px ${accentColor.color}44`,
                }}
              >
                {isCallingInProgress ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <Phone className="size-5" strokeWidth={2.5} />
                )}
                Qo'ng'iroq
              </button>
              <button
                onClick={handleGetDirections}
                className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all active:scale-95"
                style={{
                  background: isDark 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'rgba(0, 0, 0, 0.05)',
                  color: accentColor.color,
                  border: `2px solid ${accentColor.color}44`,
                }}
              >
                <Navigation className="size-5" strokeWidth={2.5} />
                Yo'nalish
              </button>
            </div>

            {/* Reviews Section */}
            <div className="pt-6 border-t" style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}>
              {/* Toggle Reviews Button */}
              <button
                onClick={() => setShowReviews(!showReviews)}
                className="w-full flex items-center justify-between mb-4 p-4 rounded-2xl transition-all active:scale-98"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="size-5" style={{ color: accentColor.color }} strokeWidth={2.5} />
                  <h3 
                    className="text-lg font-bold"
                    style={{ color: isDark ? '#ffffff' : '#000000' }}
                  >
                    Sharhlar
                  </h3>
                  <span 
                    className="text-sm font-semibold px-2.5 py-1 rounded-lg"
                    style={{
                      background: `${accentColor.color}22`,
                      color: accentColor.color,
                    }}
                  >
                    {reviews.length}
                  </span>
                </div>
                <div 
                  className="flex items-center gap-2 transition-transform"
                  style={{ transform: showReviews ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <ChevronDown 
                    className="size-5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                    strokeWidth={2.5}
                  />
                </div>
              </button>

              {/* Reviews Content - Hidden by default */}
              {showReviews && (
                <div className="space-y-4">
                  {/* Add Review Button */}
                  <button
                    onClick={() => setShowReviewModal(true)}
                    className="w-full text-sm font-semibold px-4 py-3 rounded-xl transition-all active:scale-95"
                    style={{
                      backgroundImage: accentColor.gradient,
                      color: '#ffffff',
                      boxShadow: `0 4px 16px ${accentColor.color}44`,
                    }}
                  >
                    ✍️ Sharh qoldirish
                  </button>

                  {loadingReviews ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" style={{ color: accentColor.color }} />
                    </div>
                  ) : reviews.length === 0 ? (
                    <div 
                      className="text-center py-12 rounded-2xl"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                      }}
                    >
                      <MessageSquare 
                        className="size-12 mx-auto mb-3 opacity-30"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      />
                      <p 
                        className="text-sm font-semibold mb-1"
                        style={{ color: isDark ? '#ffffff' : '#000000' }}
                      >
                        Hali sharhlar yo'q
                      </p>
                      <p 
                        className="text-xs"
                        style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                      >
                        Birinchi sharh qoldiruvchi bo'ling!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reviews.map((review) => (
                        <div
                          key={review.id}
                          className="p-4 rounded-2xl"
                          style={{
                            background: isDark 
                              ? 'rgba(255, 255, 255, 0.05)' 
                              : 'rgba(0, 0, 0, 0.03)',
                            border: isDark 
                              ? '1px solid rgba(255, 255, 255, 0.1)' 
                              : '1px solid rgba(0, 0, 0, 0.08)',
                          }}
                        >
                          {/* Review Header */}
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div 
                                className="size-10 rounded-full flex items-center justify-center font-bold text-white"
                                style={{
                                  backgroundImage: accentColor.gradient,
                                }}
                              >
                                {review.userName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p 
                                  className="text-sm font-bold"
                                  style={{ color: isDark ? '#ffffff' : '#000000' }}
                                >
                                  {review.userName}
                                </p>
                                <p 
                                  className="text-xs"
                                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
                                >
                                  {new Date(review.createdAt).toLocaleDateString('uz-UZ', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </p>
                              </div>
                            </div>
                            
                            {/* Review Stars */}
                            <div className="flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`size-4 ${
                                    i < review.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'fill-gray-600/20 text-gray-600/20'
                                  }`}
                                  strokeWidth={2.5}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Review Comment */}
                          <p 
                            className="text-sm leading-relaxed"
                            style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
                          >
                            {review.comment}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <ReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        placeId={place.id}
        placeName={place.name}
        onSuccess={() => {
          fetchReviews(); // Refresh reviews after submission
        }}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        placeId={place.id}
        placeName={place.name}
        placeImage={place.image}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${accentColor.color};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${accentColor.color}dd;
        }
      `}</style>
    </div>
  );
}