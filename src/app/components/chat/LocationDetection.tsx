import { useState, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Crosshair, Users, CheckCircle, AlertCircle, Settings, RefreshCw, Globe, Shield, Bell } from 'lucide-react';
import { toast } from 'sonner';

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: Date;
}

export interface GeocodedLocation {
  address: string;
  city: string;
  district?: string;
  region: string;
  country: string;
  postalCode?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  confidence: number;
}

export interface LocationPermission {
  granted: boolean;
  status: 'granted' | 'denied' | 'prompt' | 'not_supported';
  canRequest: boolean;
}

export interface AutoJoinSettings {
  enabled: boolean;
  radius: number; // in kilometers
  joinPublicRooms: boolean;
  joinPrivateRooms: boolean;
  requireApproval: boolean;
  maxRooms: number;
  notifications: boolean;
  preferredRoomTypes: Array<'region' | 'city' | 'district' | 'community'>;
  excludedRoomTypes: Array<'region' | 'city' | 'district' | 'community'>;
}

export interface LocationRoom {
  id: string;
  name: string;
  type: 'region' | 'city' | 'district' | 'community';
  location: {
    region: string;
    city?: string;
    district?: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  distance: number; // in kilometers
  isPublic: boolean;
  memberCount: number;
  requiresApproval: boolean;
  lastActivity: Date;
  tags: string[];
}

// Uzbekistan regions with coordinates
const uzbekistanRegions = [
  {
    region: 'Toshkent',
    coordinates: { lat: 41.2995, lng: 69.2401 },
    cities: [
      { name: 'Toshkent', coordinates: { lat: 41.2995, lng: 69.2401 } }
    ]
  },
  {
    region: 'Andijon',
    coordinates: { lat: 40.7821, lng: 72.3442 },
    cities: [
      { name: 'Andijon', coordinates: { lat: 40.7821, lng: 72.3442 } },
      { name: 'Xo\'jaobod', coordinates: { lat: 40.9333, lng: 72.2833 } },
      { name: 'Qo\'qon', coordinates: { lat: 40.5389, lng: 71.7845 } }
    ]
  },
  {
    region: 'Buxoro',
    coordinates: { lat: 39.7681, lng: 64.4556 },
    cities: [
      { name: 'Buxoro', coordinates: { lat: 39.7681, lng: 64.4556 } },
      { name: 'Qorako\'l', coordinates: { lat: 39.5067, lng: 63.9533 } }
    ]
  },
  {
    region: 'Farg\'ona',
    coordinates: { lat: 40.3833, lng: 71.7833 },
    cities: [
      { name: 'Farg\'ona', coordinates: { lat: 40.3833, lng: 71.7833 } },
      { name: 'Qo\'qon', coordinates: { lat: 40.5389, lng: 71.7845 } },
      { name: 'Quvasoy', coordinates: { lat: 40.5278, lng: 71.9233 } }
    ]
  },
  {
    region: 'Jizzax',
    coordinates: { lat: 40.1156, lng: 67.8422 },
    cities: [
      { name: 'Jizzax', coordinates: { lat: 40.1156, lng: 67.8422 } },
      { name: 'Gallaorol', coordinates: { lat: 40.0667, lng: 68.0333 } }
    ]
  },
  {
    region: 'Qashqadaryo',
    coordinates: { lat: 38.8667, lng: 65.7833 },
    cities: [
      { name: 'Qarshi', coordinates: { lat: 38.8667, lng: 65.7833 } },
      { name: 'Qo\'ng\'ir', coordinates: { lat: 38.8167, lng: 65.7833 } },
      { name: 'Shahrisabz', coordinates: { lat: 39.0833, lng: 66.8333 } }
    ]
  },
  {
    region: 'Navoiy',
    coordinates: { lat: 40.1000, lng: 65.3667 },
    cities: [
      { name: 'Navoiy', coordinates: { lat: 40.1000, lng: 65.3667 } },
      { name: 'Zarafshon', coordinates: { lat: 41.9833, lng: 64.3833 } }
    ]
  },
  {
    region: 'Namangan',
    coordinates: { lat: 40.9833, lng: 71.6667 },
    cities: [
      { name: 'Namangan', coordinates: { lat: 40.9833, lng: 71.6667 } },
      { name: 'Chust', coordinates: { lat: 41.0167, lng: 71.7833 } },
      { name: 'Pop', coordinates: { lat: 40.9833, lng: 71.5833 } }
    ]
  },
  {
    region: 'Samarqand',
    coordinates: { lat: 39.6542, lng: 66.9597 },
    cities: [
      { name: 'Samarqand', coordinates: { lat: 39.6542, lng: 66.9597 } },
      { name: 'Bulung\'ur', coordinates: { lat: 39.8333, lng: 66.8333 } },
      { name: 'Urgut', coordinates: { lat: 39.4833, lng: 67.1667 } }
    ]
  },
  {
    region: 'Sirdaryo',
    coordinates: { lat: 40.4167, lng: 68.6667 },
    cities: [
      { name: 'Guliston', coordinates: { lat: 40.4167, lng: 68.6667 } },
      { name: 'Yangiyer', coordinates: { lat: 40.2667, lng: 68.8333 } }
    ]
  },
  {
    region: 'Surxondaryo',
    coordinates: { lat: 37.2167, lng: 67.2833 },
    cities: [
      { name: 'Termiz', coordinates: { lat: 37.2167, lng: 67.2833 } },
      { name: 'Denov', coordinates: { lat: 38.2333, lng: 67.2833 } },
      { name: 'Qo\'qon', coordinates: { lat: 38.2333, lng: 67.2833 } }
    ]
  },
  {
    region: 'Xorazm',
    coordinates: { lat: 41.5500, lng: 60.6333 },
    cities: [
      { name: 'Urganch', coordinates: { lat: 41.5500, lng: 60.6333 } },
      { name: 'Xiva', coordinates: { lat: 41.3833, lng: 60.3833 } }
    ]
  },
  {
    region: 'Qoraqalpog\'iston',
    coordinates: { lat: 42.4667, lng: 59.6167 },
    cities: [
      { name: 'Nukus', coordinates: { lat: 42.4667, lng: 59.6167 } },
      { name: 'Berdaq', coordinates: { lat: 42.4167, lng: 59.6167 } },
      { name: 'Chimbay', coordinates: { lat: 42.1667, lng: 59.8167 } }
    ]
  }
];

const mockChatRooms: LocationRoom[] = [
  {
    id: 'room_toshkent_main',
    name: 'Toshkent shahri',
    type: 'city',
    location: {
      region: 'Toshkent',
      city: 'Toshkent',
      coordinates: { lat: 41.2995, lng: 69.2401 }
    },
    distance: 0,
    isPublic: true,
    memberCount: 15420,
    requiresApproval: false,
    lastActivity: new Date(),
    tags: ['umumiy', 'shahar', 'toshkent']
  },
  {
    id: 'room_andijon_business',
    name: 'Andijon Biznes',
    type: 'community',
    location: {
      region: 'Andijon',
      city: 'Andijon',
      coordinates: { lat: 40.7821, lng: 72.3442 }
    },
    distance: 0,
    isPublic: true,
    memberCount: 3420,
    requiresApproval: true,
    lastActivity: new Date(),
    tags: ['biznes', 'andijon', 'tadbirkor']
  },
  {
    id: 'room_samarkand_tourists',
    name: 'Samarqand Tourists',
    type: 'community',
    location: {
      region: 'Samarqand',
      city: 'Samarqand',
      coordinates: { lat: 39.6542, lng: 66.9597 }
    },
    distance: 0,
    isPublic: true,
    memberCount: 2340,
    requiresApproval: false,
    lastActivity: new Date(),
    tags: ['turist', 'sayyoh', 'samarqand']
  }
];

export function useLocationDetection() {
  const [currentLocation, setCurrentLocation] = useState<UserLocation | null>(null);
  const [geocodedLocation, setGeocodedLocation] = useState<GeocodedLocation | null>(null);
  const [permission, setPermission] = useState<LocationPermission>({
    granted: false,
    status: 'prompt',
    canRequest: true
  });
  const [isDetecting, setIsDetecting] = useState(false);
  const [autoJoinSettings, setAutoJoinSettings] = useState<AutoJoinSettings>({
    enabled: true,
    radius: 50, // 50 km
    joinPublicRooms: true,
    joinPrivateRooms: false,
    requireApproval: false,
    maxRooms: 10,
    notifications: true,
    preferredRoomTypes: ['city', 'community'],
    excludedRoomTypes: ['region']
  });
  const [nearbyRooms, setNearbyRooms] = useState<LocationRoom[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<LocationRoom[]>([]);

  // Check location permission
  const checkLocationPermission = useCallback(async (): Promise<LocationPermission> => {
    if (!navigator.geolocation) {
      return {
        granted: false,
        status: 'not_supported',
        canRequest: false
      };
    }

    return new Promise((resolve) => {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        const status = result.state as LocationPermission['status'];
        resolve({
          granted: status === 'granted',
          status,
          canRequest: status !== 'denied'
        });
      }).catch(() => {
        resolve({
          granted: false,
          status: 'prompt',
          canRequest: true
        });
      });
    });
  }, []);

  // Request location permission
  const requestLocationPermission = useCallback(async (): Promise<LocationPermission> => {
    if (!navigator.geolocation) {
      const result: LocationPermission = {
        granted: false,
        status: 'not_supported',
        canRequest: false
      };
      setPermission(result);
      toast.error('Brauzeringiz geolokatsiyani qo\'llab-quvvatlamaydi');
      return result;
    }

    setIsDetecting(true);

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 300000 // 5 minutes
          }
        );
      });

      const location: UserLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude || undefined,
        altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
        heading: position.coords.heading || undefined,
        speed: position.coords.speed || undefined,
        timestamp: new Date()
      };

      setCurrentLocation(location);
      
      const result: LocationPermission = {
        granted: true,
        status: 'granted',
        canRequest: true
      };
      
      setPermission(result);
      toast.success('Lokatsiya muvaffaqiyatli aniqlandi');
      
      // Geocode the location
      await geocodeLocation(location);
      
      // Find nearby rooms
      await findNearbyRooms(location);
      
      return result;
      
    } catch (error) {
      const result: LocationPermission = {
        granted: false,
        status: 'denied',
        canRequest: false
      };
      
      setPermission(result);
      
      if (error instanceof GeolocationPositionError) {
        switch (error.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            toast.error('Lokatsiya ruxsati berilmadi');
            break;
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            toast.error('Lokatsiya ma\'lumotlari mavjud emas');
            break;
          case GeolocationPositionError.TIMEOUT:
            toast.error('Lokatsiyani aniqlash vaqti tugadi');
            break;
          default:
            toast.error('Lokatsiyani aniqlashda xatolik');
        }
      } else {
        toast.error('Lokatsiyani aniqlashda xatolik');
      }
      
      return result;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  // Geocode location (reverse geocoding)
  const geocodeLocation = useCallback(async (location: UserLocation): Promise<GeocodedLocation | null> => {
    try {
      // Mock geocoding - in real app, use Google Maps API or similar
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find nearest region and city
      let nearestRegion = null;
      let nearestCity = null;
      let minDistance = Infinity;

      uzbekistanRegions.forEach(regionData => {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          regionData.coordinates.lat,
          regionData.coordinates.lng
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestRegion = regionData.region;
          
          // Find nearest city in this region
          let nearestCityInRegion = null;
          let minCityDistance = Infinity;
          
          regionData.cities.forEach(cityData => {
            const cityDistance = calculateDistance(
              location.latitude,
              location.longitude,
              cityData.coordinates.lat,
              cityData.coordinates.lng
            );
            
            if (cityDistance < minCityDistance) {
              minCityDistance = cityDistance;
              nearestCityInRegion = cityData.name;
            }
          });
          
          nearestCity = nearestCityInRegion;
        }
      });

      if (nearestRegion) {
        const geocoded: GeocodedLocation = {
          address: `${nearestCity || ''}, ${nearestRegion}, O'zbekiston`,
          city: nearestCity || nearestRegion,
          district: '',
          region: nearestRegion,
          country: 'O\'zbekiston',
          coordinates: {
            lat: location.latitude,
            lng: location.longitude
          },
          confidence: minDistance < 50 ? 0.9 : 0.7
        };
        
        setGeocodedLocation(geocoded);
        return geocoded;
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding error:', error);
      return null;
    }
  }, []);

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Find nearby rooms
  const findNearbyRooms = useCallback(async (location: UserLocation): Promise<LocationRoom[]> => {
    try {
      const rooms: LocationRoom[] = mockChatRooms.map(room => {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          room.location.coordinates.lat,
          room.location.coordinates.lng
        );
        
        return {
          ...room,
          distance
        };
      }).filter(room => room.distance <= autoJoinSettings.radius);
      
      // Sort by distance
      rooms.sort((a, b) => a.distance - b.distance);
      
      setNearbyRooms(rooms);
      return rooms;
    } catch (error) {
      console.error('Error finding nearby rooms:', error);
      return [];
    }
  }, [autoJoinSettings.radius, calculateDistance]);

  // Auto-join rooms
  const autoJoinRooms = useCallback(async (): Promise<LocationRoom[]> => {
    if (!autoJoinSettings.enabled || !currentLocation) {
      return [];
    }

    const availableRooms = nearbyRooms.filter(room => {
      // Check room type preferences
      if (autoJoinSettings.excludedRoomTypes.includes(room.type)) {
        return false;
      }
      
      if (!autoJoinSettings.preferredRoomTypes.includes(room.type)) {
        return false;
      }
      
      // Check public/private settings
      if (!autoJoinSettings.joinPublicRooms && room.isPublic) {
        return false;
      }
      
      if (!autoJoinSettings.joinPrivateRooms && !room.isPublic) {
        return false;
      }
      
      // Check approval requirement
      if (!autoJoinSettings.requireApproval && room.requiresApproval) {
        return false;
      }
      
      // Check max rooms limit
      if (joinedRooms.length >= autoJoinSettings.maxRooms) {
        return false;
      }
      
      return true;
    });

    // Auto-join eligible rooms
    const joinedRoomPromises = availableRooms.slice(0, autoJoinSettings.maxRooms - joinedRooms.length).map(async (room) => {
      try {
        // Mock join operation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (autoJoinSettings.notifications) {
          toast.success(`"${room.name}" xonasiga avtomatik ulandingiz`);
        }
        
        return room;
      } catch (error) {
        console.error(`Error joining room ${room.id}:`, error);
        return null;
      }
    });

    const newlyJoinedRooms = (await Promise.all(joinedRoomPromises)).filter(Boolean) as LocationRoom[];
    
    setJoinedRooms(prev => [...prev, ...newlyJoinedRooms]);
    return newlyJoinedRooms;
  }, [autoJoinSettings, currentLocation, nearbyRooms, joinedRooms]);

  // Update auto-join settings
  const updateAutoJoinSettings = useCallback((settings: Partial<AutoJoinSettings>) => {
    setAutoJoinSettings(prev => ({ ...prev, ...settings }));
    
    // Re-run auto-join if enabled and location is available
    if (settings.enabled !== undefined && settings.enabled && currentLocation) {
      autoJoinRooms();
    }
  }, [currentLocation, autoJoinRooms]);

  // Watch position changes
  const watchPosition = useCallback(() => {
    if (!navigator.geolocation || !permission.granted) {
      return null;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        const location: UserLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: new Date()
        };

        setCurrentLocation(location);
        geocodeLocation(location);
        findNearbyRooms(location);
      },
      (error) => {
        console.error('Watch position error:', error);
        toast.error('Lokatsiyani kuzatishda xatolik');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 1 minute
      }
    );
  }, [permission.granted, geocodeLocation, findNearbyRooms]);

  // Initialize
  useEffect(() => {
    checkLocationPermission();
  }, [checkLocationPermission]);

  // Start watching position when permission is granted
  useEffect(() => {
    if (permission.granted && autoJoinSettings.enabled) {
      const watchId = watchPosition();
      
      return () => {
        if (watchId) {
          navigator.geolocation.clearWatch(watchId);
        }
      };
    }
  }, [permission.granted, autoJoinSettings.enabled, watchPosition]);

  // Auto-join when location or settings change
  useEffect(() => {
    if (currentLocation && autoJoinSettings.enabled) {
      autoJoinRooms();
    }
  }, [currentLocation, autoJoinSettings.enabled]);

  return {
    currentLocation,
    geocodedLocation,
    permission,
    isDetecting,
    autoJoinSettings,
    nearbyRooms,
    joinedRooms,
    setJoinedRooms,
    checkLocationPermission,
    requestLocationPermission,
    geocodeLocation,
    findNearbyRooms,
    autoJoinRooms,
    updateAutoJoinSettings,
    watchPosition
  };
}

export default function LocationDetectionAndAutoJoin() {
  const {
    currentLocation,
    geocodedLocation,
    permission,
    isDetecting,
    autoJoinSettings,
    nearbyRooms,
    joinedRooms,
    setJoinedRooms,
    requestLocationPermission,
    updateAutoJoinSettings
  } = useLocationDetection();

  const [showSettings, setShowSettings] = useState(false);

  const handleEnableLocation = async () => {
    await requestLocationPermission();
  };

  const handleSettingsUpdate = (settings: Partial<AutoJoinSettings>) => {
    updateAutoJoinSettings(settings);
    setShowSettings(false);
    toast.success('Sozlamalar saqlandi');
  };

  const formatDistance = (distance: number): string => {
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${distance.toFixed(1)} km`;
  };

  const getPermissionColor = () => {
    switch (permission.status) {
      case 'granted': return 'text-green-600';
      case 'denied': return 'text-red-600';
      case 'prompt': return 'text-yellow-600';
      case 'not_supported': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getPermissionIcon = () => {
    switch (permission.status) {
      case 'granted': return <CheckCircle className="w-5 h-5" />;
      case 'denied': return <AlertCircle className="w-5 h-5" />;
      case 'prompt': return <Settings className="w-5 h-5" />;
      case 'not_supported': return <AlertCircle className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <MapPin className="w-6 h-6 text-green-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Lokatsiya Avto-Qo\'shilish
          </h2>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center space-x-2"
          >
            <Settings className="w-4 h-4" />
            <span>Sozlamalar</span>
          </button>
        </div>
      </div>

      {/* Location Status */}
      <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getPermissionIcon()}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Lokatsiya holati
              </h3>
              <p className={`text-sm ${getPermissionColor()}`}>
                {permission.status === 'granted' && 'Ruxsat berilgan'}
                {permission.status === 'denied' && 'Ruxsat berilmagan'}
                {permission.status === 'prompt' && 'Ruxsat talab qilinadi'}
                {permission.status === 'not_supported' && 'Qo\'llab-quvvatlanmaydi'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {permission.status === 'granted' && currentLocation && (
              <div className="text-right">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Aniqlangan lokatsiya:
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  Aniqlash xatosi: ±{currentLocation.accuracy.toFixed(0)}m
                </p>
              </div>
            )}
            
            {permission.canRequest && (
              <button
                onClick={handleEnableLocation}
                disabled={isDetecting}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center space-x-2"
              >
                {isDetecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Aniqlanmoqda...</span>
                  </>
                ) : (
                  <>
                    <Navigation className="w-4 h-4" />
                    <span>Lokatsiyani aniqlash</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Geocoded Location */}
        {geocodedLocation && (
          <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Globe className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-gray-900 dark:text-white">
                Aniqlangan manzil:
              </span>
            </div>
            <p className="text-gray-900 dark:text-white">
              {geocodedLocation.address}
            </p>
            <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Viloyat: {geocodedLocation.region}</span>
              <span>Shahar: {geocodedLocation.city}</span>
              <span>Ishonch: {(geocodedLocation.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
        
        {/* Auto-Join Status */}
        <div className="mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                autoJoinSettings.enabled ? 'bg-green-500' : 'bg-gray-400'
              }`}></div>
              <span className="font-medium text-gray-900 dark:text-white">
                Avto-qo\'shilish
              </span>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoJoinSettings.enabled}
                onChange={(e) => handleSettingsUpdate({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {autoJoinSettings.enabled && (
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Radius: {autoJoinSettings.radius}km</p>
              <p>Maksimal xonalar: {autoJoinSettings.maxRooms}</p>
              <p>Bog\'lanilgan xonalar: {joinedRooms.length}</p>
            </div>
          )}
        </div>
      </div>

      {/* Nearby Rooms */}
      {nearbyRooms.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
            Yaqin atrofdagi xonalar ({nearbyRooms.length})
          </h3>
          <div className="space-y-3">
            {nearbyRooms.slice(0, 5).map(room => (
              <div key={room.id} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {room.name}
                      </h4>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        room.type === 'region' ? 'bg-purple-100 text-purple-800' :
                        room.type === 'city' ? 'bg-blue-100 text-blue-800' :
                        room.type === 'district' ? 'bg-green-100 text-green-800' :
                        'bg-orange-100 text-orange-800'
                      }`}>
                        {room.type === 'region' && 'Viloyat'}
                        {room.type === 'city' && 'Shahar'}
                        {room.type === 'district' && 'Tuman'}
                        {room.type === 'community' && 'Jamiyat'}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                      <span>{room.memberCount.toLocaleString()} a'zo</span>
                      <span>{formatDistance(room.distance)}</span>
                      {room.requiresApproval && (
                        <span className="text-orange-600">Tasdiqlash talab qilinadi</span>
                      )}
                    </div>
                    
                    {room.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {room.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-white dark:bg-gray-800 text-xs rounded text-gray-700 dark:text-gray-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {joinedRooms.some(joinedRoom => joinedRoom.id === room.id) ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                        Qo\'shilgan
                      </span>
                    ) : (
                      <button
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                        onClick={() => {
                          // Mock join operation
                          setJoinedRooms(prev => [...prev, room]);
                          toast.success(`"${room.name}" xonasiga qo\'shildingiz`);
                        }}
                      >
                        Qo\'shilish
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 app-safe-pad bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Avto-qo\'shilish sozlamalari
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Avto-qo\'shilish yoqilgan
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoJoinSettings.enabled}
                      onChange={(e) => handleSettingsUpdate({ enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </label>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Radius (km)
                </label>
                <input
                  type="number"
                  value={autoJoinSettings.radius}
                  onChange={(e) => handleSettingsUpdate({ radius: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  min="1"
                  max="500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Maksimal xonalar
                </label>
                <input
                  type="number"
                  value={autoJoinSettings.maxRooms}
                  onChange={(e) => handleSettingsUpdate({ maxRooms: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  min="1"
                  max="50"
                />
              </div>
              
              <div>
                <label className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Bildirishmalar
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoJoinSettings.notifications}
                      onChange={(e) => handleSettingsUpdate({ notifications: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </label>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-2 mt-6">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Saqlash
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
