/**
 * Auth API Service
 * Authentication and authorization endpoints
 */

import { HttpClient, ConsoleLoggingService } from '../base';
import { API_CONFIG, API_ENDPOINTS, STORAGE_KEYS } from '../../shared/constants';
import { ApiResponse } from '../../shared/types';

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
          // Add request ID for tracking
          const requestId = crypto.randomUUID();
          config.headers = {
            ...config.headers,
            'X-Request-ID': requestId,
          };

          return config;
        },
        onRequestError: (error) => {
          console.error('❌ Request Error:', error);
          return Promise.reject(error);
        },
      },
    ],
    response: [
      {
        onResponse: (response) => {
          console.log(`✅ API Response: ${response.status}`, {
            status: response.status,
            headers: response.headers,
          });
          return response;
        },
        onResponseError: (error) => {
          console.error('❌ Response Error:', error);
          return Promise.reject(error);
        },
      },
    ],
  },
  loggingService: new ConsoleLoggingService(),
});

export class AuthApi {
  /**
   * Login user
   */
  static async login(credentials: { email: string; password: string }): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.post<any>(
        API_ENDPOINTS.AUTH.LOGIN,
        credentials
      );

      return response;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  /**
   * Register user
   */
  static async register(userData: any): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.post<any>(
        API_ENDPOINTS.AUTH.REGISTER,
        userData
      );

      return response;
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  }

  /**
   * Refresh token
   */
  static async refreshToken(refreshToken: string): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.post<any>(
        API_ENDPOINTS.AUTH.REFRESH,
        { refreshToken }
      );

      return response;
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  static async logout(): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.post<any>(
        API_ENDPOINTS.AUTH.LOGOUT,
        {}
      );

      return response;
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }
}
