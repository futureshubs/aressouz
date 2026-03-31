/**
 * Production-ready CORS middleware
 * Provides secure and configurable CORS handling
 */

import type { Context, Next } from 'hono';
import { EnvironmentConfig } from '../types/index.js';

export class CorsMiddleware {
  private config: EnvironmentConfig['cors'];

  constructor(config: EnvironmentConfig['cors']) {
    this.config = config;
  }

  /**
   * Main CORS middleware handler
   */
  public handle = async (ctx: Context, next: Next): Promise<void> => {
    // Handle preflight requests
    if (ctx.req.method === 'OPTIONS') {
      await this.handlePreflight(ctx);
      return;
    }

    // Add CORS headers to all responses
    this.addCorsHeaders(ctx);
    await next();
  };

  /**
   * Handle OPTIONS preflight requests
   */
  private handlePreflight(ctx: Context): void {
    const origin = ctx.req.header('Origin');
    
    // Validate origin
    if (!this.isOriginAllowed(origin)) {
      ctx.status(403);
      return;
    }

    // Set preflight headers
    ctx.header('Access-Control-Allow-Origin', origin || '*');
    ctx.header('Access-Control-Allow-Methods', this.config.allowedMethods.join(', '));
    ctx.header('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));
    ctx.header('Access-Control-Max-Age', this.config.maxAge.toString());
    ctx.header('Vary', 'Origin');
    
    ctx.status(204);
  }

  /**
   * Add CORS headers to regular responses
   */
  private addCorsHeaders(ctx: Context): void {
    const origin = ctx.req.header('Origin');
    
    if (this.isOriginAllowed(origin)) {
      ctx.header('Access-Control-Allow-Origin', origin || '*');
      ctx.header('Access-Control-Allow-Credentials', 'true');
      ctx.header('Vary', 'Origin');
    }
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin?: string): boolean {
    if (!origin) return true; // Allow non-browser requests
    
    return this.config.allowedOrigins.includes('*') || 
           this.config.allowedOrigins.includes(origin);
  }
}

/**
 * Default CORS configuration
 */
export const defaultCorsConfig: EnvironmentConfig['cors'] = {
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://yourdomain.com',
    '*' // Remove in production
  ],
  allowedMethods: [
    'GET',
    'POST',
    'PUT',
    'DELETE',
    'PATCH',
    'OPTIONS'
  ],
  allowedHeaders: [
    'Origin',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-Requested-With',
    'X-Client-Info',
    'API-Key',
    'X-Request-ID'
  ],
  maxAge: 86400 // 24 hours
};
