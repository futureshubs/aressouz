/**
 * Secure API Client Implementation
 * Production-ready API service with authentication, caching, and error handling
 */

import { HttpClient, LocalStorageCacheService, ConsoleLoggingService } from '../base';
import { API_CONFIG, API_ENDPOINTS, STORAGE_KEYS, DEV_CONFIG } from '../../shared/constants';
import { ApiResponse, UUID } from '../../shared/types';

// ============================================================================
// API CLIENT CONFIGURATION
// ============================================================================

const httpClient = new HttpClient({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  retryAttempts: API_CONFIG.RETRY_ATTEMPTS,
  retryDelay: API_CONFIG.RETRY_DELAY,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  interceptors: {
    request: [
      {
        onRequest: async (config) => {
          // Add authentication token if available
          const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
          if (token) {
            config.headers = {
              ...config.headers,
              Authorization: `Bearer ${token}`,
            };
          }

          // Add request ID for tracking
          const requestId = crypto.randomUUID();
          config.headers = {
            ...config.headers,
            'X-Request-ID': requestId,
          };

          // Log request in development
          if (DEV_CONFIG.DEBUG_API) {
            console.log(`🌐 API Request: ${config.method} ${(config as any).url || ''}`, {
              headers: config.headers,
              body: config.body,
              requestId,
            });
          }

          return config;
        },
        onRequestError: (error) => {
          console.error('❌ Request Error:', error);
        },
      },
    ],
    response: [
      {
        onResponse: async (response) => {
          // Log response in development
          if (DEV_CONFIG.DEBUG_API) {
            console.log(`📊 API Response: ${response.status} ${response.url}`, {
              headers: Object.fromEntries(response.headers.entries()),
            });
          }

          // Handle token refresh
          if (response.status === 401) {
            await handleTokenRefresh();
          }

          return response;
        },
        onResponseError: async (error) => {
          console.error('❌ Response Error:', error);
          
          // Handle network errors
          if (error instanceof TypeError) {
            throw new Error('Network error. Please check your connection.');
          }

          throw error;
        },
      },
    ],
  },
});

const cacheService = new LocalStorageCacheService();
const loggingService = new ConsoleLoggingService(DEV_CONFIG.isDevelopment);

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

async function handleTokenRefresh(): Promise<void> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  
  if (!refreshToken) {
    // No refresh token, redirect to login
    clearAuthTokens();
    window.location.href = '/login';
    return;
  }

  try {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });

    if (response.ok) {
      const data = await response.json();
      
      if (data.success && data.data) {
        // Update tokens
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.data.accessToken);
        if (data.data.refreshToken) {
          localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.data.refreshToken);
        }
      }
    } else {
      // Refresh failed, clear tokens and redirect
      clearAuthTokens();
      window.location.href = '/login';
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    clearAuthTokens();
    window.location.href = '/login';
  }
}

export function setAuthTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
  if (refreshToken) {
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  }
  httpClient.setAuthToken(accessToken);
}

export function clearAuthTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  httpClient.clearAuthToken();
}

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface RegisterRequest {
  phone: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface AuthResponse {
  user: any;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export class AuthApi {
  /**
   * Login user
   */
  static async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    try {
      loggingService.info('Attempting login', { phone: credentials.phone });
      
      const response = await httpClient.post<AuthResponse>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );

      if (response.success && response.data) {
        setAuthTokens(response.data.accessToken, response.data.refreshToken);
        
        // Store user data
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
        
        loggingService.info('Login successful');
      }

      return response;
    } catch (error) {
      loggingService.error('Login failed', error as Error);
      throw error;
    }
  }

  /**
   * Register new user
   */
  static async register(userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    try {
      loggingService.info('Attempting registration', { phone: userData.phone });
      
      const response = await httpClient.post<AuthResponse>(
        API_ENDPOINTS.AUTH.REGISTER,
        userData
      );

      if (response.success && response.data) {
        setAuthTokens(response.data.accessToken, response.data.refreshToken);
        
        // Store user data
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
        
        loggingService.info('Registration successful');
      }

      return response;
    } catch (error) {
      loggingService.error('Registration failed', error as Error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  static async logout(): Promise<void> {
    try {
      loggingService.info('Attempting logout');
      
      await httpClient.post(API_ENDPOINTS.AUTH.LOGOUT);
      
      clearAuthTokens();
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      
      loggingService.info('Logout successful');
    } catch (error) {
      loggingService.error('Logout failed', error as Error);
      // Even if API call fails, clear local tokens
      clearAuthTokens();
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
  }

  /**
   * Verify email
   */
  static async verifyEmail(token: string): Promise<ApiResponse<void>> {
    try {
      loggingService.info('Verifying email');
      
      const response = await httpClient.post<void>(
        API_ENDPOINTS.AUTH.VERIFY_EMAIL,
        { token }
      );

      loggingService.info('Email verification successful');
      return response;
    } catch (error) {
      loggingService.error('Email verification failed', error as Error);
      throw error;
    }
  }

  /**
   * Verify phone
   */
  static async verifyPhone(code: string): Promise<ApiResponse<void>> {
    try {
      loggingService.info('Verifying phone');
      
      const response = await httpClient.post<void>(
        API_ENDPOINTS.AUTH.VERIFY_PHONE,
        { code }
      );

      loggingService.info('Phone verification successful');
      return response;
    } catch (error) {
      loggingService.error('Phone verification failed', error as Error);
      throw error;
    }
  }

  /**
   * Reset password
   */
  static async resetPassword(email: string): Promise<ApiResponse<void>> {
    try {
      loggingService.info('Requesting password reset');
      
      const response = await httpClient.post<void>(
        API_ENDPOINTS.AUTH.RESET_PASSWORD,
        { email }
      );

      loggingService.info('Password reset request sent');
      return response;
    } catch (error) {
      loggingService.error('Password reset request failed', error as Error);
      throw error;
    }
  }

  /**
   * Change password
   */
  static async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<void>> {
    try {
      loggingService.info('Changing password');
      
      const response = await httpClient.post<void>(
        API_ENDPOINTS.AUTH.CHANGE_PASSWORD,
        {
          currentPassword,
          newPassword,
        }
      );

      loggingService.info('Password changed successfully');
      return response;
    } catch (error) {
      loggingService.error('Password change failed', error as Error);
      throw error;
    }
  }
}

// ============================================================================
// USER API
// ============================================================================

export class UserApi {
  /**
   * Get current user profile
   */
  static async getProfile(): Promise<ApiResponse<any>> {
    try {
      loggingService.info('Fetching user profile');
      
      const response = await httpClient.get<any>(
        API_ENDPOINTS.USERS.ME,
        { cache: true, cacheTTL: 300 } // 5 minutes
      );

      if (response.success && response.data) {
        // Update cached user data
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data));
      }

      return response;
    } catch (error) {
      loggingService.error('Failed to fetch user profile', error as Error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userData: any): Promise<ApiResponse<any>> {
    try {
      loggingService.info('Updating user profile');
      
      const response = await httpClient.put<any>(
        API_ENDPOINTS.USERS.PROFILE,
        userData
      );

      if (response.success && response.data) {
        // Update cached user data
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data));
      }

      return response;
    } catch (error) {
      loggingService.error('Failed to update user profile', error as Error);
      throw error;
    }
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(preferences: any): Promise<ApiResponse<any>> {
    try {
      loggingService.info('Updating user preferences');
      
      const response = await httpClient.put<any>(
        API_ENDPOINTS.USERS.PREFERENCES,
        preferences
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to update user preferences', error as Error);
      throw error;
    }
  }

  /**
   * Upload avatar
   */
  static async uploadAvatar(file: File): Promise<ApiResponse<{ url: string }>> {
    try {
      loggingService.info('Uploading avatar');
      
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await httpClient.post<{ url: string }>(
        API_ENDPOINTS.USERS.AVATAR,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to upload avatar', error as Error);
      throw error;
    }
  }
}

// ============================================================================
// LISTINGS API
// ============================================================================

export class ListingsApi {
  /**
   * Get listings with filters
   */
  static async getListings(filters?: any): Promise<ApiResponse<any>> {
    try {
      loggingService.info('Fetching listings', { filters });
      
      const response = await httpClient.get<any>(
        API_ENDPOINTS.LISTINGS.LIST,
        {
          cache: true,
          cacheTTL: 600, // 10 minutes
          ...filters,
        }
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to fetch listings', error as Error);
      throw error;
    }
  }

  /**
   * Get listing by ID
   */
  static async getListing(id: UUID): Promise<ApiResponse<any>> {
    try {
      loggingService.info('Fetching listing', { id });
      
      const response = await httpClient.get<any>(
        API_ENDPOINTS.LISTINGS.DETAIL(id),
        { cache: true, cacheTTL: 300 } // 5 minutes
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to fetch listing', error as Error, { id });
      throw error;
    }
  }

  /**
   * Create new listing
   */
  static async createListing(listingData: any): Promise<ApiResponse<any>> {
    try {
      loggingService.info('Creating listing');
      
      const response = await httpClient.post<any>(
        API_ENDPOINTS.LISTINGS.CREATE,
        listingData
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to create listing', error as Error);
      throw error;
    }
  }

  /**
   * Update listing
   */
  static async updateListing(id: UUID, listingData: any): Promise<ApiResponse<any>> {
    try {
      loggingService.info('Updating listing', { id });
      
      const response = await httpClient.put<any>(
        API_ENDPOINTS.LISTINGS.UPDATE(id),
        listingData
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to update listing', error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete listing
   */
  static async deleteListing(id: UUID): Promise<ApiResponse<void>> {
    try {
      loggingService.info('Deleting listing', { id });
      
      const response = await httpClient.delete<void>(
        API_ENDPOINTS.LISTINGS.DELETE(id)
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to delete listing', error as Error, { id });
      throw error;
    }
  }

  /**
   * Like listing
   */
  static async likeListing(id: UUID): Promise<ApiResponse<void>> {
    try {
      loggingService.info('Liking listing', { id });
      
      const response = await httpClient.post<void>(
        API_ENDPOINTS.LISTINGS.LIKE(id)
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to like listing', error as Error, { id });
      throw error;
    }
  }

  /**
   * Unlike listing
   */
  static async unlikeListing(id: UUID): Promise<ApiResponse<void>> {
    try {
      loggingService.info('Unliking listing', { id });
      
      const response = await httpClient.post<void>(
        API_ENDPOINTS.LISTINGS.UNLIKE(id)
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to unlike listing', error as Error, { id });
      throw error;
    }
  }
}

// ============================================================================
// CATEGORIES API
// ============================================================================

export class CategoriesApi {
  /**
   * Get all categories
   */
  static async getCategories(): Promise<ApiResponse<any[]>> {
    try {
      loggingService.info('Fetching categories');
      
      const response = await httpClient.get<any[]>(
        API_ENDPOINTS.CATEGORIES.LIST,
        { cache: true, cacheTTL: 3600 } // 1 hour
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to fetch categories', error as Error);
      throw error;
    }
  }

  /**
   * Get categories by entity type
   */
  static async getCategoriesByType(entityType: string): Promise<ApiResponse<any[]>> {
    try {
      loggingService.info('Fetching categories by type', { entityType });
      
      const response = await httpClient.get<any[]>(
        API_ENDPOINTS.CATEGORIES.BY_TYPE(entityType),
        { cache: true, cacheTTL: 3600 } // 1 hour
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to fetch categories by type', error as Error, { entityType });
      throw error;
    }
  }
}

// ============================================================================
// LOCATIONS API
// ============================================================================

export class LocationsApi {
  /**
   * Get regions
   */
  static async getRegions(): Promise<ApiResponse<any[]>> {
    try {
      loggingService.info('Fetching regions');
      
      const response = await httpClient.get<any[]>(
        API_ENDPOINTS.LOCATIONS.REGIONS,
        { cache: true, cacheTTL: 7200 } // 2 hours
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to fetch regions', error as Error);
      throw error;
    }
  }

  /**
   * Get districts by region
   */
  static async getDistricts(regionId: string): Promise<ApiResponse<any[]>> {
    try {
      loggingService.info('Fetching districts', { regionId });
      
      const response = await httpClient.get<any[]>(
        `${API_ENDPOINTS.LOCATIONS.DISTRICTS}?regionId=${encodeURIComponent(regionId)}`,
        { 
          cache: true, 
          cacheTTL: 7200, // 2 hours
        }
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to fetch districts', error as Error, { regionId });
      throw error;
    }
  }

  /**
   * Search locations
   */
  static async searchLocations(query: string): Promise<ApiResponse<any[]>> {
    try {
      loggingService.info('Searching locations', { query });
      
      const response = await httpClient.get<any[]>(
        `${API_ENDPOINTS.LOCATIONS.SEARCH}?query=${encodeURIComponent(query)}`,
        { 
          cache: true, 
          cacheTTL: 1800, // 30 minutes
        }
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to search locations', error as Error, { query });
      throw error;
    }
  }
}

// ============================================================================
// SEARCH API
// ============================================================================

export class SearchApi {
  /**
   * Search listings
   */
  static async searchListings(filters: any): Promise<ApiResponse<any>> {
    try {
      loggingService.info('Searching listings', { filters });
      
      // Convert filters to query parameters
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });
      
      const response = await httpClient.get<any>(
        `${API_ENDPOINTS.SEARCH.LISTINGS}?${queryParams.toString()}`,
        {
          cache: true,
          cacheTTL: 300, // 5 minutes
        }
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to search listings', error as Error, { filters });
      throw error;
    }
  }

  /**
   * Get search suggestions
   */
  static async getSearchSuggestions(query: string): Promise<ApiResponse<string[]>> {
    try {
      loggingService.info('Getting search suggestions', { query });
      
      const response = await httpClient.get<string[]>(
        `${API_ENDPOINTS.SEARCH.SUGGESTIONS}?query=${encodeURIComponent(query)}`,
        {
          cache: true,
          cacheTTL: 1800, // 30 minutes
        }
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to get search suggestions', error as Error, { query });
      throw error;
    }
  }
}

// ============================================================================
// MEDIA API
// ============================================================================

export class MediaApi {
  /**
   * Upload file
   */
  static async uploadFile(file: File, entityType?: string): Promise<ApiResponse<{ url: string; id: string }>> {
    try {
      loggingService.info('Uploading file', { fileName: file.name, fileSize: file.size });
      
      const formData = new FormData();
      formData.append('file', file);
      if (entityType) {
        formData.append('entityType', entityType);
      }

      const response = await httpClient.post<{ url: string; id: string }>(
        API_ENDPOINTS.MEDIA.UPLOAD,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 60000, // 1 minute for file uploads
        }
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to upload file', error as Error, { fileName: file.name });
      throw error;
    }
  }

  /**
   * Delete file
   */
  static async deleteFile(id: UUID): Promise<ApiResponse<void>> {
    try {
      loggingService.info('Deleting file', { id });
      
      const response = await httpClient.delete<void>(
        API_ENDPOINTS.MEDIA.DELETE(id)
      );

      return response;
    } catch (error) {
      loggingService.error('Failed to delete file', error as Error, { id });
      throw error;
    }
  }
}

// ============================================================================
// ALL API SERVICES EXPORTED FROM THIS FILE
// ============================================================================
// All API classes are exported inline above
