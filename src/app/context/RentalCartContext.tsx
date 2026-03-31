import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RentalItem } from '../data/rentals';

export interface RentalCartItem {
  item: RentalItem;
  rentalPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly';
  rentalDuration: number;
  pricePerPeriod: number;
  totalPrice: number;
  addedAt: string;
}

interface RentalCartContextType {
  cartItems: RentalCartItem[];
  addToCart: (
    item: RentalItem,
    rentalPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly',
    rentalDuration: number,
    pricePerPeriod: number
  ) => void;
  removeFromCart: (itemId: string) => void;
  updateQuantity: (itemId: string, newDuration: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getCartCount: () => number;
}

const RentalCartContext = createContext<RentalCartContextType | undefined>(undefined);

export function RentalCartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItems] = useState<RentalCartItem[]>([]);

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('rentalCart');
    if (savedCart) {
      try {
        setCartItems(JSON.parse(savedCart));
      } catch (error) {
        console.error('Error loading cart from localStorage:', error);
      }
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('rentalCart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (
    item: RentalItem,
    rentalPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly',
    rentalDuration: number,
    pricePerPeriod: number
  ) => {
    if (
      item.available === false ||
      (typeof (item as { available?: unknown }).available === 'number' &&
        Number((item as { available?: number }).available) <= 0)
    ) {
      return;
    }
    const totalPrice = pricePerPeriod * rentalDuration;
    
    // Check if item already exists in cart
    const existingIndex = cartItems.findIndex(
      (cartItem) => cartItem.item.id === item.id
    );

    if (existingIndex >= 0) {
      // Update existing item
      const updatedCart = [...cartItems];
      updatedCart[existingIndex] = {
        item,
        rentalPeriod,
        rentalDuration,
        pricePerPeriod,
        totalPrice,
        addedAt: new Date().toISOString(),
      };
      setCartItems(updatedCart);
    } else {
      // Add new item
      const newCartItem: RentalCartItem = {
        item,
        rentalPeriod,
        rentalDuration,
        pricePerPeriod,
        totalPrice,
        addedAt: new Date().toISOString(),
      };
      setCartItems([...cartItems, newCartItem]);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCartItems(cartItems.filter((cartItem) => cartItem.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, newDuration: number) => {
    setCartItems(
      cartItems.map((cartItem) => {
        if (cartItem.item.id === itemId) {
          return {
            ...cartItem,
            rentalDuration: newDuration,
            totalPrice: cartItem.pricePerPeriod * newDuration,
          };
        }
        return cartItem;
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getTotalPrice = () => {
    return cartItems.reduce((sum, cartItem) => sum + cartItem.totalPrice, 0);
  };

  const getCartCount = () => {
    return cartItems.length;
  };

  return (
    <RentalCartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalPrice,
        getCartCount,
      }}
    >
      {children}
    </RentalCartContext.Provider>
  );
}

export function useRentalCart() {
  const context = useContext(RentalCartContext);
  if (context === undefined) {
    throw new Error('useRentalCart must be used within a RentalCartProvider');
  }
  return context;
}
