/**
 * Base Service Classes and Interfaces
 * Production-ready service layer with clean API abstraction
 */

import type {
  BaseEntity,
  ApiResponse,
  PaginationParams,
  PaginationMeta,
  SearchFilters,
  SearchResult,
  UUID,
  JSONValue,
} from '../../shared/types';
import { API_CONFIG, ERROR_CODES } from '../../shared/constants';

// ============================================================================
// BASE INTERFACES
// ============================================================================

export interface IBaseService<T, CreateDto = Partial<T>, UpdateDto = Partial<T>> {
  findAll(filters?: SearchFilters): Promise<SearchResult<T>>;
  findById(id: UUID): Promise<T>;
  create(data: CreateDto): Promise<T>;
  update(id: UUID, data: UpdateDto): Promise<T>;
  delete(id: UUID): Promise<void>;
}

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface ILoggingService {
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error | any, data?: any): void;
  debug(message: string, data?: any): void;
}

export interface IEventEmitter {
  on<T>(event: string, handler: (data: T) => void): void;
  off<T>(event: string, handler: (data: T) => void): void;
  emit<T>(event: string, data: T): void;
}

// ============================================================================
// HTTP CLIENT CONFIGURATION
// ============================================================================

export interface HttpClientConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  headers?: Record<string, string>;
  loggingService?: ILoggingService;
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
  };
}

export interface RequestInterceptor {
  onRequest(config: RequestInit): RequestInit | Promise<RequestInit>;
  onRequestError(error: Error): void | Promise<void>;
}

export interface ResponseInterceptor {
  onResponse(response: Response): Response | Promise<Response>;
  onResponseError(error: Error): Response | Promise<Response> | void | Promise<void>;
}

export interface RequestOptions extends Omit<RequestInit, 'cache'> {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
  url?: string;
  query?: Record<string, any>;
  regionId?: string;
}

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class BaseError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: JSONValue;

  constructor(
    message: string,
    code: string = ERROR_CODES.UNKNOWN_ERROR,
    statusCode: number = 500,
    details?: JSONValue
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    
    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, details?: JSONValue) {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400, details);
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string = 'Authentication failed') {
    super(message, ERROR_CODES.UNAUTHORIZED, 401);
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string = 'Access forbidden') {
    super(message, ERROR_CODES.FORBIDDEN, 403);
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, ERROR_CODES.RESOURCE_NOT_FOUND, 404);
  }
}

export class ConflictError extends BaseError {
  constructor(message: string = 'Resource already exists') {
    super(message, ERROR_CODES.RESOURCE_ALREADY_EXISTS, 409);
  }
}

export class NetworkError extends BaseError {
  constructor(message: string = 'Network error occurred') {
    super(message, ERROR_CODES.NETWORK_ERROR, 0);
  }
}

export class TimeoutError extends BaseError {
  constructor(message: string = 'Request timeout') {
    super(message, ERROR_CODES.TIMEOUT_ERROR, 408);
  }
}

export class RateLimitError extends BaseError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, ERROR_CODES.RATE_LIMIT_EXCEEDED, 429);
  }
}

export class ServerError extends BaseError {
  constructor(message: string = 'Internal server error') {
    super(message, ERROR_CODES.INTERNAL_SERVER_ERROR, 500);
  }
}

// ============================================================================
// HTTP CLIENT IMPLEMENTATION
// ============================================================================

export class HttpClient {
  private config: HttpClientConfig;
  private abortController?: AbortController;
  private retryCount: Map<string, number> = new Map();

  constructor(config: Partial<HttpClientConfig> = {}) {
    this.config = {
      baseURL: API_CONFIG.BASE_URL,
      timeout: API_CONFIG.TIMEOUT,
      retryAttempts: API_CONFIG.RETRY_ATTEMPTS,
      retryDelay: API_CONFIG.RETRY_DELAY,
      headers: {
        'Content-Type': 'application/json',
      },
      ...config,
    };
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.config.headers = {
      ...this.config.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  /**
   * Remove authentication token
   */
  clearAuthToken(): void {
    const { Authorization, ...headers } = this.config.headers || {};
    this.config.headers = headers;
  }

  /**
   * Make HTTP request with retry logic and error handling
   */
  async request<T = any>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = this.config.timeout,
      retries = this.config.retryAttempts,
      cache = false,
      cacheTTL = 300, // 5 minutes default
      ...fetchOptions
    } = options;

    const url = `${this.config.baseURL}${endpoint}`;
    const cacheKey = cache ? `http_cache_${url}_${JSON.stringify(fetchOptions)}` : null;

    // Check cache first
    if (cache && cacheKey) {
      try {
        const cached = await this.getCachedResponse<ApiResponse<T>>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (error) {
        // Cache error, continue with request
        console.warn('Cache read error:', error);
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.abortController = new AbortController();
        
        const timeoutId = setTimeout(() => {
          this.abortController?.abort();
        }, timeout);

        const config: RequestInit = {
          ...fetchOptions,
          headers: {
            ...this.config.headers,
            ...fetchOptions.headers,
          },
          signal: this.abortController.signal,
        };

        // Apply request interceptors
        const finalConfig = await this.applyRequestInterceptors(config);

        const response = await fetch(url, finalConfig);
        clearTimeout(timeoutId);

        // Apply response interceptors
        const finalResponse = await this.applyResponseInterceptors(response);

        if (!finalResponse.ok) {
          const errorData = await this.parseErrorResponse(finalResponse);
          throw this.createErrorFromResponse(finalResponse.status, errorData);
        }

        const data: ApiResponse<T> = await finalResponse.json();

        // Cache successful response
        if (cache && cacheKey && data.success) {
          try {
            await this.setCachedResponse(cacheKey, data, cacheTTL);
          } catch (error) {
            console.warn('Cache write error:', error);
          }
        }

        return data;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on certain errors
        if (error instanceof ValidationError || 
            error instanceof AuthenticationError || 
            error instanceof AuthorizationError ||
            error instanceof NotFoundError ||
            error instanceof ConflictError) {
          throw error;
        }

        // If this is the last attempt, throw the error
        if (attempt === retries) {
          throw error;
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError || new NetworkError('Request failed after retries');
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(
    endpoint: string, 
    data?: any, 
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT request
   */
  async put<T = any>(
    endpoint: string, 
    data?: any, 
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PATCH request
   */
  async patch<T = any>(
    endpoint: string, 
    data?: any, 
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Cancel current request
   */
  cancel(): void {
    this.abortController?.abort();
  }

  /**
   * Apply request interceptors
   */
  private async applyRequestInterceptors(config: RequestInit): Promise<RequestInit> {
    if (!this.config.interceptors?.request) {
      return config;
    }

    let finalConfig = config;
    
    for (const interceptor of this.config.interceptors.request) {
      try {
        finalConfig = await interceptor.onRequest(finalConfig);
      } catch (error) {
        await interceptor.onRequestError(error as Error);
        throw error;
      }
    }

    return finalConfig;
  }

  /**
   * Apply response interceptors
   */
  private async applyResponseInterceptors(response: Response): Promise<Response> {
    if (!this.config.interceptors?.response) {
      return response;
    }

    let finalResponse = response;
    
    for (const interceptor of this.config.interceptors.response) {
      try {
        finalResponse = await interceptor.onResponse(finalResponse);
      } catch (error) {
        const result = await interceptor.onResponseError(error as Error);
        if (result) {
          finalResponse = result;
        } else {
          throw error;
        }
      }
    }

    return finalResponse;
  }

  /**
   * Parse error response
   */
  private async parseErrorResponse(response: Response): Promise<any> {
    try {
      return await response.json();
    } catch {
      return {
        message: response.statusText || 'Unknown error',
        code: `HTTP_${response.status}`,
      };
    }
  }

  /**
   * Create error from HTTP response
   */
  private createErrorFromResponse(status: number, errorData: any): Error {
    const message = errorData?.message || 'Request failed';
    const code = errorData?.code || `HTTP_${status}`;
    const details = errorData?.details;

    switch (status) {
      case 400:
        return new ValidationError(message, details);
      case 401:
        return new AuthenticationError(message);
      case 403:
        return new AuthorizationError(message);
      case 404:
        return new NotFoundError(message);
      case 408:
        return new TimeoutError(message);
      case 409:
        return new ConflictError(message);
      case 429:
        return new RateLimitError(message);
      case 500:
      case 502:
      case 503:
      case 504:
        return new ServerError(message);
      default:
        return new BaseError(message, code, status, details);
    }
  }

  /**
   * Delay helper for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cached response (localStorage fallback)
   */
  private async getCachedResponse<T>(key: string): Promise<T | null> {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;

      const { data, expiry } = JSON.parse(cached);
      if (Date.now() > expiry) {
        localStorage.removeItem(key);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  /**
   * Set cached response (localStorage fallback)
   */
  private async setCachedResponse<T>(key: string, data: T, ttl: number): Promise<void> {
    try {
      const expiry = Date.now() + ttl * 1000;
      localStorage.setItem(key, JSON.stringify({ data, expiry }));
    } catch {
      // Storage quota exceeded or other storage error
    }
  }
}

// ============================================================================
// BASE SERVICE IMPLEMENTATION
// ============================================================================

export abstract class BaseService<T extends BaseEntity, CreateDto = Partial<T>, UpdateDto = Partial<T>>
  implements IBaseService<T, CreateDto, UpdateDto>
{
  protected httpClient: HttpClient;
  protected endpoint: string;
  protected cacheService?: ICacheService;
  protected loggingService?: ILoggingService;

  constructor(
    httpClient: HttpClient,
    endpoint: string,
    cacheService?: ICacheService,
    loggingService?: ILoggingService
  ) {
    this.httpClient = httpClient;
    this.endpoint = endpoint;
    this.cacheService = cacheService;
    this.loggingService = loggingService;
  }

  /**
   * Find all entities with optional filters
   */
  async findAll(filters?: SearchFilters): Promise<SearchResult<T>> {
    try {
      this.loggingService?.info(`Finding all ${this.endpoint}`, { filters });
      
      const queryParams = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
      }

      const url = queryParams.toString() ? `${this.endpoint}?${queryParams}` : this.endpoint;
      const response = await this.httpClient.get<SearchResult<T>>(url);

      if (!response.success || !response.data) {
        throw new BaseError('Failed to fetch entities', 'FETCH_ERROR', 500);
      }

      this.loggingService?.info(`Successfully fetched ${response.data.total} ${this.endpoint}`);
      return response.data;
    } catch (error) {
      this.loggingService?.error(`Failed to fetch ${this.endpoint}`, error as Error, { filters });
      throw error;
    }
  }

  /**
   * Find entity by ID
   */
  async findById(id: UUID): Promise<T> {
    try {
      this.loggingService?.info(`Finding ${this.endpoint} by ID: ${id}`);
      
      // Check cache first
      const cacheKey = `${this.endpoint}_${id}`;
      if (this.cacheService) {
        const cached = await this.cacheService.get<T>(cacheKey);
        if (cached) {
          this.loggingService?.debug(`Cache hit for ${this.endpoint} ID: ${id}`);
          return cached;
        }
      }

      const response = await this.httpClient.get<T>(`${this.endpoint}/${id}`);

      if (!response.success || !response.data) {
        throw new NotFoundError(`${this.endpoint} with ID ${id}`);
      }

      // Cache the result
      if (this.cacheService) {
        await this.cacheService.set(cacheKey, response.data, 300); // 5 minutes
      }

      this.loggingService?.info(`Successfully fetched ${this.endpoint} ID: ${id}`);
      return response.data;
    } catch (error) {
      this.loggingService?.error(`Failed to fetch ${this.endpoint} ID: ${id}`, error as Error);
      throw error;
    }
  }

  /**
   * Create new entity
   */
  async create(data: CreateDto): Promise<T> {
    try {
      this.loggingService?.info(`Creating new ${this.endpoint}`, { data });
      
      const response = await this.httpClient.post<T>(this.endpoint, data);

      if (!response.success || !response.data) {
        throw new BaseError('Failed to create entity', 'CREATE_ERROR', 500);
      }

      // Invalidate cache
      await this.invalidateCache();

      this.loggingService?.info(`Successfully created ${this.endpoint} with ID: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.loggingService?.error(`Failed to create ${this.endpoint}`, error as Error, { data });
      throw error;
    }
  }

  /**
   * Update existing entity
   */
  async update(id: UUID, data: UpdateDto): Promise<T> {
    try {
      this.loggingService?.info(`Updating ${this.endpoint} ID: ${id}`, { data });
      
      const response = await this.httpClient.put<T>(`${this.endpoint}/${id}`, data);

      if (!response.success || !response.data) {
        throw new BaseError('Failed to update entity', 'UPDATE_ERROR', 500);
      }

      // Update cache
      const cacheKey = `${this.endpoint}_${id}`;
      if (this.cacheService) {
        await this.cacheService.set(cacheKey, response.data, 300);
      }

      this.loggingService?.info(`Successfully updated ${this.endpoint} ID: ${id}`);
      return response.data;
    } catch (error) {
      this.loggingService?.error(`Failed to update ${this.endpoint} ID: ${id}`, error as Error, { data });
      throw error;
    }
  }

  /**
   * Delete entity
   */
  async delete(id: UUID): Promise<void> {
    try {
      this.loggingService?.info(`Deleting ${this.endpoint} ID: ${id}`);
      
      const response = await this.httpClient.delete(`${this.endpoint}/${id}`);

      if (!response.success) {
        throw new BaseError('Failed to delete entity', 'DELETE_ERROR', 500);
      }

      // Remove from cache
      const cacheKey = `${this.endpoint}_${id}`;
      if (this.cacheService) {
        await this.cacheService.delete(cacheKey);
      }

      this.loggingService?.info(`Successfully deleted ${this.endpoint} ID: ${id}`);
    } catch (error) {
      this.loggingService?.error(`Failed to delete ${this.endpoint} ID: ${id}`, error as Error);
      throw error;
    }
  }

  /**
   * Invalidate all cache entries for this service
   */
  protected async invalidateCache(): Promise<void> {
    if (!this.cacheService) return;

    try {
      // In a real implementation, you would have a more sophisticated cache invalidation strategy
      // For now, we'll clear all cache (this is a fallback approach)
      await this.cacheService.clear();
      this.loggingService?.debug(`Invalidated cache for ${this.endpoint}`);
    } catch (error) {
      this.loggingService?.warn(`Failed to invalidate cache for ${this.endpoint}`, error as Error);
    }
  }
}

// ============================================================================
// CACHE SERVICE IMPLEMENTATION (localStorage fallback)
// ============================================================================

export class LocalStorageCacheService implements ICacheService {
  private prefix: string;

  constructor(prefix: string = 'app_cache_') {
    this.prefix = prefix;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const { data, expiry } = JSON.parse(item);
      if (Date.now() > expiry) {
        localStorage.removeItem(this.prefix + key);
        return null;
      }

      return data;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl: number = 300): Promise<void> {
    try {
      const expiry = Date.now() + ttl * 1000;
      localStorage.setItem(this.prefix + key, JSON.stringify({ data: value, expiry }));
    } catch {
      // Storage quota exceeded or other storage error
    }
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  async exists(key: string): Promise<boolean> {
    const item = localStorage.getItem(this.prefix + key);
    if (!item) return false;

    try {
      const { expiry } = JSON.parse(item);
      if (Date.now() > expiry) {
        localStorage.removeItem(this.prefix + key);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// LOGGING SERVICE IMPLEMENTATION
// ============================================================================

export class ConsoleLoggingService implements ILoggingService {
  private isDevelopment: boolean;

  constructor(isDevelopment: boolean = false) {
    this.isDevelopment = isDevelopment;
  }

  info(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.info(`ℹ️ ${message}`, data);
    }
  }

  warn(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.warn(`⚠️ ${message}`, data);
    }
  }

  error(message: string, error?: Error | any, data?: any): void {
    if (this.isDevelopment) {
      console.error(`❌ ${message}`, error, data);
    }
  }

  debug(message: string, data?: any): void {
    if (this.isDevelopment) {
      console.debug(`🐛 ${message}`, data);
    }
  }
}

// ============================================================================
// EVENT EMITTER IMPLEMENTATION
// ============================================================================

export class EventEmitter implements IEventEmitter {
  private events: Map<string, Set<Function>> = new Map();

  on<T>(event: string, handler: (data: T) => void): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(handler);
  }

  off<T>(event: string, handler: (data: T) => void): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.events.delete(event);
      }
    }
  }

  emit<T>(event: string, data: T): void {
    const handlers = this.events.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.events.delete(event);
    } else {
      this.events.clear();
    }
  }

  listenerCount(event: string): number {
    return this.events.get(event)?.size || 0;
  }
}

// ============================================================================
// ALL SERVICES AND UTILITIES EXPORTED FROM THIS FILE
// ============================================================================
