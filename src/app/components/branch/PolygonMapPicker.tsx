import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { X, Trash2, Save, MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface PolygonMapPickerProps {
  isDark: boolean;
  accentColor: { color: string; gradient: string };
  initialPolygon?: { lat: number; lng: number }[];
  onSave: (polygon: { lat: number; lng: number }[]) => void;
  onClose: () => void;
}

export default function PolygonMapPicker({
  isDark,
  accentColor,
  initialPolygon = [],
  onSave,
  onClose,
}: PolygonMapPickerProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polygonRef = useRef<L.Polygon | null>(null);
  const [points, setPoints] = useState<{ lat: number; lng: number }[]>(initialPolygon);
  const pointsRef = useRef<{ lat: number; lng: number }[]>(initialPolygon);

  // Create custom icon
  const createNumberIcon = (number: number, color: string) => {
    return L.divIcon({
      html: `
        <div style="position: relative; width: 40px; height: 50px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
            <path d="M20 0C9 0 0 9 0 20c0 15 20 30 20 30s20-15 20-30C40 9 31 0 20 0z" fill="${color}"/>
            <circle cx="20" cy="20" r="12" fill="white"/>
            <text x="20" y="26" font-size="16" font-weight="bold" text-anchor="middle" fill="${color}">${number}</text>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [40, 50],
      iconAnchor: [20, 50],
    });
  };

  // Update markers and polygon
  const updateMap = (newPoints: { lat: number; lng: number }[]) => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Clear existing polygon
    if (polygonRef.current) {
      polygonRef.current.remove();
      polygonRef.current = null;
    }

    // Add new markers
    newPoints.forEach((point, index) => {
      const marker = L.marker([point.lat, point.lng], {
        icon: createNumberIcon(index + 1, accentColor.color),
      }).addTo(mapRef.current!);

      marker.bindPopup(`
        <div style="text-align: center;">
          <p style="font-weight: bold; margin: 0 0 4px 0;">Nuqta ${index + 1}</p>
          <p style="font-size: 12px; margin: 0;">Lat: ${point.lat.toFixed(6)}</p>
          <p style="font-size: 12px; margin: 0 0 8px 0;">Lng: ${point.lng.toFixed(6)}</p>
          <button 
            onclick="window.dispatchEvent(new CustomEvent('removePoint', { detail: ${index} }))"
            style="padding: 4px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;"
          >
            O'chirish
          </button>
        </div>
      `);

      markersRef.current.push(marker);
    });

    // Add polygon if we have at least 3 points
    if (newPoints.length >= 3) {
      polygonRef.current = L.polygon(
        newPoints.map(p => [p.lat, p.lng]),
        {
          color: accentColor.color,
          fillColor: accentColor.color,
          fillOpacity: 0.2,
          weight: 3,
        }
      ).addTo(mapRef.current!);
    }
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Get initial center
    let center: [number, number] = [41.2995, 69.2401]; // Tashkent

    // Try to get user location
    if (navigator.geolocation && points.length === 0) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (mapRef.current) {
            mapRef.current.setView([position.coords.latitude, position.coords.longitude], 13);
          }
        },
        (error) => {
          console.log('Location error:', error);
        }
      );
    }

    // Create map
    const map = L.map(mapContainerRef.current).setView(center, 13);
    mapRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Handle map clicks
    map.on('click', (e) => {
      const currentPoints = pointsRef.current;
      if (currentPoints.length < 10) {
        const newPoints = [...currentPoints, { lat: e.latlng.lat, lng: e.latlng.lng }];
        setPoints(newPoints);
      }
    });

    // Initial render
    updateMap(points);

    // Listen for remove point events
    const handleRemovePointEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const index = customEvent.detail;
      setPoints(prevPoints => prevPoints.filter((_, i) => i !== index));
    };

    window.addEventListener('removePoint', handleRemovePointEvent);

    return () => {
      window.removeEventListener('removePoint', handleRemovePointEvent);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update map when points change
  useEffect(() => {
    pointsRef.current = points;
    updateMap(points);
  }, [points, accentColor.color]);

  const handleRemovePoint = (index: number) => {
    setPoints(points.filter((_, i) => i !== index));
  };

  const handleClear = () => {
    setPoints([]);
  };

  const handleSave = () => {
    if (points.length < 3) {
      alert('Kamida 3 ta nuqta qo\'shing!');
      return;
    }
    onSave(points);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0, 0, 0, 0.8)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-6xl h-[90vh] rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: isDark ? '#1a1a1a' : '#ffffff',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div>
            <h2 className="text-xl font-bold">Polygon chizish</h2>
            <p
              className="text-sm mt-1"
              style={{ color: isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)' }}
            >
              Haritada bosib polygon chizing ({points.length}/10 nuqta)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-all active:scale-95"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
            }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Map Container */}
        <div className="flex-1 relative">
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

          {/* Info overlay */}
          <div
            className="absolute top-4 left-4 p-4 rounded-2xl border shadow-lg max-w-xs z-[1000]"
            style={{
              background: isDark ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-5 h-5" style={{ color: accentColor.color }} />
              <p className="font-bold">Qo'llanma</p>
            </div>
            <ul className="text-sm space-y-1" style={{ color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.7)' }}>
              <li>• Haritada bosib nuqta qo'shing</li>
              <li>• Nuqtalar 1, 2, 3... raqamlar bilan belgilanadi</li>
              <li>• Kamida 3 ta nuqta kerak</li>
              <li>• Maksimal 10 ta nuqta qo'shish mumkin</li>
              <li>• Nuqtani o'chirish uchun ustiga bosing</li>
            </ul>
          </div>
        </div>

        {/* Points List & Actions */}
        <div
          className="p-4 border-t"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Points list */}
          {points.length > 0 && (
            <div
              className="mb-4 p-3 rounded-xl border max-h-32 overflow-y-auto"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-sm font-semibold mb-2">Qo'shilgan nuqtalar:</p>
              <div className="grid grid-cols-2 gap-2">
                {points.map((point, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 rounded-lg"
                    style={{
                      background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: accentColor.color }}
                      >
                        {index + 1}
                      </div>
                      <span className="text-xs">
                        {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemovePoint(index)}
                      className="p-1 rounded-lg transition-all active:scale-95"
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#ef4444',
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          {points.length > 0 && points.length < 3 && (
            <div
              className="mb-4 p-3 rounded-xl border"
              style={{
                background: 'rgba(251, 191, 36, 0.1)',
                borderColor: '#fbbf24',
                color: '#fbbf24',
              }}
            >
              <p className="text-sm">⚠️ Polygon yaratish uchun yana {3 - points.length} ta nuqta qo'shing</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {points.length > 0 && (
              <button
                onClick={handleClear}
                className="px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444',
                }}
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5" />
                  <span>Tozalash</span>
                </div>
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all active:scale-95"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              }}
            >
              Bekor qilish
            </button>

            <button
              onClick={handleSave}
              disabled={points.length < 3}
              className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: accentColor.gradient,
                color: '#ffffff',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <Save className="w-5 h-5" />
                <span>Saqlash ({points.length} nuqta)</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}