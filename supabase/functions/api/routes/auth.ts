/**
 * Authentication routes for the API
 * Handles SMS authentication, user registration, and token management
 */

import { Hono } from 'npm:hono';
import { ApiConfig } from '../core/config.ts';
import { AuthenticationService, AuthenticationMiddleware } from '../core/auth.ts';
import { ErrorHandler } from '../core/errors.ts';
import { Validator, CommonSchemas } from '../core/validation.ts';
import { 
  SMSRequest, 
  SMSVerificationRequest, 
  ApiResponse, 
  AuthSession 
} from '../core/types.ts';

// ============================================================================
// SMS Service (Mock Implementation)
// ============================================================================

class MockSMSService {
  /**
   * Generates and stores SMS verification code
   */
  static async generateCode(phone: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // In production, this would:
    // 1. Store the code in database with expiry
    // 2. Send actual SMS via provider (Eskiz, etc.)
    // 3. Return success/failure status
    
    console.log(`📱 Mock SMS: Code ${code} for ${phone}`);
    
    // Simulate storing in database
    await this.storeVerificationCode(phone, code);
    
    return code;
  }

  /**
   * Stores verification code (mock implementation)
   */
  private static async storeVerificationCode(phone: string, code: string): Promise<void> {
    // In production, store in database with expiry
    console.log(`📝 Storing verification code for ${phone}: ${code}`);
  }

  /**
   * Verifies SMS code
   */
  static async verifyCode(phone: string, code: string): Promise<boolean> {
    // In production, check against database
    // For demo, accept any 6-digit code
    return /^\d{6}$/.test(code);
  }
}

// ============================================================================
// Auth Routes Factory
// ============================================================================

export function authRoutes(
  config: ApiConfig,
  authService: AuthenticationService,
  authMiddleware: AuthenticationMiddleware,
  errorHandler: ErrorHandler
) {
  const app = new Hono();

  // ============================================================================
  // POST /auth/sms/send - Send SMS verification code
  // ============================================================================

  app.post('/sms/send', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');

    try {
      // Parse and validate request body
      const body = await c.req.json();
      const validation = Validator.validate(body, CommonSchemas.smsSend);
      
      if (!validation.isValid) {
        const error = errorHandler.handleError(
          new Error('Validation failed'),
          requestContext
        );
        error.error!.details = { validationErrors: validation.errors };
        return c.json(error, 400);
      }

      const { phone, purpose = 'signin' } = validation.data! as SMSRequest;

      logger.info('SMS code send request', { phone, purpose });

      // Generate and send SMS code
      const code = await MockSMSService.generateCode(phone);

      logger.info('SMS code sent successfully', { phone, purpose });

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'SMS verification code sent',
          expiresIn: config.sms.codeExpiry,
          purpose
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
  // POST /auth/sms/signin - Sign in with SMS code
  // ============================================================================

  app.post('/sms/signin', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');

    try {
      // Parse and validate request body
      const body = await c.req.json();
      const validation = Validator.validate(body, CommonSchemas.userSignIn);
      
      if (!validation.isValid) {
        const error = errorHandler.handleError(
          new Error('Validation failed'),
          requestContext
        );
        error.error!.details = { validationErrors: validation.errors };
        return c.json(error, 400);
      }

      const { phone, code } = validation.data! as SMSVerificationRequest;

      logger.info('SMS sign-in attempt', { phone });

      // Verify SMS code
      const isValidCode = await MockSMSService.verifyCode(phone, code);
      if (!isValidCode) {
        logger.warn('Invalid SMS code provided', { phone });
        
        const error = errorHandler.handleError(
          new Error('Invalid verification code'),
          requestContext
        );
        return c.json(error, 400);
      }

      // Authenticate user
      const session = await authService.authenticateWithSms(phone, code);

      logger.logAuth('sms_signin_success', session.user.id, { phone });

      const response: ApiResponse<AuthSession> = {
        success: true,
        data: session,
        message: 'Successfully signed in',
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
  // POST /auth/sms/signup - Sign up with SMS code
  // ============================================================================

  app.post('/sms/signup', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');

    try {
      // Parse and validate request body
      const body = await c.req.json();
      const validation = Validator.validate(body, CommonSchemas.userRegistration);
      
      if (!validation.isValid) {
        const error = errorHandler.handleError(
          new Error('Validation failed'),
          requestContext
        );
        error.error!.details = { validationErrors: validation.errors };
        return c.json(error, 400);
      }

      const { phone, code, firstName, lastName, birthDate, gender } = validation.data! as SMSVerificationRequest;

      logger.info('SMS sign-up attempt', { phone, firstName, lastName });

      // Verify SMS code
      const isValidCode = await MockSMSService.verifyCode(phone, code);
      if (!isValidCode) {
        logger.warn('Invalid SMS code provided for signup', { phone });
        
        const error = errorHandler.handleError(
          new Error('Invalid verification code'),
          requestContext
        );
        return c.json(error, 400);
      }

      // Create user account
      const userData = {
        firstName,
        lastName,
        birthDate,
        gender
      };

      const session = await authService.authenticateWithSms(phone, code, userData);

      logger.logAuth('sms_signup_success', session.user.id, { 
        phone, 
        firstName, 
        lastName 
      });

      const response: ApiResponse<AuthSession> = {
        success: true,
        data: session,
        message: 'Successfully registered and signed in',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId'),
          version: '1.0.0'
        }
      };

      return c.json(response, 201);

    } catch (error) {
      const response = errorHandler.handleError(error as Error, requestContext);
      return c.json(response, 500);
    }
  });

  // ============================================================================
  // POST /auth/refresh - Refresh access token
  // ============================================================================

  app.post('/refresh', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');

    try {
      // Parse request body
      const body = await c.req.json();
      
      if (!body.refreshToken) {
        const error = errorHandler.handleError(
          new Error('Refresh token is required'),
          requestContext
        );
        return c.json(error, 400);
      }

      logger.info('Token refresh attempt');

      // Refresh tokens
      const tokens = await authService.refreshToken(body.refreshToken);

      logger.logAuth('token_refresh_success', undefined);

      const response: ApiResponse = {
        success: true,
        data: tokens,
        message: 'Tokens refreshed successfully',
        meta: {
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId'),
          version: '1.0.0'
        }
      };

      return c.json(response, 200);

    } catch (error) {
      const response = errorHandler.handleError(error as Error, requestContext);
      return c.json(response, 401);
    }
  });

  // ============================================================================
  // POST /auth/logout - Logout user
  // ============================================================================

  app.post('/logout', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');

    try {
      // Extract and validate token
      const token = authMiddleware.extractToken(requestContext);
      if (!token) {
        const error = errorHandler.handleError(
          new Error('Authentication token required'),
          requestContext
        );
        return c.json(error, 401);
      }

      logger.info('Logout attempt');

      // In production, you would:
      // 1. Add token to blacklist
      // 2. Remove refresh token from database
      // 3. Clear user sessions

      logger.logAuth('logout_success', undefined);

      const response: ApiResponse = {
        success: true,
        message: 'Successfully logged out',
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
  // GET /auth/me - Get current user info (requires authentication)
  // ============================================================================

  app.get('/me', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');

    try {
      // Authenticate user
      const user = await authMiddleware.authenticate(requestContext);

      logger.info('User profile request', { userId: user.id });

      const response: ApiResponse = {
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
      return c.json(response, 401);
    }
  });

  return app;
}
