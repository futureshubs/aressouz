import { X, MapPin, Navigation, ChevronRight, AlertCircle, Search } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { regions } from '../data/regions';
import { resolveRegionDistrictFromCoords } from '../utils/geolocationDetect';

const normalizeSearch = (s: string) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[''`ʻʼ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function filterLocations<T extends { name: string; id: string }>(items: T[], query: string): T[] {
  const q = normalizeSearch(query);
  if (!q) return items;
  return items.filter((x) => {
    const name = normalizeSearch(x.name);
    const id = normalizeSearch(x.id.replace(/-/g, ' '));
    return name.includes(q) || id.includes(q) || q.split(' ').every((w) => w && name.includes(w));
  });
}

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: Platform;
  selectedRegion: string;
  selectedDistrict: string;
  onLocationSelect: (regionId: string, districtId: string) => void;
}

export function LocationModal({ 
  isOpen, 
  onClose, 
  platform,
  selectedRegion: currentRegion,
  selectedDistrict: currentDistrict,
  onLocationSelect 
}: LocationModalProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(currentRegion || null);
  const [step, setStep] = useState<'region' | 'district'>('region');
  const [isDetecting, setIsDetecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [regionSearchQuery, setRegionSearchQuery] = useState('');
  const [districtSearchQuery, setDistrictSearchQuery] = useState('');
  const { theme, accentColor } = useTheme();
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  useEffect(() => {
    if (!isOpen) return;
    setRegionSearchQuery('');
    setDistrictSearchQuery('');
  }, [isOpen]);

  const selectedRegionObj = regions.find(r => r.id === selectedRegion);

  const filteredRegions = useMemo(
    () => filterLocations(regions, regionSearchQuery),
    [regionSearchQuery],
  );

  const filteredDistricts = useMemo(
    () => filterLocations(selectedRegionObj?.districts ?? [], districtSearchQuery),
    [selectedRegionObj, districtSearchQuery],
  );

  // Create uzbekistanRegions mapping from regions.ts data
  const uzbekistanRegions: Record<string, string[]> = {};
  regions.forEach(region => {
    uzbekistanRegions[region.id] = region.districts.map(d => d.id);
  });

  const handleRegionSelect = (regionId: string) => {
    setSelectedRegion(regionId);
    setDistrictSearchQuery('');
    setStep('district');
  };

  const handleDistrictSelect = (districtId: string) => {
    if (selectedRegion) {
      onLocationSelect(selectedRegion, districtId);
      onClose();
    }
  };

  // REAL Geolocation API + reverse geocode (`geolocationDetect.ts`)
  const handleDetectLocation = async () => {
    setIsDetecting(true);
    setErrorMessage(null);

    // Geolocation qo'llab-quvvatlanishini tekshirish
    if (!('geolocation' in navigator)) {
      setErrorMessage('❌ Brauzeringiz joylashuvni aniqlay olmaydi. Qo\'lda tanlang.');
      setIsDetecting(false);
      setTimeout(() => setErrorMessage(null), 4000);
      return;
    }

    try {
      // RUXSAT SO'RASH va koordinatalar olish
      navigator.geolocation.getCurrentPosition(
        // SUCCESS callback
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const { regionId, districtId } = await resolveRegionDistrictFromCoords(
              latitude,
              longitude,
            );
            onLocationSelect(regionId, districtId);
            setIsDetecting(false);
            onClose();
          } catch (geoError) {
            console.error('Joylashuvni qayta ishlashda xatolik:', geoError);
            setIsDetecting(false);
            setErrorMessage('Manzilni aniqlab bo‘lmadi. Qo‘lda tanlang.');
            setTimeout(() => setErrorMessage(null), 5000);
          }
        },
        // ERROR callback
        (error) => {
          console.error('❌ GPS Error:', error);
          setIsDetecting(false);
          
          // Xato xabarlarini ko'rsatish
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setErrorMessage('🚫 Ruxsat berilmadi. Sozlamalarda joylashuvni yoqing.');
              break;
            case error.POSITION_UNAVAILABLE:
              setErrorMessage('📡 Joylashuv aniqlanmadi. Qo\'lda tanlang.');
              break;
            case error.TIMEOUT:
              setErrorMessage('⏱️ Vaqt tugadi. Qaytadan urinib ko\'ring.');
              break;
            default:
              setErrorMessage('❌ Xatolik yuz berdi. Qo\'lda tanlang.');
          }
          
          // 5 soniyadan keyin xabarni o'chirish
          setTimeout(() => setErrorMessage(null), 5000);
        },
        // OPTIONS
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        }
      );
    } catch (error) {
      console.error('❌ Geolocation Error:', error);
      setErrorMessage('❌ Xatolik yuz berdi. Qo\'lda tanlang.');
      setIsDetecting(false);
      setTimeout(() => setErrorMessage(null), 4000);
    }
  };

  const handleBack = () => {
    if (step === 'district') {
      setDistrictSearchQuery('');
      setStep('region');
    }
  };

  if (!isOpen) return null;

  if (isIOS) {
    return (
      <div 
        className="fixed inset-0 z-[70] flex items-end justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0"
          style={{
            background: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(10px)',
          }}
        />

        {/* Modal Content */}
        <div 
          className="relative w-full max-w-md rounded-t-3xl overflow-hidden"
          style={{
            background: isDark 
              ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(10, 10, 10, 0.98))'
              : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.98))',
            maxHeight: '80vh',
            boxShadow: isDark 
              ? '0 -8px 32px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
              : '0 -8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between"
            style={{
              background: isDark 
                ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(15, 15, 15, 0.95))'
                : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
              backdropFilter: 'blur(20px)',
              borderBottom: isDark 
                ? '0.5px solid rgba(255, 255, 255, 0.1)'
                : '0.5px solid rgba(0, 0, 0, 0.1)',
            }}
          >
            {step === 'district' ? (
              <button
                onClick={handleBack}
                className="text-base font-semibold active:scale-95 transition-all"
                style={{ color: accentColor.color }}
              >
                ← Orqaga
              </button>
            ) : (
              <h2 
                className="text-xl font-bold"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              >
                {step === 'region' ? 'Viloyatni tanlang' : 'Tumanni tanlang'}
              </h2>
            )}
            <button 
              onClick={onClose}
              className="p-2 rounded-xl transition-all active:scale-90"
              style={{
                background: isDark 
                  ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))'
                  : 'linear-gradient(145deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.04))',
                boxShadow: isDark 
                  ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                  : '0 2px 8px rgba(0, 0, 0, 0.1)',
                border: isDark 
                  ? '0.5px solid rgba(255, 255, 255, 0.15)'
                  : '0.5px solid rgba(0, 0, 0, 0.15)',
              }}
            >
              <X 
                className="size-5" 
                style={{ color: isDark ? '#ffffff' : '#374151' }}
                strokeWidth={2.5} 
              />
            </button>
          </div>

          {/* Detect Current Location Button */}
          {step === 'region' && (
            <div className="px-4 py-3 space-y-2">
              <button
                onClick={handleDetectLocation}
                disabled={isDetecting}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-2xl transition-all active:scale-98"
                style={{
                  backgroundImage: accentColor.gradient,
                  boxShadow: isDark 
                    ? `0 8px 24px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                    : `0 4px 16px ${accentColor.color}4d, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
                  border: `0.5px solid ${accentColor.color}4d`,
                }}
              >
                <Navigation className={`size-5 text-white ${isDetecting ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
                <span className="text-white font-semibold">
                  {isDetecting ? 'Aniqlanmoqda...' : 'Joriy joyni aniqlash'}
                </span>
              </button>

              {/* Error Message */}
              {errorMessage && (
                <div 
                  className="flex items-start gap-2 p-3 rounded-xl animate-pulse"
                  style={{
                    background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                  }}
                >
                  <AlertCircle className="size-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                  <p className="text-sm font-medium text-red-500">
                    {errorMessage}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Location search */}
          <div className="px-4 pb-2">
            <div
              className="relative flex items-center rounded-2xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
                border: isDark ? '0.5px solid rgba(255, 255, 255, 0.12)' : '0.5px solid rgba(0, 0, 0, 0.08)',
                boxShadow: isDark
                  ? 'inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                  : 'inset 0 1px 0 rgba(255, 255, 255, 0.8)',
              }}
            >
              <Search
                className="absolute left-3.5 size-5 shrink-0 pointer-events-none opacity-45"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.45)' }}
                strokeWidth={2.25}
                aria-hidden
              />
              <input
                type="search"
                enterKeyHint="search"
                placeholder={step === 'region' ? 'Viloyat qidirish...' : 'Tuman qidirish...'}
                value={step === 'region' ? regionSearchQuery : districtSearchQuery}
                onChange={(e) =>
                  step === 'region'
                    ? setRegionSearchQuery(e.target.value)
                    : setDistrictSearchQuery(e.target.value)
                }
                className="w-full min-h-[48px] py-3 pl-11 pr-3 bg-transparent text-base outline-none"
                style={{ color: isDark ? '#ffffff' : '#111827' }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
            {step === 'region' ? (
              filteredRegions.length === 0 ? (
                <p
                  className="text-center py-10 px-4 text-sm font-medium"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}
                >
                  Hech narsa topilmadi
                </p>
              ) : (
              filteredRegions.map((region) => (
                <button
                  key={region.id}
                  onClick={() => handleRegionSelect(region.id)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl transition-all active:scale-98"
                  style={{
                    background: currentRegion === region.id
                      ? isDark
                        ? `linear-gradient(145deg, ${accentColor.color}40, ${accentColor.color}26)`
                        : `linear-gradient(145deg, ${accentColor.color}26, ${accentColor.color}1a)`
                      : isDark 
                        ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.7), rgba(20, 20, 20, 0.9))'
                        : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                    backdropFilter: 'blur(20px)',
                    border: currentRegion === region.id 
                      ? `0.5px solid ${accentColor.color}66`
                      : isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: currentRegion === region.id
                      ? isDark 
                        ? `0 8px 24px ${accentColor.color}66, 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                        : `0 4px 16px ${accentColor.color}40, 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)`
                      : isDark 
                        ? '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)' 
                        : '0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{
                        background: currentRegion === region.id
                          ? isDark
                            ? `linear-gradient(135deg, ${accentColor.color}66, ${accentColor.color}4d)`
                            : `linear-gradient(135deg, ${accentColor.color}40, ${accentColor.color}26)`
                          : isDark
                            ? `linear-gradient(135deg, ${accentColor.color}26, ${accentColor.color}1a)`
                            : `linear-gradient(135deg, ${accentColor.color}1a, ${accentColor.color}0f)`,
                        border: `1px solid ${accentColor.color}4d`,
                        boxShadow: isDark 
                          ? `0 2px 8px ${accentColor.color}33, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
                          : `0 1px 4px ${accentColor.color}26, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                      }}
                    >
                      <MapPin 
                        className="size-5 drop-shadow-lg" 
                        style={{ color: accentColor.color }} 
                        strokeWidth={2.5} 
                      />
                    </div>
                    <span 
                      className="font-semibold drop-shadow-sm"
                      style={{ 
                        color: currentRegion === region.id 
                          ? accentColor.color 
                          : isDark ? '#ffffff' : '#111827' 
                      }}
                    >
                      {region.name}
                    </span>
                  </div>
                  <ChevronRight 
                    className="size-5 drop-shadow" 
                    style={{ color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)' }} 
                    strokeWidth={2.5} 
                  />
                </button>
              ))
            )
            ) : (
              filteredDistricts.length === 0 ? (
                <p
                  className="text-center py-10 px-4 text-sm font-medium"
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}
                >
                  Hech narsa topilmadi
                </p>
              ) : (
              filteredDistricts.map((district) => (
                <button
                  key={district.id}
                  onClick={() => handleDistrictSelect(district.id)}
                  className="w-full flex items-center justify-between p-4 rounded-2xl transition-all active:scale-98"
                  style={{
                    background: currentDistrict === district.id
                      ? isDark
                        ? `linear-gradient(145deg, ${accentColor.color}40, ${accentColor.color}26)`
                        : `linear-gradient(145deg, ${accentColor.color}26, ${accentColor.color}1a)`
                      : isDark 
                        ? 'linear-gradient(145deg, rgba(30, 30, 30, 0.7), rgba(20, 20, 20, 0.9))'
                        : 'linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
                    backdropFilter: 'blur(20px)',
                    border: currentDistrict === district.id 
                      ? `0.5px solid ${accentColor.color}66`
                      : isDark ? '0.5px solid rgba(255, 255, 255, 0.1)' : '0.5px solid rgba(0, 0, 0, 0.1)',
                    boxShadow: currentDistrict === district.id
                      ? isDark 
                        ? `0 8px 24px ${accentColor.color}66, 0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)`
                        : `0 4px 16px ${accentColor.color}40, 0 2px 8px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.6)`
                      : isDark 
                        ? '0 4px 12px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)' 
                        : '0 2px 8px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                  }}
                >
                  <span 
                    className="font-semibold drop-shadow-sm"
                    style={{ 
                      color: currentDistrict === district.id 
                        ? accentColor.color 
                        : isDark ? '#ffffff' : '#111827' 
                    }}
                  >
                    {district.name}
                  </span>
                  {currentDistrict === district.id && (
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ 
                        backgroundImage: accentColor.gradient,
                        boxShadow: isDark 
                          ? `0 4px 12px ${accentColor.color}80, inset 0 1px 0 rgba(255, 255, 255, 0.3)`
                          : `0 2px 8px ${accentColor.color}66, inset 0 1px 0 rgba(255, 255, 255, 0.5)`,
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-lg"></div>
                    </div>
                  )}
                </button>
              ))
            )
            )}
          </div>
        </div>
      </div>
    );
  }

  // Android Material Design
  return (
    <div 
      className="fixed inset-0 z-[70] flex items-end justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'rgba(0, 0, 0, 0.8)',
        }}
      />

      {/* Modal Content */}
      <div 
        className="relative w-full max-w-md rounded-t-2xl overflow-hidden"
        style={{
          background: isDark 
            ? 'linear-gradient(135deg, #1e1e1e, #121212)'
            : 'linear-gradient(135deg, #ffffff, #f5f5f5)',
          maxHeight: '80vh',
          boxShadow: isDark 
            ? '0 -4px 24px rgba(0, 0, 0, 0.8)'
            : '0 -4px 20px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center justify-between"
          style={{
            background: isDark 
              ? 'linear-gradient(to bottom, rgba(20, 20, 20, 0.98), rgba(15, 15, 15, 0.95))'
              : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.98), rgba(250, 250, 250, 0.95))',
            backdropFilter: 'blur(20px)',
            borderBottom: isDark 
              ? '0.5px solid rgba(255, 255, 255, 0.1)'
              : '0.5px solid rgba(0, 0, 0, 0.1)',
          }}
        >
          {step === 'district' ? (
            <button
              onClick={handleBack}
              className="text-base font-semibold active:scale-95 transition-all"
              style={{ color: accentColor.color }}
            >
              ← Orqaga
            </button>
          ) : (
            <h2 
              className="text-xl font-bold"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            >
              {step === 'region' ? 'Viloyatni tanlang' : 'Tumanni tanlang'}
            </h2>
          )}
          <button 
            onClick={onClose}
            className="p-2 rounded-xl transition-all active:scale-90"
            style={{
              background: isDark 
                ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))'
                : 'linear-gradient(145deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.04))',
              boxShadow: isDark 
                ? '0 4px 12px rgba(0, 0, 0, 0.3)'
                : '0 2px 8px rgba(0, 0, 0, 0.1)',
              border: isDark 
                ? '0.5px solid rgba(255, 255, 255, 0.15)'
                : '0.5px solid rgba(0, 0, 0, 0.15)',
            }}
          >
            <X 
              className="size-5" 
              style={{ color: isDark ? '#ffffff' : '#374151' }}
              strokeWidth={2.5} 
            />
          </button>
        </div>

        {/* Detect Current Location Button */}
        {step === 'region' && (
          <div className="px-4 py-3 space-y-2">
            <button
              onClick={handleDetectLocation}
              disabled={isDetecting}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl transition-all active:scale-98"
              style={{
                backgroundImage: accentColor.gradient,
                boxShadow: isDark 
                  ? `0 4px 16px ${accentColor.color}80, inset 0 1px 0 rgba(255, 255, 255, 0.15)`
                  : `0 3px 12px ${accentColor.color}50, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
                border: `1px solid ${accentColor.color}4d`,
              }}
            >
              <Navigation className={`size-5 text-white ${isDetecting ? 'animate-pulse' : ''}`} strokeWidth={2.5} />
              <span className="text-white font-bold">
                {isDetecting ? 'Aniqlanmoqda...' : 'Joriy joyni aniqlash'}
              </span>
            </button>

            {/* Error Message */}
            {errorMessage && (
              <div 
                className="flex items-start gap-2 p-3 rounded-xl animate-pulse"
                style={{
                  background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <AlertCircle className="size-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
                <p className="text-sm font-medium text-red-500">
                  {errorMessage}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Location search */}
        <div className="px-4 pb-2">
          <div
            className="relative flex items-center rounded-xl"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <Search
              className="absolute left-3 size-5 shrink-0 pointer-events-none opacity-45"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.45)' }}
              strokeWidth={2}
              aria-hidden
            />
            <input
              type="search"
              enterKeyHint="search"
              placeholder={step === 'region' ? 'Viloyat qidirish...' : 'Tuman qidirish...'}
              value={step === 'region' ? regionSearchQuery : districtSearchQuery}
              onChange={(e) =>
                step === 'region'
                  ? setRegionSearchQuery(e.target.value)
                  : setDistrictSearchQuery(e.target.value)
              }
              className="w-full min-h-[48px] py-3 pl-10 pr-3 bg-transparent text-base font-bold outline-none"
              style={{ color: isDark ? '#ffffff' : '#111827' }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="px-4 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
          {step === 'region' ? (
            filteredRegions.length === 0 ? (
              <p
                className="text-center py-10 px-4 text-sm font-medium"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}
              >
                Hech narsa topilmadi
              </p>
            ) : (
            filteredRegions.map((region) => (
              <button
                key={region.id}
                onClick={() => handleRegionSelect(region.id)}
                className="w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-98"
                style={{
                  background: currentRegion === region.id
                    ? `linear-gradient(135deg, ${accentColor.color}33, ${accentColor.color}1f)`
                    : isDark 
                      ? 'linear-gradient(135deg, #1a1a1a, #141414)'
                      : 'linear-gradient(135deg, #ffffff, #f9f9f9)',
                  border: currentRegion === region.id 
                    ? `1px solid ${accentColor.color}4d`
                    : isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: currentRegion === region.id
                    ? isDark 
                      ? `0 2px 12px ${accentColor.color}4d`
                      : `0 2px 10px ${accentColor.color}33`
                    : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{
                      background: currentRegion === region.id
                        ? `${accentColor.color}33`
                        : `${accentColor.color}1a`,
                      border: `1px solid ${accentColor.color}4d`,
                    }}
                  >
                    <MapPin className="size-5" style={{ color: accentColor.color }} strokeWidth={2} />
                  </div>
                  <span 
                    className="font-bold"
                    style={{ 
                      color: currentRegion === region.id 
                        ? accentColor.color 
                        : isDark ? '#ffffff' : '#111827' 
                    }}
                  >
                    {region.name}
                  </span>
                </div>
                <ChevronRight 
                  className="size-5" 
                  style={{ color: isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)' }}
                  strokeWidth={2} 
                />
              </button>
            ))
          )
          ) : (
            filteredDistricts.length === 0 ? (
              <p
                className="text-center py-10 px-4 text-sm font-medium"
                style={{ color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.45)' }}
              >
                Hech narsa topilmadi
              </p>
            ) : (
            filteredDistricts.map((district) => (
              <button
                key={district.id}
                onClick={() => handleDistrictSelect(district.id)}
                className="w-full flex items-center justify-between p-4 rounded-xl transition-all active:scale-98"
                style={{
                  background: currentDistrict === district.id
                    ? `linear-gradient(135deg, ${accentColor.color}33, ${accentColor.color}1f)`
                    : isDark 
                      ? 'linear-gradient(135deg, #1a1a1a, #141414)'
                      : 'linear-gradient(135deg, #ffffff, #f9f9f9)',
                  border: currentDistrict === district.id 
                    ? `1px solid ${accentColor.color}4d`
                    : isDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: currentDistrict === district.id
                    ? isDark 
                      ? `0 2px 12px ${accentColor.color}4d`
                      : `0 2px 10px ${accentColor.color}33`
                    : 'none',
                }}
              >
                <span 
                  className="font-bold"
                  style={{ 
                    color: currentDistrict === district.id 
                      ? accentColor.color 
                      : isDark ? '#ffffff' : '#111827' 
                  }}
                >
                  {district.name}
                </span>
                {currentDistrict === district.id && (
                  <div 
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: accentColor.color }}
                  >
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                )}
              </button>
            ))
          )
          )}
        </div>
      </div>
    </div>
  );
}