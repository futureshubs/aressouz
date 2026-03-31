/**
 * Custom React Hooks
 * Production-ready hooks for data fetching and state management
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  ApiResponse, 
  SearchFilters, 
  SearchResult, 
  UUID, 
  BaseEntity
} from '../shared/types';
import { 
  ListingsApi, 
  CategoriesApi, 
  LocationsApi, 
  SearchApi,
  UserApi,
  AuthApi,
  MediaApi 
} from '../services';

// ============================================================================
// GENERIC DATA FETCHING HOOK
// ============================================================================

export interface UseFetchOptions<T> {
  immediate?: boolean;
  cache?: boolean;
  retry?: number;
  retryDelay?: number;
  cacheTTL?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  dependencies?: any[];
}

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutate: (newData: T) => void;
}

export function useFetch<T>(
  fetcher: () => Promise<ApiResponse<T>>,
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const {
    immediate = true,
    retry = 3,
    retryDelay = 1000,
    onSuccess,
    onError,
    dependencies = [],
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const retryCountRef = useRef<number>(0);

  const execute = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetcher();

      if (response.success && response.data) {
        setData(response.data);
        onSuccess?.(response.data);
        retryCountRef.current = 0;
      } else {
        throw new Error(response.error?.message || 'Request failed');
      }
    } catch (err) {
      const error = err as Error;
      
      if (retryCountRef.current < retry) {
        retryCountRef.current++;
        setTimeout(execute, retryDelay * retryCountRef.current);
        return;
      }

      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [fetcher, retry, retryDelay, onSuccess, onError]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate, ...dependencies]);

  const refetch = useCallback(async (): Promise<void> => {
    retryCountRef.current = 0;
    await execute();
  }, [execute]);

  const mutate = useCallback((newData: T): void => {
    setData(newData);
    onSuccess?.(newData);
  }, [onSuccess]);

  return {
    data,
    loading,
    error,
    refetch,
    mutate,
  };
}

// ============================================================================
// PAGINATION HOOK
// ============================================================================

export interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  totalPages?: number;
}

export interface UsePaginationResult {
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  reset: () => void;
  updateTotalPages: (totalPages: number) => void;
}

export function usePagination(options: UsePaginationOptions = {}): UsePaginationResult {
  const { initialPage = 1, initialLimit = 20, totalPages = 1 } = options;

  const [page, setPageState] = useState<number>(initialPage);
  const [limit, setLimitState] = useState<number>(initialLimit);
  const [totalPagesState, setTotalPagesState] = useState<number>(totalPages);

  const hasNext = page < totalPagesState;
  const hasPrevious = page > 1;

  const setPage = useCallback((newPage: number): void => {
    if (newPage >= 1 && newPage <= totalPagesState) {
      setPageState(newPage);
    }
  }, [totalPagesState]);

  const setLimit = useCallback((newLimit: number): void => {
    setLimitState(newLimit);
    setPageState(1); // Reset to first page when changing limit
  }, []);

  const nextPage = useCallback((): void => {
    if (hasNext) {
      setPageState(prev => prev + 1);
    }
  }, [hasNext]);

  const previousPage = useCallback((): void => {
    if (hasPrevious) {
      setPageState(prev => prev - 1);
    }
  }, [hasPrevious]);

  const reset = useCallback((): void => {
    setPageState(initialPage);
    setLimitState(initialLimit);
    setTotalPagesState(totalPages);
  }, [initialPage, initialLimit, totalPages]);

  // Update total pages when data changes
  const updateTotalPages = useCallback((newTotalPages: number): void => {
    setTotalPagesState(newTotalPages);
    if (page > newTotalPages) {
      setPageState(newTotalPages);
    }
  }, [page]);

  return {
    page,
    limit,
    totalPages: totalPagesState,
    hasNext,
    hasPrevious,
    setPage,
    setLimit,
    nextPage,
    previousPage,
    reset: reset,
    updateTotalPages,
  };
}

// ============================================================================
// DEBOUNCE HOOK
// ============================================================================

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// LOCAL STORAGE HOOK
// ============================================================================

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T): void => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}

// ============================================================================
// LISTINGS HOOKS
// ============================================================================

export interface UseListingsOptions extends UseFetchOptions<SearchResult> {
  filters?: SearchFilters;
  pagination?: UsePaginationOptions;
}

export interface UseListingsResult extends UseFetchResult<SearchResult> {
  listings: any[];
  pagination: UsePaginationResult;
  updateFilters: (filters: SearchFilters) => void;
  refresh: () => Promise<void>;
}

export function useListings(options: UseListingsOptions = {}): UseListingsResult {
  const { filters = {}, pagination: paginationOptions, ...fetchOptions } = options;
  const pagination = usePagination(paginationOptions);

  const fetchListings = useCallback(async (): Promise<ApiResponse<SearchResult>> => {
    return ListingsApi.getListings({
      ...filters,
      page: pagination.page,
      limit: pagination.limit,
    });
  }, [filters, pagination.page, pagination.limit]);

  const result = useFetch(fetchListings, {
    ...fetchOptions,
    dependencies: [filters, pagination.page, pagination.limit],
  });

  const listings = useMemo(() => result.data?.items || [], [result.data]);

  // Update pagination when data changes
  useEffect(() => {
    if (result.data) {
      pagination.updateTotalPages(result.data.totalPages);
    }
  }, [result.data, pagination]);

  const updateFilters = useCallback((newFilters: SearchFilters): void => {
    // This would typically be handled by parent component state
    // For now, we'll trigger a refetch
    result.refetch();
  }, [result]);

  const refresh = useCallback(async (): Promise<void> => {
    await result.refetch();
  }, [result]);

  return {
    ...result,
    listings,
    pagination,
    updateFilters,
    refresh,
  };
}

export function useListing(id: UUID, options: UseFetchOptions<any> = {}): UseFetchResult<any> {
  const fetchListing = useCallback(async (): Promise<ApiResponse<any>> => {
    return ListingsApi.getListing(id);
  }, [id]);

  return useFetch(fetchListing, {
    ...options,
    dependencies: [id],
  });
}

// ============================================================================
// CATEGORIES HOOKS
// ============================================================================

export function useCategories(entityType?: string): UseFetchResult<any[]> {
  const fetchCategories = useCallback(async (): Promise<ApiResponse<any[]>> => {
    if (entityType) {
      return CategoriesApi.getCategoriesByType(entityType);
    }
    return CategoriesApi.getCategories();
  }, [entityType]);

  return useFetch(fetchCategories, {
    dependencies: [entityType],
  });
}

// ============================================================================
// LOCATIONS HOOKS
// ============================================================================

export function useRegions(): UseFetchResult<any[]> {
  return useFetch(() => LocationsApi.getRegions(), {
    cache: true,
  });
}

export function useDistricts(regionId?: string): UseFetchResult<any[]> {
  const fetchDistricts = useCallback(async (): Promise<ApiResponse<any[]>> => {
    return LocationsApi.getDistricts(regionId || '');
  }, [regionId]);

  return useFetch(fetchDistricts, {
    immediate: !!regionId,
    dependencies: [regionId],
  });
}

// ============================================================================
// SEARCH HOOKS
// ============================================================================

export interface UseSearchOptions extends UseFetchOptions<SearchResult> {
  query?: string;
  filters?: SearchFilters;
  debounceMs?: number;
}

export interface UseSearchResult extends UseFetchResult<SearchResult> {
  results: any[];
  search: (query: string, filters?: SearchFilters) => void;
  clearSearch: () => void;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { query: initialQuery = '', filters: initialFilters = {}, debounceMs = 300, ...fetchOptions } = options;
  const [query, setQuery] = useState<string>(initialQuery);
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);

  const debouncedQuery = useDebounce(query, debounceMs);

  const searchListings = useCallback(async (): Promise<ApiResponse<SearchResult>> => {
    if (!debouncedQuery.trim()) {
      return { success: true, data: { items: [], total: 0, page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrevious: false }, timestamp: new Date().toISOString() };
    }

    return SearchApi.searchListings({
      query: debouncedQuery,
      ...filters,
    });
  }, [debouncedQuery, filters]);

  const result = useFetch(searchListings, {
    ...fetchOptions,
    immediate: !!debouncedQuery.trim(),
    dependencies: [debouncedQuery, filters],
  });

  const results = useMemo(() => result.data?.items || [], [result.data]);

  const search = useCallback((newQuery: string, newFilters?: SearchFilters): void => {
    setQuery(newQuery);
    if (newFilters) {
      setFilters(newFilters);
    }
  }, []);

  const clearSearch = useCallback((): void => {
    setQuery('');
    setFilters({});
  }, []);

  return {
    ...result,
    results,
    search,
    clearSearch,
  };
}

// ============================================================================
// USER HOOKS
// ============================================================================

export function useAuth() {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check for existing user data on mount
    const userData = localStorage.getItem('user_data');
    if (userData) {
      try {
        setUser(JSON.parse(userData));
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('user_data');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (credentials: { phone: string; password: string }) => {
    try {
      const response = await AuthApi.login(credentials);
      if (response.success && response.data) {
        setUser(response.data.user);
        return response.data;
      }
      throw new Error('Login failed');
    } catch (error) {
      throw error;
    }
  }, []);

  const register = useCallback(async (userData: any) => {
    try {
      const response = await AuthApi.register(userData);
      if (response.success && response.data) {
        setUser(response.data.user);
        return response.data;
      }
      throw new Error('Registration failed');
    } catch (error) {
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await AuthApi.logout();
      setUser(null);
    } catch (error) {
      // Even if logout fails, clear local state
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (profileData: any) => {
    try {
      const response = await UserApi.updateProfile(profileData);
      if (response.success && response.data) {
        setUser(response.data);
        return response.data;
      }
      throw new Error('Profile update failed');
    } catch (error) {
      throw error;
    }
  }, []);

  return {
    user,
    loading,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  };
}

export function useProfile(): UseFetchResult<any> {
  return useFetch(() => UserApi.getProfile(), {
    cache: true,
    cacheTTL: 300, // 5 minutes
  });
}

// ============================================================================
// MEDIA HOOKS
// ============================================================================

export interface UseUploadOptions {
  onSuccess?: (url: string) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
}

export function useUpload(options: UseUploadOptions = {}) {
  const [uploading, setUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);

  const uploadFile = useCallback(async (file: File, entityType?: string): Promise<string | null> => {
    try {
      setUploading(true);
      setProgress(0);
      setError(null);

      // Simulate progress (in real implementation, this would come from the upload)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      const response = await MediaApi.uploadFile(file, entityType);

      clearInterval(progressInterval);
      setProgress(100);

      if (response.success && response.data) {
        options.onSuccess?.(response.data.url);
        return response.data.url;
      }

      throw new Error('Upload failed');
    } catch (err) {
      const error = err as Error;
      setError(error);
      options.onError?.(error);
      return null;
    } finally {
      setUploading(false);
    }
  }, [options]);

  const reset = useCallback((): void => {
    setUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    uploadFile,
    uploading,
    progress,
    error,
    reset,
  };
}

// ============================================================================
// FAVORITES HOOKS
// ============================================================================

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<UUID[]>('favorites', []);

  const addFavorite = useCallback((id: UUID): void => {
    setFavorites((prev) => {
      if (!prev.includes(id)) {
        return [...prev, id];
      }
      return prev;
    });
  }, [setFavorites]);

  const removeFavorite = useCallback((id: UUID): void => {
    setFavorites((prev) => prev.filter((favId) => favId !== id));
  }, [setFavorites]);

  const toggleFavorite = useCallback((id: UUID): void => {
    setFavorites((prev) => {
      if (prev.includes(id)) {
        return prev.filter((favId) => favId !== id);
      }
      return [...prev, id];
    });
  }, [setFavorites]);

  const isFavorite = useCallback((id: UUID): boolean => {
    return favorites.includes(id);
  }, [favorites]);

  return {
    favorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorite,
    count: favorites.length,
  };
}

// ============================================================================
// CART HOOKS
// ============================================================================

export interface CartItem {
  id: UUID;
  listingId: UUID;
  listing: any;
  quantity: number;
  price: number;
  addedAt: string;
}

export function useCart() {
  const [items, setItems] = useLocalStorage<CartItem[]>('cart', []);

  const addItem = useCallback((listing: any, quantity: number = 1): void => {
    setItems((prev) => {
      const existingItem = prev.find((item) => item.listingId === listing.id);
      
      if (existingItem) {
        return prev.map((item) =>
          item.listingId === listing.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prev, {
        id: crypto.randomUUID(),
        listingId: listing.id,
        listing,
        quantity,
        price: listing.price,
        addedAt: new Date().toISOString(),
      }];
    });
  }, [setItems]);

  const removeItem = useCallback((id: UUID): void => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, [setItems]);

  const updateQuantity = useCallback((id: UUID, quantity: number): void => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }

    setItems((prev) => prev.map((item) =>
      item.id === id ? { ...item, quantity } : item
    ));
  }, [setItems, removeItem]);

  const clearCart = useCallback((): void => {
    setItems([]);
  }, [setItems]);

  const total = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }, [items]);

  const count = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  return {
    items,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    total,
    count,
    isEmpty: items.length === 0,
  };
}

// ============================================================================
// NOTIFICATIONS HOOKS
// ============================================================================

export interface Notification {
  id: UUID;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>): void => {
    const id = crypto.randomUUID();
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date().toISOString(),
    };

    setNotifications(prev => [...prev, newNotification]);

    // Auto-remove notification after duration
    if (notification.duration !== 0) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.duration || 5000);
    }
  }, []);

  const removeNotification = useCallback((id: UUID): void => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const clearNotifications = useCallback((): void => {
    setNotifications([]);
  }, []);

  const success = useCallback((title: string, message: string, duration?: number): void => {
    addNotification({ type: 'success', title, message, duration });
  }, [addNotification]);

  const error = useCallback((title: string, message: string, duration?: number): void => {
    addNotification({ type: 'error', title, message, duration });
  }, [addNotification]);

  const warning = useCallback((title: string, message: string, duration?: number): void => {
    addNotification({ type: 'warning', title, message, duration });
  }, [addNotification]);

  const info = useCallback((title: string, message: string, duration?: number): void => {
    addNotification({ type: 'info', title, message, duration });
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearNotifications,
    success,
    error,
    warning,
    info,
  };
}

// ============================================================================
// ALL HOOKS EXPORTED FROM THIS FILE
// ============================================================================
