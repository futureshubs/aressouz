export interface GasStation {
  id: string;
  name: string;
  brand: string;
  image: string;
  rating: number;
  reviews: number;
  address: string;
  phone: string;
  coordinates: [number, number]; // [lat, lng]
  isOpen: boolean;
  openingHours: string;
  fuelTypes: FuelType[];
  services: string[];
  distance: string;
}

export interface FuelType {
  name: string;
  price: number; // UZS per liter
  available: boolean;
}

export const gasStations: GasStation[] = [];
