import { memo, useState, useRef, useEffect } from 'react';
import { MapPin, Star, Phone, Clock } from 'lucide-react';
import { Place } from '../data/places';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { PlaceActionModal } from './PlaceActionModal';
import { SecurityCodeModal } from './SecurityCodeModal';
import { EditPlaceModal } from './EditPlaceModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { regions } from '../data/regions';

interface PlaceCardProps {
  place: Place;
  onPlaceClick: (place: Place) => void;
  platform: Platform;
  onPlaceUpdated?: () => void;
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

// Helper function to get location name from region and district IDs
function getLocationName(regionId?: string, districtId?: string): string {
  if (!regionId) return '';
  
  const region = regions.find(r => r.id === regionId);
  if (!region) return regionId;
  
  if (districtId) {
    const district = region.districts.find(d => d.id === districtId);
    return district ? `${region.name}, ${district.name}` : region.name;
  }
  
  return region.name;
}

export const PlaceCard = memo(function PlaceCard({ place, onPlaceClick, platform, onPlaceUpdated }: PlaceCardProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const isIOS = platform === 'ios';
  
  // Long press states
  const [showActionModal, setShowActionModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<'delete' | 'edit' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Image carousel state
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const images = place.images && place.images.length > 0 ? place.images : [place.image];
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const pressStartTime = useRef<number>(0);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const isScrolling = useRef<boolean>(false);
  
  // Check if place is open based on current time
  const isCurrentlyOpen = checkIsOpen(place.openingHours);

  // Auto-rotate images every 3 seconds
  useEffect(() => {
    if (images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [images.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    isScrolling.current = false;
    pressStartTime.current = Date.now();
    
    longPressTimer.current = setTimeout(() => {
      if (!isScrolling.current) {
        // Vibrate on long press
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
        setShowActionModal(true);
      }
    }, 3000); // 3 seconds
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
    
    // If moved more than 10px, it's a scroll
    if (deltaX > 10 || deltaY > 10) {
      isScrolling.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    // Only trigger click if not scrolling and less than 3 seconds
    const pressDuration = Date.now() - pressStartTime.current;
    if (!isScrolling.current && pressDuration < 3000 && !showActionModal) {
      // Small delay to prevent double trigger
      setTimeout(() => {
        onPlaceClick(place);
      }, 10);
    }
    
    // Reset
    touchStartPos.current = null;
    isScrolling.current = false;
  };

  const handleTouchCancel = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    touchStartPos.current = null;
    isScrolling.current = false;
  };

  // Mouse events for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    pressStartTime.current = Date.now();
    longPressTimer.current = setTimeout(() => {
      setShowActionModal(true);
    }, 3000); // 3 seconds
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    
    // If less than 3 seconds, it's a normal click
    const pressDuration = Date.now() - pressStartTime.current;
    if (pressDuration < 3000) {
      onPlaceClick(place);
    }
  };

  const handleMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleEdit = () => {
    setShowActionModal(false);
    setPendingAction('edit');
    setShowSecurityModal(true);
  };

  const handleDelete = () => {
    setShowActionModal(false);
    setPendingAction('delete');
    setShowSecurityModal(true);
  };

  const handleSecuritySuccess = () => {
    setShowSecurityModal(false);
    
    if (pendingAction === 'edit') {
      setShowEditModal(true);
    } else if (pendingAction === 'delete') {
      performDelete();
    }
    
    setPendingAction(null);
  };

  const performDelete = async () => {
    try {
      setIsDeleting(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-27d0d16c/places/${place.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        console.log('✅ Place deleted successfully');
        if (onPlaceUpdated) {
          onPlaceUpdated();
        }
      } else {
        const data = await response.json();
        console.error('❌ Delete error:', data.error);
        alert('O\'chirishda xatolik: ' + data.error);
      }
    } catch (error) {
      console.error('❌ Delete exception:', error);
      alert('O\'chirishda xatolik yuz berdi');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setShowEditModal(false);
    if (onPlaceUpdated) {
      onPlaceUpdated();
    }
  };

  if (isDeleting) {
    return (
      <div
        className="w-full text-center p-8 rounded-2xl"
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)',
        }}
      >
        <div 
          className="animate-spin rounded-full h-8 w-8 border-4 border-t-transparent mx-auto"
          style={{ 
            borderColor: `${accentColor.color}44`, 
            borderTopColor: 'transparent' 
          }}
        />
        <p 
          className="text-sm mt-3 font-semibold"
          style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
        >
          O'chirilmoqda...
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        className="w-full text-left transition-all active:scale-95 duration-200"
        style={{
          background: isDark
            ? (isIOS ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.6), rgba(20, 20, 20, 0.8))' : 'linear-gradient(135deg, #1a1a1a, #141414)')
            : (isIOS ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))' : 'linear-gradient(135deg, #ffffff, #fafafa)'),
          backdropFilter: isIOS ? 'blur(20px)' : undefined,
          border: isDark
            ? (isIOS ? '0.5px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(255, 255, 255, 0.08)')
            : (isIOS ? '0.5px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)'),
          boxShadow: isDark
            ? (isIOS ? '0 8px 32px rgba(0, 0, 0, 0.4)' : '6px 6px 16px #0d0d0d, -6px -6px 16px #272727')
            : (isIOS ? '0 8px 32px rgba(0, 0, 0, 0.12)' : '6px 6px 16px #d1d1d1, -6px -6px 16px #ffffff'),
          borderRadius: isIOS ? '24px' : '16px',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* Image */}
        <div className="relative overflow-hidden mx-auto" style={{ borderRadius: isIOS ? '24px 24px 0 0' : '16px 16px 0 0', width: '100%', maxWidth: '500px', aspectRatio: '1/1' }}>
          <img
            key={currentImageIndex}
            src={images[currentImageIndex]}
            alt={place.name}
            className="w-full h-full object-cover animate-fadeIn"
          />
          
          {/* Image Indicators - only show if multiple images */}
          {images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {images.map((_, index) => (
                <div
                  key={index}
                  className="transition-all duration-300"
                  style={{
                    width: currentImageIndex === index ? '20px' : '6px',
                    height: '6px',
                    borderRadius: '3px',
                    background: currentImageIndex === index 
                      ? accentColor.color 
                      : 'rgba(255, 255, 255, 0.5)',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
                  }}
                />
              ))}
            </div>
          )}
          
          {/* Status Badge - on LEFT side */}
          <div 
            className="absolute top-3 left-3 px-2 py-1 rounded-full backdrop-blur-md"
            style={{
              background: isCurrentlyOpen ? 'rgba(34, 197, 94, 0.95)' : 'rgba(239, 68, 68, 0.95)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            <span className="text-[10px] font-black text-white flex items-center gap-1">
              <span className={`inline-block size-1.5 rounded-full bg-white ${isCurrentlyOpen ? 'animate-pulse' : ''}`} />
              {isCurrentlyOpen ? 'OCHIQ' : 'YOPIQ'}
            </span>
          </div>

          {/* Distance Badge - on RIGHT side */}
          <div 
            className="absolute top-3 right-3 px-2 py-1 rounded-full backdrop-blur-md"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            <span className="text-[10px] font-bold text-white">📍 {place.distance}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Name */}
          <h3 
            className="text-base font-bold mb-2 line-clamp-1"
            style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
          >
            {place.name}
          </h3>

          {/* Category */}
          <div className="flex items-center gap-2 mb-2">
            <span 
              className="text-xs font-semibold px-2 py-1 rounded-lg"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                color: accentColor.color,
              }}
            >
              {place.category}
            </span>
          </div>

          {/* Rating - Enhanced with better stars */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`size-3.5 ${
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
              className="text-xs font-bold"
              style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
            >
              {place.rating.toFixed(1)}
            </span>
            <span 
              className="text-xs"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }}
            >
              ({place.reviews})
            </span>
          </div>

          {/* Address */}
          <div className="flex items-start gap-2 mb-2">
            <MapPin 
              className="size-3.5 flex-shrink-0 mt-0.5" 
              style={{ color: accentColor.color }}
              strokeWidth={2.5}
            />
            <span 
              className="text-xs line-clamp-1"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.6)' }}
            >
              {getLocationName(place.region, place.district) || place.address}
            </span>
          </div>

          {/* Opening Hours - Enhanced with status */}
          <div className="flex items-center gap-2">
            <Clock 
              className="size-3.5 flex-shrink-0" 
              style={{ color: isCurrentlyOpen ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)' }}
              strokeWidth={2.5}
            />
            <span 
              className="text-xs font-semibold"
              style={{ color: isCurrentlyOpen ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)' }}
            >
              {place.openingHours || 'Noma\'lum'}
            </span>
          </div>
        </div>
      </button>

      {/* Modals - outside button to prevent nesting warning */}
      <PlaceActionModal
        isOpen={showActionModal}
        onClose={() => setShowActionModal(false)}
        place={place}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <SecurityCodeModal
        isOpen={showSecurityModal}
        onClose={() => {
          setShowSecurityModal(false);
          setPendingAction(null);
        }}
        onSuccess={handleSecuritySuccess}
        action={pendingAction || 'edit'}
        title={pendingAction === 'delete' ? 'Joyni o\'chirish uchun' : 'Joyni tahrirlash uchun'}
      />

      <EditPlaceModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        place={place}
        onSuccess={handleEditSuccess}
      />

      {/* Animation styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-in-out;
        }
      `}</style>
    </>
  );
});