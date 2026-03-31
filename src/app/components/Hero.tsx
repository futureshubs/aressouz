import { useState, useEffect, memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const banners = [
  {
    id: 1,
    title: "Premium Texnologiyalar",
    subtitle: "Eng yangi mahsulotlar 20% chegirma bilan",
    image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=1200&q=80",
    gradient: "from-blue-600 to-purple-600"
  },
  {
    id: 2,
    title: "Smart Uy Qurilmalari",
    subtitle: "Uyingizni aqlli qiling - 15% chegirma",
    image: "https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&q=80",
    gradient: "from-teal-500 to-cyan-600"
  },
  {
    id: 3,
    title: "Gaming Aksessuarlar",
    subtitle: "O'yinchilar uchun eng yaxshi tanlov",
    image: "https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1200&q=80",
    gradient: "from-red-500 to-orange-500"
  }
];

export const Hero = memo(function Hero() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, []);

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + banners.length) % banners.length);
  };

  return (
    <div className="relative px-3 sm:px-6 lg:px-8 py-4 sm:py-6 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative h-40 sm:h-48 rounded-2xl sm:rounded-3xl overflow-hidden">
          {/* Carousel Container */}
          <div 
            className="flex transition-transform duration-700 ease-out h-full"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {banners.map((banner) => (
              <div
                key={banner.id}
                className="min-w-full h-full relative"
              >
                {/* Banner Card with 3D effect */}
                <div 
                  className={`relative h-full rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br ${banner.gradient}`}
                  style={{
                    boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 10px 25px -5px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.2)'
                  }}
                >
                  {/* Background Image with overlay */}
                  <div className="absolute inset-0">
                    <img 
                      src={banner.image} 
                      alt={banner.title}
                      className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
                  </div>

                  {/* Decorative blur circles */}
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-32 h-32 sm:w-40 sm:h-40 bg-white/20 rounded-full blur-3xl" />
                    <div className="absolute -bottom-10 -left-10 w-32 h-32 sm:w-40 sm:h-40 bg-white/20 rounded-full blur-3xl" />
                  </div>

                  {/* Content */}
                  <div className="relative z-10 h-full flex items-center px-5 sm:px-8">
                    <div>
                      <h2 
                        className="text-2xl sm:text-3xl lg:text-4xl text-white font-bold mb-1 sm:mb-2"
                        style={{
                          textShadow: '0 4px 12px rgba(0, 0, 0, 0.5), 0 2px 4px rgba(0, 0, 0, 0.3)'
                        }}
                      >
                        {banner.title}
                      </h2>
                      <p 
                        className="text-sm sm:text-base lg:text-lg text-white/95"
                        style={{
                          textShadow: '0 2px 8px rgba(0, 0, 0, 0.4)'
                        }}
                      >
                        {banner.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* 3D highlight effect */}
                  <div 
                    className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"
                  />
                  
                  {/* Bottom shadow for depth */}
                  <div 
                    className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/20 to-transparent pointer-events-none"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Navigation Buttons */}
          <button
            onClick={goToPrev}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-xl bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/20 text-white transition-all active:scale-90 z-20"
            style={{
              boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            <ChevronLeft className="size-4 sm:size-5" />
          </button>

          <button
            onClick={goToNext}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2 sm:p-2.5 rounded-xl bg-black/30 hover:bg-black/50 backdrop-blur-md border border-white/20 text-white transition-all active:scale-90 z-20"
            style={{
              boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            <ChevronRight className="size-4 sm:size-5" />
          </button>

          {/* Indicators */}
          <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className="transition-all duration-300"
                style={{
                  width: currentIndex === index ? '24px' : '8px',
                  height: '8px',
                  borderRadius: '4px',
                  background: currentIndex === index 
                    ? 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))'
                    : 'rgba(255, 255, 255, 0.3)',
                  boxShadow: currentIndex === index 
                    ? '0 2px 8px rgba(255, 255, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3)' 
                    : 'none'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
