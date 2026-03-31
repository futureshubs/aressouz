/**
 * User API Service
 * User management endpoints
 */

import { HttpClient, ConsoleLoggingService } from '../base';
import { API_CONFIG, API_ENDPOINTS } from '../../shared/constants';
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
  loggingService: new ConsoleLoggingService(),
});

export class UserApi {
  /**
   * Get user profile
   */
  static async getProfile(): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.get<any>(
        API_ENDPOINTS.USER.PROFILE
      );

      return response;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(userData: any): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.put<any>(
        API_ENDPOINTS.USER.PROFILE,
        userData
      );

      return response;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      throw error;
    }
  }

  /**
   * Change password
   */
  static async changePassword(passwordData: any): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.post<any>(
        API_ENDPOINTS.USER.CHANGE_PASSWORD,
        passwordData
      );

      return response;
    } catch (error) {
      console.error('Failed to change password:', error);
      throw error;
    }
  }
}
