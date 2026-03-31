import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  categoryId: string;
  catalogId: string;
  rating: number;
  stockCount?: number;
  oldPrice?: number;
  description?: string;
  recommendation?: string;
  barcode?: string;
  sku?: string;
  video?: string;
  specs?: { name: string; value: string }[];
  variants?: {
    id: string;
    name: string;
    image?: string;
    price: number;
  }[];
  branchName?: string;
  branchId?: string;
}

export interface FavoriteOrderEntry {
  orderId: string;
  orderNumber?: string;
  statusLabel?: string;
  createdAt?: string;
  category?: string;
}

interface FavoritesContextType {
  favorites: Product[];
  favoriteOrders: FavoriteOrderEntry[];
  addToFavorites: (product: Product) => void;
  removeFromFavorites: (productId: number) => void;
  isFavorite: (productId: number) => boolean;
  toggleFavorite: (product: Product) => void;
  addFavoriteOrder: (order: FavoriteOrderEntry) => void;
  removeFavoriteOrder: (orderId: string) => void;
  isFavoriteOrder: (orderId: string) => boolean;
  toggleFavoriteOrder: (order: FavoriteOrderEntry) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const FAVORITE_ORDERS_KEY = 'favorite_orders';

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [favoriteOrders, setFavoriteOrders] = useState<FavoriteOrderEntry[]>([]);

  useEffect(() => {
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (error) {
        console.error('Failed to load favorites:', error);
      }
    }
    const savedOrders = localStorage.getItem(FAVORITE_ORDERS_KEY);
    if (savedOrders) {
      try {
        const parsed = JSON.parse(savedOrders);
        if (Array.isArray(parsed)) {
          setFavoriteOrders(parsed);
        }
      } catch (error) {
        console.error('Failed to load favorite orders:', error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem(FAVORITE_ORDERS_KEY, JSON.stringify(favoriteOrders));
  }, [favoriteOrders]);

  const addToFavorites = (product: Product) => {
    setFavorites((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        return prev;
      }
      return [...prev, product];
    });
  };

  const removeFromFavorites = (productId: number) => {
    setFavorites((prev) => prev.filter((p) => p.id !== productId));
  };

  const isFavorite = (productId: number) => {
    return favorites.some((p) => p.id === productId);
  };

  const toggleFavorite = (product: Product) => {
    if (isFavorite(product.id)) {
      removeFromFavorites(product.id);
    } else {
      addToFavorites(product);
    }
  };

  const addFavoriteOrder = (order: FavoriteOrderEntry) => {
    const id = String(order.orderId || '').trim();
    if (!id) return;
    setFavoriteOrders((prev) => {
      if (prev.some((o) => o.orderId === id)) return prev;
      return [...prev, { ...order, orderId: id }];
    });
  };

  const removeFavoriteOrder = (orderId: string) => {
    const id = String(orderId || '').trim();
    setFavoriteOrders((prev) => prev.filter((o) => o.orderId !== id));
  };

  const isFavoriteOrder = (orderId: string) => {
    const id = String(orderId || '').trim();
    return favoriteOrders.some((o) => o.orderId === id);
  };

  const toggleFavoriteOrder = (order: FavoriteOrderEntry) => {
    const id = String(order.orderId || '').trim();
    if (!id) return;
    if (isFavoriteOrder(id)) {
      removeFavoriteOrder(id);
    } else {
      addFavoriteOrder({ ...order, orderId: id });
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        favoriteOrders,
        addToFavorites,
        removeFromFavorites,
        isFavorite,
        toggleFavorite,
        addFavoriteOrder,
        removeFavoriteOrder,
        isFavoriteOrder,
        toggleFavoriteOrder,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (context === undefined) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
}
