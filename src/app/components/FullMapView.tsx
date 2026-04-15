import { memo, useState, useEffect, useRef } from 'react';
import { X, Navigation } from 'lucide-react';
import L from 'leaflet';
import { Place } from '../data/places';
import { GasStation } from '../data/gasStations';
import { Platform } from '../utils/platform';
import { useTheme } from '../context/ThemeContext';

interface FullMapViewProps {
  places: Place[];
  gasStations: GasStation[];
  onClose: () => void;
  onPlaceClick: (place: Place) => void;
  onStationClick: (station: GasStation) => void;
  platform: Platform;
}

// Custom marker icon for places
const createPlaceIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="transform: rotate(45deg); font-size: 14px;">📍</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Custom marker icon for gas stations
const createGasIcon = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px;
        height: 32px;
        background: #ef4444;
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 4px 8px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="transform: rotate(45deg); font-size: 14px;">⛽</div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

export const FullMapView = memo(function FullMapView({ 
  places, 
  gasStations, 
  onClose, 
  onPlaceClick, 
  onStationClick,
  platform 
}: FullMapViewProps) {
  const { theme, accentColor } = useTheme();
  const isDark = theme === 'dark';
  const [selectedType, setSelectedType] = useState<'places' | 'gas' | 'all'>('all');
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Tashkent center coordinates
  const centerLat = 41.311151;
  const centerLng = 69.279737;
  const defaultZoom = 12;

  const filteredPlaces = selectedType === 'gas' ? [] : places;
  const filteredStations = selectedType === 'places' ? [] : gasStations;

  // Calculate map center based on available places
  const calculateCenter = (): [number, number] => {
    const allCoords = [
      ...filteredPlaces
        .filter(p => p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 2)
        .map(p => p.coordinates),
      ...filteredStations
        .filter(s => s.coordinates && Array.isArray(s.coordinates) && s.coordinates.length >= 2)
        .map(s => s.coordinates)
    ];
    
    if (allCoords.length === 0) return [centerLat, centerLng];
    
    const avgLat = allCoords.reduce((sum, coord) => sum + coord[0], 0) / allCoords.length;
    const avgLng = allCoords.reduce((sum, coord) => sum + coord[1], 0) / allCoords.length;
    
    return [avgLat, avgLng];
  };

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const mapCenter = calculateCenter();
    
    // Create map
    const map = L.map(mapContainerRef.current).setView(mapCenter, defaultZoom);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update markers when places or filter changes
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add place markers
    filteredPlaces.forEach((place) => {
      // Skip if coordinates are invalid
      if (!place.coordinates || !Array.isArray(place.coordinates) || place.coordinates.length < 2) {
        console.warn('⚠️ Place has invalid coordinates:', place.name, place.coordinates);
        return;
      }
      
      const marker = L.marker([place.coordinates[0], place.coordinates[1]], {
        icon: createPlaceIcon(accentColor.color)
      });

      const popupContent = `
        <div style="min-width: 200px; cursor: pointer;" class="leaflet-popup-content-custom">
          <h3 style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${place.name}</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${place.category}</p>
          <p style="font-size: 12px; color: #888; margin-bottom: 8px;">${place.location}</p>
          ${place.distance ? `<p style="font-size: 12px; font-weight: 600; color: ${accentColor.color}; margin-bottom: 8px;">📍 ${place.distance}</p>` : ''}
          <p style="font-size: 12px; color: #3b82f6; font-weight: 600; margin-top: 8px;">Batafsil ko'rish →</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      
      marker.on('click', () => {
        onPlaceClick(place);
      });

      marker.on('popupopen', () => {
        const popupElement = marker.getPopup()?.getElement();
        if (popupElement) {
          popupElement.addEventListener('click', () => {
            onPlaceClick(place);
          });
        }
      });

      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Add gas station markers
    filteredStations.forEach((station) => {
      const marker = L.marker([station.coordinates[0], station.coordinates[1]], {
        icon: createGasIcon()
      });

      const popupContent = `
        <div style="min-width: 200px; cursor: pointer;" class="leaflet-popup-content-custom">
          <h3 style="font-weight: bold; font-size: 14px; margin-bottom: 4px;">${station.brand}</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 4px;">${station.name}</p>
          ${station.distance ? `<p style="font-size: 12px; font-weight: 600; color: #ef4444; margin-bottom: 8px;">📍 ${station.distance}</p>` : ''}
          <p style="font-size: 12px; color: #3b82f6; font-weight: 600; margin-top: 8px;">Batafsil ko'rish →</p>
        </div>
      `;

      marker.bindPopup(popupContent);
      
      marker.on('click', () => {
        onStationClick(station);
      });

      marker.on('popupopen', () => {
        const popupElement = marker.getPopup()?.getElement();
        if (popupElement) {
          popupElement.addEventListener('click', () => {
            onStationClick(station);
          });
        }
      });

      marker.addTo(mapRef.current!);
      markersRef.current.push(marker);
    });

    // Update map view to show all markers
    if (markersRef.current.length > 0) {
      const group = L.featureGroup(markersRef.current);
      mapRef.current.fitBounds(group.getBounds(), { padding: [50, 50], maxZoom: 15 });
    } else {
      const mapCenter = calculateCenter();
      mapRef.current.setView(mapCenter, defaultZoom);
    }
  }, [filteredPlaces, filteredStations, accentColor.color, onPlaceClick, onStationClick]);

  return (
    <div 
      className="fixed inset-0 app-safe-pad z-50 flex flex-col"
      style={{
        background: isDark ? '#000000' : '#ffffff',
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 z-[1000] relative"
        style={{
          background: isDark ? '#0a0a0a' : '#f5f5f5',
          borderBottom: `1px solid ${isDark ? '#1a1a1a' : '#e5e5e5'}`,
        }}
      >
        <div>
          <h2 
            className="text-lg font-bold"
            style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
          >
            Xarita
          </h2>
          <p 
            className="text-xs"
            style={{ color: isDark ? '#888888' : '#666666' }}
          >
            {filteredPlaces.length + filteredStations.length} ta joy
          </p>
        </div>

        <button
          onClick={onClose}
          className="p-2 rounded-full transition-all active:scale-90"
          style={{
            background: isDark ? '#1a1a1a' : '#f0f0f0',
          }}
        >
          <X className="size-6" style={{ color: accentColor.color }} strokeWidth={3} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div 
        className="flex gap-2 p-4 z-[1000] relative"
        style={{
          background: isDark ? '#0a0a0a' : '#f5f5f5',
        }}
      >
        <button
          onClick={() => setSelectedType('all')}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: selectedType === 'all' ? accentColor.gradient : (isDark ? '#1a1a1a' : '#e5e5e5'),
            color: selectedType === 'all' ? '#ffffff' : (isDark ? '#888888' : '#666666'),
          }}
        >
          Barchasi ({places.length + gasStations.length})
        </button>
        <button
          onClick={() => setSelectedType('places')}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: selectedType === 'places' ? accentColor.gradient : (isDark ? '#1a1a1a' : '#e5e5e5'),
            color: selectedType === 'places' ? '#ffffff' : (isDark ? '#888888' : '#666666'),
          }}
        >
          Joylar ({places.length})
        </button>
        <button
          onClick={() => setSelectedType('gas')}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: selectedType === 'gas' ? accentColor.gradient : (isDark ? '#1a1a1a' : '#e5e5e5'),
            color: selectedType === 'gas' ? '#ffffff' : (isDark ? '#888888' : '#666666'),
          }}
        >
          Gaz ({gasStations.length})
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div 
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
          className="z-0"
        />
      </div>

      {/* Location List */}
      <div 
        className="max-h-[40vh] overflow-y-auto p-4 space-y-3 z-[1000] relative"
        style={{
          background: isDark ? '#0a0a0a' : '#f5f5f5',
          borderTop: `1px solid ${isDark ? '#1a1a1a' : '#e5e5e5'}`,
        }}
      >
        {/* Places */}
        {filteredPlaces.slice(0, 5).map((place) => (
          <button
            key={place.id}
            onClick={() => {
              onPlaceClick(place);
            }}
            className="w-full text-left p-3 rounded-xl transition-all active:scale-98"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              border: `1px solid ${isDark ? '#2a2a2a' : '#e5e5e5'}`,
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: '#3b82f6' }}
              />
              <div className="flex-1 min-w-0">
                <h3 
                  className="text-sm font-bold mb-0.5 truncate"
                  style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
                >
                  {place.name}
                </h3>
                <p 
                  className="text-xs truncate"
                  style={{ color: isDark ? '#888888' : '#666666' }}
                >
                  {place.category} • {place.distance}
                </p>
              </div>
              <Navigation 
                className="size-4 flex-shrink-0 mt-1" 
                style={{ color: accentColor.color }}
                strokeWidth={2.5}
              />
            </div>
          </button>
        ))}

        {/* Gas Stations */}
        {filteredStations.slice(0, 5).map((station) => (
          <button
            key={station.id}
            onClick={() => {
              onStationClick(station);
            }}
            className="w-full text-left p-3 rounded-xl transition-all active:scale-98"
            style={{
              background: isDark ? '#1a1a1a' : '#ffffff',
              border: `1px solid ${isDark ? '#2a2a2a' : '#e5e5e5'}`,
            }}
          >
            <div className="flex items-start gap-3">
              <div 
                className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                style={{ background: '#ef4444' }}
              />
              <div className="flex-1 min-w-0">
                <h3 
                  className="text-sm font-bold mb-0.5 truncate"
                  style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}
                >
                  {station.brand}
                </h3>
                <p 
                  className="text-xs truncate"
                  style={{ color: isDark ? '#888888' : '#666666' }}
                >
                  {station.name} • {station.distance}
                </p>
              </div>
              <Navigation 
                className="size-4 flex-shrink-0 mt-1" 
                style={{ color: accentColor.color }}
                strokeWidth={2.5}
              />
            </div>
          </button>
        ))}

        {/* Show More Message */}
        {(filteredPlaces.length + filteredStations.length) > 5 && (
          <div 
            className="text-center py-2"
            style={{ color: isDark ? '#888888' : '#666666' }}
          >
            <p className="text-xs">
              va yana {(filteredPlaces.length + filteredStations.length) - 5} ta joy
            </p>
          </div>
        )}
      </div>
    </div>
  );
});