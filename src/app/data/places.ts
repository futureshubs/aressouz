import {
  PLACE_CATEGORY_CATALOG,
  PLACE_CATEGORY_GROUPS,
  filterPlaceCategories,
  findPlaceCategory,
  getGroupedPlaceCategories,
  type PlaceCategoryDef,
  type PlaceCategoryGroupId,
} from './placeCategoryCatalog';

export type { PlaceCategoryDef, PlaceCategoryGroupId };
export {
  PLACE_CATEGORY_GROUPS,
  filterPlaceCategories,
  findPlaceCategory,
  getGroupedPlaceCategories,
};

export interface Place {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  image: string;
  images?: string[]; // Multiple images support
  rating: number;
  reviews: number;
  address: string;
  phone: string;
  coordinates: [number, number]; // [lat, lng]
  isOpen: boolean;
  openingHours?: string;
  description: string;
  services: string[];
  distance: string;
  location?: string;
  region?: string;
  district?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlaceCategory {
  id: string;
  name: string;
  icon: string;
  image: string;
  count: number;
  groupId: PlaceCategoryGroupId;
}

export const placeCategories: PlaceCategory[] = PLACE_CATEGORY_CATALOG.map((c) => ({
  ...c,
  count: 0,
}));
