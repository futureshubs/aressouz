import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { regions } from '../data/regions';

interface LocationContextType {
  selectedRegion: string;
  selectedDistrict: string;
  isLocationSet: boolean;
  showLocationPrompt: boolean;
  locationModalOpen: boolean;
  setLocation: (region: string, district: string) => void;
  dismissLocationPrompt: () => void;
  setLocationModalOpen: (open: boolean) => void;
}

// Default context value to prevent undefined errors
const defaultContextValue: LocationContextType = {
  selectedRegion: '',
  selectedDistrict: '',
  isLocationSet: false,
  showLocationPrompt: false,
  locationModalOpen: false,
  setLocation: () => {},
  dismissLocationPrompt: () => {},
  setLocationModalOpen: () => {},
};

const LocationContext = createContext<LocationContextType>(defaultContextValue);

export const useLocation = () => useContext(LocationContext);

// Define region coordinates for geolocation
const uzbekistanRegions = [
  { id: 'tashkent-city', name: 'Toshkent shahri', lat: 41.2995, lon: 69.2401 },
  { id: 'tashkent', name: 'Toshkent viloyati', lat: 41.3, lon: 69.5 },
  { id: 'andijon', name: 'Andijon', lat: 40.7821, lon: 72.3442 },
  { id: 'buxoro', name: 'Buxoro', lat: 39.7747, lon: 64.4286 },
  { id: 'fargona', name: 'Farg\'ona', lat: 40.3864, lon: 71.7864 },
  { id: 'jizzax', name: 'Jizzax', lat: 40.1158, lon: 67.8422 },
  { id: 'xorazm', name: 'Xorazm', lat: 41.3775, lon: 60.3647 },
  { id: 'namangan', name: 'Namangan', lat: 40.9983, lon: 71.6726 },
  { id: 'navoiy', name: 'Navoiy', lat: 40.0844, lon: 65.3792 },
  { id: 'qashqadaryo', name: 'Qashqadaryo', lat: 38.8606, lon: 65.7897 },
  { id: 'qoraqalpogiston', name: 'Qoraqalpog\'iston', lat: 43.8041, lon: 59.4453 },
  { id: 'samarqand', name: 'Samarqand', lat: 39.6270, lon: 66.9750 },
  { id: 'sirdaryo', name: 'Sirdaryo', lat: 40.3833, lon: 68.7167 },
  { id: 'surxondaryo', name: 'Surxondaryo', lat: 37.9403, lon: 67.5781 },
];

// Return region ID instead of name
function findNearestRegion(lat: number, lon: number): string {
  let nearestRegionId = 'tashkent-city';
  let minDistance = Infinity;

  uzbekistanRegions.forEach(region => {
    // Calculate approximate distance using Euclidean distance
    const distance = Math.sqrt(
      Math.pow(lat - region.lat, 2) + Math.pow(lon - region.lon, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestRegionId = region.id; // Return ID instead of name
    }
  });

  return nearestRegionId;
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [isLocationSet, setIsLocationSet] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationChecked, setLocationChecked] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  useEffect(() => {
    // Check if location was previously saved
    const savedRegion = localStorage.getItem('selectedRegion');
    const savedDistrict = localStorage.getItem('selectedDistrict');

    if (savedRegion) {
      setSelectedRegion(savedRegion);
      setSelectedDistrict(savedDistrict || '');
      setIsLocationSet(true);
      setLocationChecked(true);
      setShowLocationPrompt(false);
      return;
    }

    // Try to get geolocation
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const detectedRegion = findNearestRegion(latitude, longitude);
          
          setSelectedRegion(detectedRegion);
          setIsLocationSet(true);
          setLocationChecked(true);
          
          // Save to localStorage
          localStorage.setItem('selectedRegion', detectedRegion);
        },
        (error) => {
          // Show location prompt if geolocation fails
          setLocationChecked(true);
          setShowLocationPrompt(true);
        },
        {
          timeout: 5000,
          maximumAge: 60000,
          enableHighAccuracy: false,
        }
      );
    } else {
      // Geolocation not supported
      setLocationChecked(true);
      setShowLocationPrompt(true);
    }
  }, []);

  const setLocation = (region: string, district: string) => {
    setSelectedRegion(region);
    setSelectedDistrict(district);
    setIsLocationSet(true);
    setShowLocationPrompt(false);
    
    // Save to localStorage
    localStorage.setItem('selectedRegion', region);
    localStorage.setItem('selectedDistrict', district);
  };

  const dismissLocationPrompt = () => {
    setShowLocationPrompt(false);
    setLocationChecked(true);
  };

  return (
    <LocationContext.Provider value={{ 
      selectedRegion, 
      selectedDistrict, 
      isLocationSet,
      showLocationPrompt,
      locationModalOpen,
      setLocation,
      dismissLocationPrompt,
      setLocationModalOpen,
    }}>
      {children}
    </LocationContext.Provider>
  );
}