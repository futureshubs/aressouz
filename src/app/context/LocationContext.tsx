import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { resolveRegionDistrictFromCoords } from '../utils/geolocationDetect';

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

    // GPS + reverse geocode: viloyat va tuman (mahsulotlar uchun ikkalasi ham kerak)
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          try {
            const { regionId, districtId } = await resolveRegionDistrictFromCoords(
              latitude,
              longitude,
            );
            setSelectedRegion(regionId);
            setSelectedDistrict(districtId);
            setIsLocationSet(true);
            setLocationChecked(true);
            localStorage.setItem('selectedRegion', regionId);
            localStorage.setItem('selectedDistrict', districtId);
          } catch {
            setLocationChecked(true);
            setShowLocationPrompt(true);
          }
        },
        () => {
          setLocationChecked(true);
          setShowLocationPrompt(true);
        },
        {
          timeout: 20000,
          maximumAge: 0,
          enableHighAccuracy: true,
        },
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