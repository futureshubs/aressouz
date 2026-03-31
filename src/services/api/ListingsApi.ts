/**
 * Listings API Service
 * Listings management endpoints
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

export class ListingsApi {
  /**
   * Get listings
   */
  static async getListings(params?: any): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.get<any>(
        API_ENDPOINTS.LISTINGS.LIST,
        params
      );

      return response;
    } catch (error) {
      console.error('Failed to get listings:', error);
      throw error;
    }
  }

  /**
   * Get listing details
   */
  static async getListing(id: string): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.get<any>(
        API_ENDPOINTS.LISTINGS.DETAIL(id)
      );

      return response;
    } catch (error) {
      console.error('Failed to get listing:', error);
      throw error;
    }
  }

  /**
   * Create listing
   */
  static async createListing(listingData: any): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.post<any>(
        API_ENDPOINTS.LISTINGS.CREATE,
        listingData
      );

      return response;
    } catch (error) {
      console.error('Failed to create listing:', error);
      throw error;
    }
  }

  /**
   * Update listing
   */
  static async updateListing(id: string, listingData: any): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.put<any>(
        API_ENDPOINTS.LISTINGS.UPDATE(id),
        listingData
      );

      return response;
    } catch (error) {
      console.error('Failed to update listing:', error);
      throw error;
    }
  }

  /**
   * Delete listing
   */
  static async deleteListing(id: string): Promise<ApiResponse<any>> {
    try {
      const response = await httpClient.delete<any>(
        API_ENDPOINTS.LISTINGS.DELETE(id)
      );

      return response;
    } catch (error) {
      console.error('Failed to delete listing:', error);
      throw error;
    }
  }
}
