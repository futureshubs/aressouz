import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ChevronLeft, ChevronRight, Tag, ExternalLink } from 'lucide-react';
import { useBanners, Banner } from '../hooks/useBanners';

interface BannerCarouselProps {
  category?: Banner['category'];
  region?: string;
  district?: string;
  autoRotate?: boolean;
  interval?: number; // milliseconds
}

export function BannerCarousel({ 
  category, 
  region, 
  district, 
  autoRotate = true, 
  interval = 5000 
}: BannerCarouselProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  console.log('📢 BannerCarousel render:', { category, region, district });
  
  // Load banners using hook
  const { banners, isLoading, error } = useBanners(category, region, district);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-rotate banners
  useEffect(() => {
    if (!autoRotate || !banners || banners.length <= 1 || isHovered) {
      return;
    }

    timerRef.current = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, interval);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [autoRotate, interval, banners, isHovered]);

  const goToNext = () => {
    if (!banners || banners.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
  };

  const goToPrevious = () => {
    if (!banners || banners.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex - 1 + banners.length) % banners.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (isLoading) {
    return null; // Don't show loading state for banners
  }

  if (error || !banners || banners.length === 0) {
    return null; // Don't show empty state for banners
  }

  const currentBanner = banners[currentIndex];

  return (
    <div 
      className="relative w-full h-64 md:h-80 lg:h-96 rounded-3xl overflow-hidden group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        boxShadow: isDark 
          ? '0 20px 60px rgba(0, 0, 0, 0.4)'
          : '0 20px 60px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Banner Image with Gradient Overlay */}
      <div className="absolute inset-0">
        <img 
          src={currentBanner.image} 
          alt={currentBanner.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div 
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.2) 100%)'
          }}
        />
      </div>

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8 lg:p-10">
        <div className="space-y-3">
          <h3 className="text-2xl md:text-3xl lg:text-4xl font-bold text-white drop-shadow-lg">
            {currentBanner.name}
          </h3>
          
          {currentBanner.description && (
            <p className="text-sm md:text-base text-white/90 max-w-2xl line-clamp-2">
              {currentBanner.description}
            </p>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            {currentBanner.promoCode && (
              <div 
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm backdrop-blur-md"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}
              >
                <Tag className="w-4 h-4 text-white" />
                <span className="text-white">{currentBanner.promoCode}</span>
              </div>
            )}

            {currentBanner.link && (
              <a
                href={currentBanner.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm backdrop-blur-md transition-all active:scale-95"
                style={{ 
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#000000'
                }}
              >
                <span>Batafsil</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {banners.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 active:scale-90"
            style={{ 
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-md transition-all opacity-0 group-hover:opacity-100 active:scale-90"
            style={{ 
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)'
            }}
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {banners.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className="transition-all rounded-full"
              style={{
                width: currentIndex === index ? '32px' : '8px',
                height: '8px',
                background: currentIndex === index 
                  ? 'rgba(255, 255, 255, 0.9)'
                  : 'rgba(255, 255, 255, 0.4)',
              }}
            />
          ))}
        </div>
      )}

      {/* Counter */}
      {banners.length > 1 && (
        <div 
          className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-md"
          style={{ 
            background: 'rgba(0, 0, 0, 0.5)',
            color: 'white'
          }}
        >
          {currentIndex + 1} / {banners.length}
        </div>
      )}
    </div>
  );
}