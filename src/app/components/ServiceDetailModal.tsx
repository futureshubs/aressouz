import { useTheme } from '../context/ThemeContext';
import { Service } from '../data/services';
import { X, Star, Phone, MapPin, Briefcase, Calendar, Clock, Award, CheckCircle, MessageCircle, Globe } from 'lucide-react';
import { useEffect } from 'react';
import { openExternalUrlSync } from '../utils/openExternalUrl';

interface ServiceDetailModalProps {
  service: Service;
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceDetailModal({ service, isOpen, onClose }: ServiceDetailModalProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCall = () => {
    window.location.href = `tel:${service.phone}`;
  };

  const handleMessage = () => {
    // Open messaging app or WhatsApp
    openExternalUrlSync(`https://wa.me/${service.phone.replace(/\D/g, '')}`);
  };

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      style={{
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div 
        className="relative w-full sm:max-w-2xl sm:mx-4 max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: isDark ? '#0a0a0a' : '#ffffff',
          boxShadow: isDark 
            ? '0 -8px 40px rgba(0, 0, 0, 0.6)' 
            : '0 -8px 40px rgba(0, 0, 0, 0.2)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 size-10 rounded-full flex items-center justify-center transition-all backdrop-blur-xl"
          style={{
            background: 'rgba(0, 0, 0, 0.4)',
            color: '#ffffff',
          }}
        >
          <X className="size-5" />
        </button>

        {/* Header Image */}
        <div className="relative h-64 sm:h-80 overflow-hidden">
          <img 
            src={service.image} 
            alt={service.name}
            className="w-full h-full object-cover"
          />
          <div 
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to top, ${isDark ? '#0a0a0a' : '#ffffff'}, transparent)`,
            }}
          />

          {/* Verified Badge */}
          {service.verified && (
            <div 
              className="absolute top-4 left-4 px-3 py-2 rounded-xl backdrop-blur-xl border flex items-center gap-2"
              style={{
                background: `${accentColor.color}ee`,
                borderColor: '#ffffff66',
              }}
            >
              <CheckCircle className="size-5 text-white" strokeWidth={2.5} />
              <span className="text-sm font-bold text-white">Tasdiqlangan</span>
            </div>
          )}

          {/* Rating */}
          <div 
            className="absolute top-4 right-16 px-3 py-2 rounded-xl backdrop-blur-xl border flex items-center gap-2"
            style={{
              background: 'rgba(0, 0, 0, 0.6)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <Star className="size-5 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-bold text-white">{service.rating}</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6">
          {/* Name & Profession */}
          <h2 
            className="text-2xl sm:text-3xl font-black mb-2"
            style={{ color: isDark ? '#ffffff' : '#111827' }}
          >
            {service.name}
          </h2>
          <p 
            className="text-lg sm:text-xl font-semibold mb-4"
            style={{ color: accentColor.color }}
          >
            {service.profession}
          </p>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div 
              className="p-3 rounded-2xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="size-4" style={{ color: accentColor.color }} />
                <span 
                  className="text-xs font-medium"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Tajriba
                </span>
              </div>
              <p 
                className="text-sm font-bold"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {service.experience}
              </p>
            </div>

            <div 
              className="p-3 rounded-2xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Award className="size-4" style={{ color: accentColor.color }} />
                <span 
                  className="text-xs font-medium"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Bajarilgan ishlar
                </span>
              </div>
              <p 
                className="text-sm font-bold"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {service.completedJobs} ta
              </p>
            </div>

            <div 
              className="p-3 rounded-2xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Star className="size-4" style={{ color: accentColor.color }} />
                <span 
                  className="text-xs font-medium"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Sharhlar
                </span>
              </div>
              <p 
                className="text-sm font-bold"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {service.reviewCount} ta
              </p>
            </div>

            <div 
              className="p-3 rounded-2xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe className="size-4" style={{ color: accentColor.color }} />
                <span 
                  className="text-xs font-medium"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                >
                  Tillar
                </span>
              </div>
              <p 
                className="text-xs font-bold"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {service.languages.join(', ')}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 
              className="text-lg font-bold mb-3"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Tavsif
            </h3>
            <p 
              className="text-sm leading-relaxed"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)' }}
            >
              {service.description}
            </p>
          </div>

          {/* Skills */}
          <div className="mb-6">
            <h3 
              className="text-lg font-bold mb-3"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Ko'nikmalar
            </h3>
            <div className="flex flex-wrap gap-2">
              {service.skills.map((skill, index) => (
                <div
                  key={index}
                  className="px-3 py-2 rounded-xl text-sm font-medium"
                  style={{
                    background: `${accentColor.color}20`,
                    color: accentColor.color,
                  }}
                >
                  {skill}
                </div>
              ))}
            </div>
          </div>

          {/* Work Schedule */}
          <div className="mb-6">
            <h3 
              className="text-lg font-bold mb-3"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              Ish jadvali
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Calendar className="size-5" style={{ color: accentColor.color }} />
                <div>
                  <p 
                    className="text-xs font-medium mb-0.5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Ish kunlari
                  </p>
                  <p 
                    className="text-sm font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {service.workDays.join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="size-5" style={{ color: accentColor.color }} />
                <div>
                  <p 
                    className="text-xs font-medium mb-0.5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Ish vaqti
                  </p>
                  <p 
                    className="text-sm font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {service.workHours}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="size-5" style={{ color: accentColor.color }} />
                <div>
                  <p 
                    className="text-xs font-medium mb-0.5"
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
                  >
                    Manzil
                  </p>
                  <p 
                    className="text-sm font-semibold"
                    style={{ color: isDark ? '#ffffff' : '#111827' }}
                  >
                    {service.location}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Price */}
          <div 
            className="mb-6 p-4 rounded-2xl"
            style={{
              background: `${accentColor.color}15`,
              border: `1px solid ${accentColor.color}30`,
            }}
          >
            <p 
              className="text-sm font-medium mb-1"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
            >
              Narx oralig'i
            </p>
            <p 
              className="text-2xl font-black"
              style={{ color: accentColor.color }}
            >
              {service.priceFrom.toLocaleString()} - {service.priceTo.toLocaleString()} so'm
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCall}
              className="py-4 px-6 rounded-2xl font-bold text-white transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{
                background: accentColor.color,
                boxShadow: `0 8px 24px ${accentColor.color}60`,
              }}
            >
              <Phone className="size-5" />
              <span>Qo'ng'iroq</span>
            </button>
            <button
              onClick={handleMessage}
              className="py-4 px-6 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                color: isDark ? '#ffffff' : '#111827',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)'}`,
              }}
            >
              <MessageCircle className="size-5" />
              <span>Xabar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
