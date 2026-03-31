import { X, MapPin, Navigation, ChevronRight, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';
import { regions } from '../data/regions';

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
  const { theme, accentColor } = useTheme();
  const isIOS = platform === 'ios';
  const isDark = theme === 'dark';

  if (!isOpen) return null;

  // Get selected region object
  const selectedRegionObj = regions.find(r => r.id === selectedRegion);

  // Create uzbekistanRegions mapping from regions.ts data
  const uzbekistanRegions: Record<string, string[]> = {};
  regions.forEach(region => {
    uzbekistanRegions[region.id] = region.districts.map(d => d.id);
  });

  const handleRegionSelect = (regionId: string) => {
    setSelectedRegion(regionId);
    setStep('district');
  };

  const handleDistrictSelect = (districtId: string) => {
    if (selectedRegion) {
      onLocationSelect(selectedRegion, districtId);
      onClose();
    }
  };

  // O'zbekiston viloyatlari koordinatalari (ID'lar bilan)
  const regionCoordinates: Record<string, { lat: number; lng: number }> = {
    'toshkent-sh': { lat: 41.2995, lng: 69.2401 },
    'toshkent': { lat: 41.3, lng: 69.5 },
    'andijon': { lat: 40.7821, lng: 72.3442 },
    'buxoro': { lat: 39.7747, lng: 64.4286 },
    'fargona': { lat: 40.3864, lng: 71.7864 },
    'jizzax': { lat: 40.1158, lng: 67.8422 },
    'xorazm': { lat: 41.3775, lng: 60.3647 },
    'namangan': { lat: 40.9983, lng: 71.6726 },
    'navoiy': { lat: 40.0844, lng: 65.3792 },
    'qashqadaryo': { lat: 38.8606, lng: 65.7897 },
    'qoraqalpogiston': { lat: 43.8041, lng: 59.4453 },
    'samarqand': { lat: 39.6270, lng: 66.9750 },
    'sirdaryo': { lat: 40.3833, lng: 68.7167 },
    'surxondaryo': { lat: 37.9403, lng: 67.5781 },
  };

  // Eng yaqin viloyatni topish (ID qaytaradi)
  const findNearestRegion = (lat: number, lng: number): string => {
    let nearestRegionId = 'toshkent-sh';
    let minDistance = Infinity;

    Object.entries(regionCoordinates).forEach(([regionId, coords]) => {
      // Haversine formula (masofani hisoblash)
      const R = 6371; // Yer radiusi (km)
      const dLat = (coords.lat - lat) * Math.PI / 180;
      const dLng = (coords.lng - lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat * Math.PI / 180) * Math.cos(coords.lat * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestRegionId = regionId; // ID qaytaradi
      }
    });

    return nearestRegionId;
  };

  // REAL Geolocation API with REVERSE GEOCODING
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
          console.log('✅ GPS Success:', position.coords);
          
          const { latitude, longitude } = position.coords;
          console.log(`📍 Koordinatalar: ${latitude}, ${longitude}`);
          
          try {
            // Reverse Geocoding (Nominatim API - OpenStreetMap)
            console.log('🌍 Nominatim API ga so\'rov yuborilmoqda...');
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=uz`,
              {
                headers: {
                  'User-Agent': 'Uzbekistan-Location-App'
                }
              }
            );
            
            if (!response.ok) {
              throw new Error('Nominatim API xatolik berdi');
            }
            
            const data = await response.json();
            console.log('🗺️ Nominatim natija:', data);
            
            // Manzil ma'lumotlarini olish
            const address = data.address;
            let detectedRegion = '';
            let detectedDistrict = '';
            
            // Viloyatni aniqlash (state, province, yoki region)
            const stateFromAPI = address.state || address.province || address.region || '';
            console.log(`📍 API'dan viloyat: ${stateFromAPI}`);
            
            // Tumanni aniqlash (county, city_district, suburb, city, town)
            const districtFromAPI = address.county || address.city_district || address.suburb || 
                                   address.city || address.town || address.village || '';
            console.log(`📍 API'dan tuman: ${districtFromAPI}`);
            
            // Viloyatni topish (bizning ro'yxatimizdan)
            Object.keys(uzbekistanRegions).forEach(region => {
              const regionLower = region.toLowerCase();
              const stateLower = stateFromAPI.toLowerCase();
              
              // Aniq mos kelish yoki qisman mos kelish
              if (stateLower.includes(regionLower) || regionLower.includes(stateLower) ||
                  stateLower.includes(region.replace(/'/g, '').toLowerCase())) {
                detectedRegion = region;
              }
            });
            
            // Agar viloyat topilmasa, eng yaqin viloyatni topish
            if (!detectedRegion) {
              console.log('⚠️ API viloyatni aniqlay olmadi, masofadan hisoblaymiz...');
              detectedRegion = findNearestRegion(latitude, longitude);
            }
            
            console.log(`✅ Aniqlangan viloyat: ${detectedRegion}`);
            
            // Tumanni topish (agar viloyat topilgan bo'lsa)
            if (detectedRegion) {
              const districts = uzbekistanRegions[detectedRegion as keyof typeof uzbekistanRegions];
              
              // API'dan kelgan tuman nomini bizning ro'yxatda qidirish
              if (districtFromAPI) {
                const districtLower = districtFromAPI.toLowerCase();
                
                // Aniq yoki qisman mos keluvchi tumanni topish
                const matchedDistrict = districts.find(d => {
                  const dLower = d.toLowerCase();
                  return dLower.includes(districtLower) || 
                         districtLower.includes(dLower) ||
                         districtLower.includes(d.replace(/'/g, '').toLowerCase()) ||
                         dLower.includes(districtFromAPI.replace(/'/g, '').toLowerCase());
                });
                
                if (matchedDistrict) {
                  detectedDistrict = matchedDistrict;
                  console.log(`✅ Aniqlangan tuman: ${detectedDistrict}`);
                }
              }
              
              // Agar tuman topilmasa, birinchi tumanni tanlash
              if (!detectedDistrict) {
                detectedDistrict = districts[0];
                console.log(`⚠️ Tuman aniqlanmadi, birinchi tuman tanlanadi: ${detectedDistrict}`);
              }
            }
            
            // Natijani saqlash va modal yopish
            console.log(`🎯 Final: ${detectedRegion} - ${detectedDistrict}`);
            onLocationSelect(detectedRegion, detectedDistrict);
            setIsDetecting(false);
            onClose();
            
          } catch (geoError) {
            console.error('❌ Reverse Geocoding xatolik:', geoError);
            console.log('⚠️ Masofadan hisoblash usuli ishlatiladi...');
            
            // Fallback: Eng yaqin viloyatni topish
            const detectedRegion = findNearestRegion(latitude, longitude);
            const districts = uzbekistanRegions[detectedRegion as keyof typeof uzbekistanRegions];
            const firstDistrict = districts[0];
            
            console.log(`🎯 Fallback: ${detectedRegion} - ${firstDistrict}`);
            onLocationSelect(detectedRegion, firstDistrict);
            setIsDetecting(false);
            onClose();
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
          enableHighAccuracy: true,  // Yuqori aniqlik
          timeout: 10000,            // 10 soniya timeout
          maximumAge: 0              // Keshni ishlatmaslik
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
      setStep('region');
    }
  };

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

          {/* Content */}
          <div className="px-4 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
            {step === 'region' ? (
              // Regions List
              regions.map((region) => (
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
            ) : (
              // Districts List
              selectedRegionObj?.districts.map((district) => (
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

        {/* Content */}
        <div className="px-4 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
          {step === 'region' ? (
            // Regions List
            regions.map((region) => (
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
          ) : (
            // Districts List
            selectedRegionObj?.districts.map((district) => (
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
          )}
        </div>
      </div>
    </div>
  );
}