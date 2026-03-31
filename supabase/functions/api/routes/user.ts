/**
 * User management routes for the API
 * Handles user profile, preferences, and account management
 */

import { Hono } from 'npm:hono';
import { ApiConfig } from '../core/config.ts';
import { AuthenticationService, AuthenticationMiddleware, AuthorizationMiddleware } from '../core/auth.ts';
import { ErrorHandler } from '../core/errors.ts';
import { Validator, CommonSchemas } from '../core/validation.ts';
import { User } from '../core/types.ts';

export function userRoutes(
  config: ApiConfig,
  authService: AuthenticationService,
  authMiddleware: AuthenticationMiddleware,
  authorizationMiddleware: AuthorizationMiddleware,
  errorHandler: ErrorHandler
) {
  const app = new Hono();

  // All user routes require authentication
  app.use('*', async (c, next) => {
    const requestContext = c.get('requestContext');
    try {
      const user = await authMiddleware.authenticate(requestContext);
      c.set('user', user);
      await next();
    } catch (error) {
      const response = errorHandler.handleError(error as Error, requestContext);
      return c.json(response, 401);
    }
  });

  // ============================================================================
  // GET /user/profile - Get user profile
  // ============================================================================

  app.get('/profile', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');
    const user = c.get('user');

    try {
      logger.info('User profile request', { userId: user.id });

      const response = {
        success: true,
        data: {
          id: user.id,
          phone: user.phone,
          firstName: user.firstName,
          lastName: user.lastName,
          birthDate: user.birthDate,
          gender: user.gender,
          avatar: user.avatar,
          role: user.role,
          preferences: user.preferences,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId'),
          version: '1.0.0'
        }
      };

      return c.json(response, 200);

    } catch (error) {
      const response = errorHandler.handleError(error as Error, requestContext);
      return c.json(response, 500);
    }
  });

  // ============================================================================
  // PUT /user/profile - Update user profile
  // ============================================================================

  app.put('/profile', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');
    const user = c.get('user');

    try {
      const body = await c.req.json();
      
      // Validate update data
      const updateSchema = {
        firstName: { ...CommonSchemas.userRegistration.firstName, required: false },
        lastName: { ...CommonSchemas.userRegistration.lastName, required: false },
        birthDate: { ...CommonSchemas.userRegistration.birthDate, required: false },
        gender: { ...CommonSchemas.userRegistration.gender, required: false }
      };

      const validation = Validator.validate(body, updateSchema);
      
      if (!validation.isValid) {
        const error = errorHandler.handleError(
          new Error('Validation failed'),
          requestContext
        );
        error.error!.details = { validationErrors: validation.errors };
        return c.json(error, 400);
      }

      logger.info('User profile update', { userId: user.id, updates: validation.data });

      // In production, update user in database
      // For now, return mock success response
      
      const response = {
        success: true,
        data: {
          ...user,
          ...validation.data,
          updatedAt: new Date().toISOString()
        },
        message: 'Profile updated successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId'),
          version: '1.0.0'
        }
      };

      return c.json(response, 200);

    } catch (error) {
      const response = errorHandler.handleError(error as Error, requestContext);
      return c.json(response, 500);
    }
  });

  // ============================================================================
  // PUT /user/preferences - Update user preferences
  // ============================================================================

  app.put('/preferences', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');
    const user = c.get('user');

    try {
      const body = await c.req.json();
      
      // Validate preferences
      const preferencesSchema = {
        language: {
          required: false,
          type: 'string' as const,
          enum: ['uz', 'ru', 'en']
        },
        theme: {
          required: false,
          type: 'string' as const,
          enum: ['light', 'dark', 'auto']
        },
        notifications: {
          required: false,
          type: 'object' as const,
          custom: (value: any) => {
            if (typeof value !== 'object' || value === null) {
              return 'Notifications must be an object';
            }
            
            const notif = value as any;
            if (typeof notif.email !== 'boolean' || 
                typeof notif.sms !== 'boolean' || 
                typeof notif.push !== 'boolean') {
              return 'All notification fields must be boolean';
            }
            
            return true;
          }
        }
      };

      const validation = Validator.validate(body, preferencesSchema);
      
      if (!validation.isValid) {
        const error = errorHandler.handleError(
          new Error('Validation failed'),
          requestContext
        );
        error.error!.details = { validationErrors: validation.errors };
        return c.json(error, 400);
      }

      logger.info('User preferences update', { 
        userId: user.id, 
        preferences: validation.data 
      });

      // In production, update preferences in database
      // For now, return mock success response
      
      const updatedPreferences = {
        ...user.preferences,
        ...validation.data
      };

      const response = {
        success: true,
        data: updatedPreferences,
        message: 'Preferences updated successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId'),
          version: '1.0.0'
        }
      };

      return c.json(response, 200);

    } catch (error) {
      const response = errorHandler.handleError(error as Error, requestContext);
      return c.json(response, 500);
    }
  });

  // ============================================================================
  // DELETE /user/account - Delete user account
  // ============================================================================

  app.delete('/account', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');
    const user = c.get('user');

    try {
      logger.warn('User account deletion request', { userId: user.id });

      // In production, you would:
      // 1. Verify user's identity (maybe require password/SMS confirmation)
      // 2. Soft delete user data (mark as inactive)
      // 3. Schedule hard deletion after retention period
      // 4. Cancel all active subscriptions
      // 5. Notify user of deletion

      const response = {
        success: true,
        message: 'Account deletion scheduled. You have 30 days to cancel this action.',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId'),
          version: '1.0.0'
        }
      };

      logger.logAuth('account_deletion_scheduled', user.id);

      return c.json(response, 200);

    } catch (error) {
      const response = errorHandler.handleError(error as Error, requestContext);
      return c.json(response, 500);
    }
  });

  return app;
}
