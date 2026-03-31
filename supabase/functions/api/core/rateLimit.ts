/**
 * Production-ready rate limiting system for API edge functions
 * Provides configurable rate limiting with different strategies and storage backends
 */

// Deno types declaration
declare const Deno: {
  Kv: any;
};

import { RateLimitConfig, RateLimitInfo, RequestContext } from './types.ts';
import { ApiLogger } from './logger.ts';
import { RateLimitError } from './errors.ts';

// ============================================================================
// Rate Limiting Storage Interface
// ============================================================================

export interface RateLimitStorage {
  /**
   * Gets rate limit data for a key
   */
  get(key: string): Promise<RateLimitData | null>;

  /**
   * Sets rate limit data for a key with expiry
   */
  set(key: string, data: RateLimitData, ttlMs: number): Promise<void>;

  /**
   * Increments counter for a key
   */
  increment(key: string, ttlMs: number): Promise<number>;

  /**
   * Deletes rate limit data for a key
   */
  delete(key: string): Promise<void>;
}

export interface RateLimitData {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// ============================================================================
// In-Memory Storage (for development/testing)
// ============================================================================

export class MemoryRateLimitStorage implements RateLimitStorage {
  private store: Map<string, RateLimitData> = new Map();
  private timeouts: Map<string, number> = new Map();

  async get(key: string): Promise<RateLimitData | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, data: RateLimitData, ttlMs: number): Promise<void> {
    this.store.set(key, data);
    
    // Clear existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout for cleanup
    const timeout = setTimeout(() => {
      this.store.delete(key);
      this.timeouts.delete(key);
    }, ttlMs);
    
    this.timeouts.set(key, timeout as unknown as number);
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    const existing = this.store.get(key);
    const now = Date.now();
    
    if (!existing || now > existing.resetTime) {
      const newData: RateLimitData = {
        count: 1,
        resetTime: now + ttlMs,
        firstRequest: now
      };
      
      await this.set(key, newData, ttlMs);
      return 1;
    }
    
    existing.count++;
    await this.set(key, existing, ttlMs);
    return existing.count;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    
    const timeout = this.timeouts.get(key);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(key);
    }
  }

  /**
   * Cleanup method for testing
   */
  clear(): void {
    this.store.clear();
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
  }
}

// ============================================================================
// KV Storage (for production)
// ============================================================================

export class KVRateLimitStorage implements RateLimitStorage {
  private kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  async get(key: string): Promise<RateLimitData | null> {
    try {
      const result = await this.kv.get<RateLimitData>(['rate_limit', key]);
      return result.value;
    } catch (error) {
      console.error('KV get error:', error);
      return null;
    }
  }

  async set(key: string, data: RateLimitData, ttlMs: number): Promise<void> {
    try {
      await this.kv.set(['rate_limit', key], data, {
        expireIn: ttlMs
      });
    } catch (error) {
      console.error('KV set error:', error);
    }
  }

  async increment(key: string, ttlMs: number): Promise<number> {
    try {
      const now = Date.now();
      const result = await this.kv.atomic()
        .sum(['rate_limit', key, 'count'], 1)
        .set(['rate_limit', key, 'resetTime'], now + ttlMs, { expireIn: ttlMs })
        .set(['rate_limit', key, 'firstRequest'], now, { expireIn: ttlMs })
        .commit();

      if (!result.ok) {
        throw new Error('KV atomic operation failed');
      }

      // Get the updated count
      const countResult = await this.kv.get<number>(['rate_limit', key, 'count']);
      return countResult.value || 1;
    } catch (error) {
      console.error('KV increment error:', error);
      return 1; // Fail open
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.kv.delete(['rate_limit', key]);
    } catch (error) {
      console.error('KV delete error:', error);
    }
  }
}

// ============================================================================
// Rate Limiter
// ============================================================================

export class RateLimiter {
  private storage: RateLimitStorage;
  private config: RateLimitConfig;
  private logger: ApiLogger;

  constructor(
    config: RateLimitConfig,
    storage: RateLimitStorage,
    logger: ApiLogger
  ) {
    this.config = config;
    this.storage = storage;
    this.logger = logger;
  }

  /**
   * Checks rate limit for a request
   */
  async checkLimit(req: RequestContext): Promise<RateLimitInfo> {
    const key = this.generateKey(req);
    const now = Date.now();
    
    try {
      const count = await this.storage.increment(key, this.config.windowMs);
      const data = await this.storage.get(key);
      
      if (!data) {
        // This shouldn't happen, but handle gracefully
        return {
          limit: this.config.maxRequests,
          remaining: this.config.maxRequests - 1,
          reset: now + this.config.windowMs
        };
      }

      const remaining = Math.max(0, this.config.maxRequests - count);
      const reset = data.resetTime;
      const retryAfter = count > this.config.maxRequests ? Math.ceil((reset - now) / 1000) : undefined;

      // Log rate limit events
      if (count === this.config.maxRequests) {
        this.logger.warn('Rate limit threshold reached', {
          key,
          count,
          limit: this.config.maxRequests,
          resetTime: new Date(reset).toISOString()
        });
      }

      if (count > this.config.maxRequests) {
        this.logger.warn('Rate limit exceeded', {
          key,
          count,
          limit: this.config.maxRequests,
          retryAfter
        });
        
        throw new RateLimitError(retryAfter);
      }

      return {
        limit: this.config.maxRequests,
        remaining,
        reset,
        retryAfter
      };
    } catch (error) {
      if (error instanceof RateLimitError) {
        throw error;
      }
      
      this.logger.error('Rate limit check failed', error as Error, { key });
      // Fail open - allow the request if rate limiting fails
      return {
        limit: this.config.maxRequests,
        remaining: this.config.maxRequests - 1,
        reset: now + this.config.windowMs
      };
    }
  }

  /**
   * Generates rate limit key for request
   */
  private generateKey(req: RequestContext): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Default key generation based on IP
    const ip = req.ip || 'unknown';
    const path = req.path || '/';
    return `${ip}:${path}`;
  }

  /**
   * Resets rate limit for a key
   */
  async reset(key: string): Promise<void> {
    await this.storage.delete(key);
    this.logger.info('Rate limit reset', { key });
  }

  /**
   * Gets current rate limit status without incrementing
   */
  async getStatus(req: RequestContext): Promise<RateLimitInfo | null> {
    const key = this.generateKey(req);
    const data = await this.storage.get(key);
    
    if (!data) {
      return null;
    }

    const now = Date.now();
    const count = data.count;
    const remaining = Math.max(0, this.config.maxRequests - count);
    const reset = data.resetTime;
    const retryAfter = count > this.config.maxRequests ? Math.ceil((reset - now) / 1000) : undefined;

    return {
      limit: this.config.maxRequests,
      remaining,
      reset,
      retryAfter
    };
  }
}

// ============================================================================
// Rate Limiting Strategies
// ============================================================================

export class RateLimitStrategies {
  /**
   * IP-based rate limiting
   */
  static byIp(req: RequestContext): string {
    const ip = req.ip || 'unknown';
    return `ip:${ip}`;
  }

  /**
   * User-based rate limiting (requires authentication)
   */
  static byUser(req: RequestContext, userId?: string): string {
    if (!userId) {
      throw new Error('User ID required for user-based rate limiting');
    }
    return `user:${userId}`;
  }

  /**
   * IP + Path based rate limiting
   */
  static byIpAndPath(req: RequestContext): string {
    const ip = req.ip || 'unknown';
    const path = req.path || '/';
    return `ip:${ip}:path:${path}`;
  }

  /**
   * User + Action based rate limiting
   */
  static byUserAndAction(req: RequestContext, userId: string, action: string): string {
    return `user:${userId}:action:${action}`;
  }

  /**
   * Global rate limiting (same for all requests)
   */
  static global(): string {
    return 'global';
  }

  /**
   * Custom key generator that combines multiple factors
   */
  static custom(
    factors: Array<(req: RequestContext) => string>,
    separator: string = ':'
  ): (req: RequestContext) => string {
    return (req: RequestContext) => {
      return factors.map(factor => factor(req)).join(separator);
    };
  }
}

// ============================================================================
// Rate Limiting Middleware
// ============================================================================

export function createRateLimitMiddleware(
  config: RateLimitConfig,
  storage: RateLimitStorage,
  logger: ApiLogger
) {
  const rateLimiter = new RateLimiter(config, storage, logger);

  return async (req: RequestContext): Promise<void> => {
    await rateLimiter.checkLimit(req);
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates rate limiter with memory storage (for development)
 */
export function createMemoryRateLimiter(
  config: RateLimitConfig,
  logger: ApiLogger
): RateLimiter {
  const storage = new MemoryRateLimitStorage();
  return new RateLimiter(config, storage, logger);
}

/**
 * Creates rate limiter with KV storage (for production)
 */
export function createKVRateLimiter(
  config: RateLimitConfig,
  kv: Deno.Kv,
  logger: ApiLogger
): RateLimiter {
  const storage = new KVRateLimitStorage(kv);
  return new RateLimiter(config, storage, logger);
}

/**
 * Creates rate limiting configuration
 */
export function createRateLimitConfig(
  windowMs: number,
  maxRequests: number,
  options: Partial<RateLimitConfig> = {}
): RateLimitConfig {
  return {
    windowMs,
    maxRequests,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    ...options
  };
}

// ============================================================================
// Predefined Configurations
// ============================================================================

export const RateLimitPresets = {
  /**
   * Strict rate limiting for sensitive endpoints
   */
  strict: createRateLimitConfig(
    15 * 60 * 1000, // 15 minutes
    5, // 5 requests
    { keyGenerator: RateLimitStrategies.byIpAndPath }
  ),

  /**
   * Moderate rate limiting for general API
   */
  moderate: createRateLimitConfig(
    15 * 60 * 1000, // 15 minutes
    100, // 100 requests
    { keyGenerator: RateLimitStrategies.byIp }
  ),

  /**
   * Lenient rate limiting for high-traffic endpoints
   */
  lenient: createRateLimitConfig(
    15 * 60 * 1000, // 15 minutes
    1000, // 1000 requests
    { keyGenerator: RateLimitStrategies.byIp }
  ),

  /**
   * User-based rate limiting for authenticated endpoints
   */
  userBased: createRateLimitConfig(
    15 * 60 * 1000, // 15 minutes
    200, // 200 requests per user
    { 
      keyGenerator: (req: RequestContext) => {
        const userId = req.headers['x-user-id'] || req.headers['X-User-ID'];
        if (!userId) {
          throw new Error('User ID required for user-based rate limiting');
        }
        return RateLimitStrategies.byUser(req, userId);
      }
    }
  ),

  /**
   * Rate limiting for authentication endpoints
   */
  auth: createRateLimitConfig(
    15 * 60 * 1000, // 15 minutes
    10, // 10 requests
    { keyGenerator: RateLimitStrategies.byIpAndPath }
  ),

  /**
   * Rate limiting for SMS endpoints
   */
  sms: createRateLimitConfig(
    60 * 60 * 1000, // 1 hour
    5, // 5 SMS per hour
    { keyGenerator: RateLimitStrategies.byIpAndPath }
  )
};
