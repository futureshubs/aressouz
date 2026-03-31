/**
 * Production-ready authentication middleware
 * Provides JWT token validation and role-based access control
 */

import type { Context, Next } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { UserRole, User } from '../types/index.js';

export class AuthMiddleware {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Authenticate user from JWT token
   */
  public authenticate = async (ctx: Context, next: Next): Promise<void> => {
    try {
      const token = this.extractToken(ctx);
      
      if (!token) {
        ctx.status(401);
        ctx.json({
          success: false,
          error: 'Authentication required',
          errorCode: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }

      // Verify JWT token with Supabase
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        ctx.status(401);
        ctx.json({
          success: false,
          error: 'Invalid or expired token',
          errorCode: 'INVALID_TOKEN',
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }

      // Get user profile with role information
      const { data: profile, error: profileError } = await this.supabase
        .from('user_profiles')
        .select(`
          *,
          users!inner(
            id,
            email,
            phone,
            role,
            is_active,
            created_at,
            last_login_at
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.users) {
        ctx.status(401);
        ctx.json({
          success: false,
          error: 'User profile not found',
          errorCode: 'PROFILE_NOT_FOUND',
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }

      const userData = profile.users;
      if (!userData.is_active) {
        ctx.status(403);
        ctx.json({
          success: false,
          error: 'Account is deactivated',
          errorCode: 'ACCOUNT_DEACTIVATED',
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }

      // Store user data in context
      ctx.set('user', {
        id: userData.id,
        email: userData.email,
        phone: userData.phone,
        role: userData.role,
        isActive: userData.is_active,
        lastLoginAt: userData.last_login_at,
        profileId: profile.id,
        createdAt: userData.created_at,
        updatedAt: profile.updated_at,
        profile: {
          firstName: profile.first_name,
          lastName: profile.last_name,
          avatar: profile.avatar,
          preferences: profile.preferences
        }
      } as User);

      await next();

    } catch (error) {
      console.error('Authentication error:', error);
      ctx.status(500);
      ctx.json({
        success: false,
        error: 'Authentication service error',
        errorCode: 'AUTH_SERVICE_ERROR',
        timestamp: new Date().toISOString(),
        requestId: ctx.get('requestId')
      });
    }
  };

  /**
   * Require specific role to access endpoint
   */
  public requireRole = (allowedRoles: UserRole[]) => {
    return async (ctx: Context, next: Next): Promise<void> => {
      const user = ctx.get('user') as User;

      if (!user) {
        ctx.status(401);
        ctx.json({
          success: false,
          error: 'Authentication required',
          errorCode: 'AUTH_REQUIRED',
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }

      if (!allowedRoles.includes(user.role)) {
        ctx.status(403);
        ctx.json({
          success: false,
          error: 'Insufficient permissions',
          errorCode: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: allowedRoles,
            current: user.role
          },
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }

      await next();
    };
  };

  /**
   * Optional authentication - doesn't fail if no token provided
   */
  public optional = async (ctx: Context, next: Next): Promise<void> => {
    try {
      const token = this.extractToken(ctx);
      
      if (token) {
        // Verify JWT token with Supabase
        const { data: { user }, error } = await this.supabase.auth.getUser(token);

        if (!error && user) {
          // Get user profile with role information
          const { data: profile } = await this.supabase
            .from('user_profiles')
            .select(`
              *,
              users!inner(
                id,
                email,
                phone,
                role,
                is_active,
                created_at,
                last_login_at
              )
            `)
            .eq('user_id', user.id)
            .single();

          if (profile?.users && profile.users.is_active) {
            ctx.set('user', {
              id: profile.users.id,
              email: profile.users.email,
              phone: profile.users.phone,
              role: profile.users.role,
              isActive: profile.users.is_active,
              lastLoginAt: profile.users.last_login_at,
              profileId: profile.id,
              createdAt: profile.users.created_at,
              updatedAt: profile.updated_at,
              profile: {
                firstName: profile.first_name,
                lastName: profile.last_name,
                avatar: profile.avatar,
                preferences: profile.preferences
              }
            } as User);
          }
        }
      }

      await next();

    } catch (error) {
      // Don't fail for optional auth, just log and continue
      console.error('Optional authentication error:', error);
      await next();
    }
  };

  /**
   * Extract JWT token from request headers
   */
  private extractToken(ctx: Context): string | null {
    const authHeader = ctx.req.header('Authorization');
    
    if (!authHeader) {
      return null;
    }

    // Support "Bearer token" format
    if (authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Support direct token
    return authHeader;
  }
}

/**
 * Role-based access control helpers
 */
export const rbac = {
  /**
   * Admin only access
   */
  admin: () => AuthMiddleware.prototype.requireRole([UserRole.ADMIN]),

  /**
   * Admin and branch manager access
   */
  management: () => AuthMiddleware.prototype.requireRole([
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.RESTAURANT,
    UserRole.SELLER
  ]),

  /**
   * All operational roles
   */
  operational: () => AuthMiddleware.prototype.requireRole([
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.RESTAURANT,
    UserRole.SELLER,
    UserRole.COURIER,
    UserRole.BOGALTER,
    UserRole.STAFF
  ]),

  /**
   * Customer and all operational roles
   */
  authenticated: () => AuthMiddleware.prototype.requireRole([
    UserRole.ADMIN,
    UserRole.BRANCH_MANAGER,
    UserRole.RESTAURANT,
    UserRole.SELLER,
    UserRole.COURIER,
    UserRole.BOGALTER,
    UserRole.STAFF,
    UserRole.CUSTOMER
  ]),

  /**
   * Courier only
   */
  courier: () => AuthMiddleware.prototype.requireRole([UserRole.COURIER]),

  /**
   * Restaurant only
   */
  restaurant: () => AuthMiddleware.prototype.requireRole([UserRole.RESTAURANT])
};

/**
 * Rate limiting middleware
 */
export class RateLimitMiddleware {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) {}

  public handle = async (ctx: Context, next: Next): Promise<void> => {
    const clientIp = ctx.req.header('x-forwarded-for') || 
                     ctx.req.header('x-real-ip') || 
                     'unknown';

    const now = Date.now();
    const key = `${clientIp}:${ctx.req.path}`;
    const record = this.requests.get(key);

    if (!record || now > record.resetTime) {
      // Reset or create new record
      this.requests.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      });
    } else {
      // Increment counter
      record.count++;

      if (record.count > this.maxRequests) {
        ctx.status(429);
        ctx.json({
          success: false,
          error: 'Too many requests',
          errorCode: 'RATE_LIMIT_EXCEEDED',
          details: {
            limit: this.maxRequests,
            windowMs: this.windowMs,
            resetTime: record.resetTime
          },
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }
    }

    // Add rate limit headers
    ctx.header('X-RateLimit-Limit', this.maxRequests.toString());
    ctx.header('X-RateLimit-Remaining', Math.max(0, this.maxRequests - (record?.count || 0)).toString());
    ctx.header('X-RateLimit-Reset', record?.resetTime.toString() || '');

    await next();
  };
}
