/**
 * Production-ready error handling middleware
 * Provides comprehensive error handling and logging
 */

import type { Context, Next } from 'hono';
import { LogLevel, LogEntry, ErrorResponse } from '../types/index.js';

export class ErrorMiddleware {
  private logLevel: LogLevel;
  private enableConsoleLogging: boolean;

  constructor(logLevel: LogLevel = LogLevel.ERROR, enableConsoleLogging: boolean = true) {
    this.logLevel = logLevel;
    this.enableConsoleLogging = enableConsoleLogging;
  }

  /**
   * Global error handler middleware
   */
  public handle = async (ctx: Context, next: Next): Promise<void> => {
    try {
      await next();
    } catch (error) {
      await this.handleError(error, ctx);
    }
  };

  /**
   * Handle 404 Not Found errors
   */
  public notFound = async (ctx: Context): Promise<void> => {
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'Endpoint not found',
      errorCode: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
      requestId: ctx.get('requestId'),
      details: {
        path: ctx.req.path,
        method: ctx.req.method,
        availableEndpoints: this.getAvailableEndpoints(ctx.req.path)
      }
    };

    ctx.status(404 as any);
    ctx.json(errorResponse);

    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message: 'Endpoint not found',
      requestId: ctx.get('requestId'),
      method: ctx.req.method,
      path: ctx.req.path,
      ip: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip'),
      userAgent: ctx.req.header('user-agent'),
      statusCode: 404
    });
  };

  /**
   * Handle individual errors
   */
  private async handleError(error: any, ctx: Context): Promise<void> {
    const statusCode = this.getStatusCode(error);
    const errorCode = this.getErrorCode(error);
    const message = this.getErrorMessage(error);

    const errorResponse: ErrorResponse = {
      success: false,
      error: message,
      errorCode,
      timestamp: new Date().toISOString(),
      requestId: ctx.get('requestId'),
      details: error.details || undefined
    };

    // Include stack trace in development
    if (this.logLevel === LogLevel.DEBUG && error.stack) {
      errorResponse.details = {
        ...errorResponse.details,
        stack: error.stack
      };
    }

    ctx.status(statusCode as any);
    ctx.json(errorResponse);

    // Log the error
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message: `${errorCode}: ${message}`,
      requestId: ctx.get('requestId'),
      userId: ctx.get('user')?.id,
      ip: ctx.req.header('x-forwarded-for') || ctx.req.header('x-real-ip'),
      userAgent: ctx.req.header('user-agent'),
      method: ctx.req.method,
      path: ctx.req.path,
      statusCode,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      metadata: error.metadata
    });
  }

  /**
   * Get appropriate HTTP status code for error
   */
  private getStatusCode(error: any): number {
    if (error.statusCode) {
      return error.statusCode;
    }

    if (error.name === 'ValidationError') {
      return 400;
    }

    if (error.name === 'UnauthorizedError') {
      return 401;
    }

    if (error.name === 'ForbiddenError') {
      return 403;
    }

    if (error.name === 'NotFoundError') {
      return 404;
    }

    if (error.name === 'ConflictError') {
      return 409;
    }

    if (error.name === 'RateLimitError') {
      return 429;
    }

    // Default to 500 for unhandled errors
    return 500;
  }

  /**
   * Get error code from error
   */
  private getErrorCode(error: any): string {
    if (error.errorCode) {
      return error.errorCode;
    }

    // Map common error names to codes
    const errorCodes: Record<string, string> = {
      ValidationError: 'VALIDATION_ERROR',
      UnauthorizedError: 'UNAUTHORIZED',
      ForbiddenError: 'FORBIDDEN',
      NotFoundError: 'NOT_FOUND',
      ConflictError: 'CONFLICT',
      RateLimitError: 'RATE_LIMIT_EXCEEDED',
      DatabaseError: 'DATABASE_ERROR',
      ExternalServiceError: 'EXTERNAL_SERVICE_ERROR'
    };

    return errorCodes[error.name] || 'INTERNAL_SERVER_ERROR';
  }

  /**
   * Get user-friendly error message
   */
  private getErrorMessage(error: any): string {
    if (error.message) {
      return error.message;
    }

    // Default messages for common error types
    const defaultMessages: Record<string, string> = {
      ValidationError: 'Invalid input provided',
      UnauthorizedError: 'Authentication required',
      ForbiddenError: 'Access denied',
      NotFoundError: 'Resource not found',
      ConflictError: 'Resource conflict',
      RateLimitError: 'Too many requests',
      DatabaseError: 'Database operation failed',
      ExternalServiceError: 'External service unavailable'
    };

    return defaultMessages[error.name] || 'Internal server error';
  }

  /**
   * Get available endpoints for 404 responses
   */
  private getAvailableEndpoints(currentPath: string): string[] {
    const endpoints: string[] = [
      // Health endpoints
      '/health',
      '/test-deployment',

      // Public endpoints
      '/public/branches',
      '/public/categories',
      '/public/products',

      // Auth endpoints
      '/auth/sms/send',
      '/auth/sms/verify',
      '/auth/login',
      '/auth/register',
      '/auth/refresh',

      // User endpoints
      '/user/profile',
      '/user/settings',
      '/user/favorites',
      '/user/orders',

      // Order endpoints
      '/orders',
      '/orders/:id',
      '/orders/:id/status',

      // Payment endpoints
      '/payments/process',
      '/payments/verify',
      '/payments/upload-receipt',

      // Delivery endpoints
      '/delivery/available-orders',
      '/delivery/accept-order',
      '/delivery/:id/status'
    ];

    return endpoints;
  }

  /**
   * Log error with structured format
   */
  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.enableConsoleLogging) {
      const logMethod = this.getConsoleMethod(entry.level);
      logMethod(JSON.stringify(entry, null, 2));
    }

    // TODO: Send to external logging service
    // await this.sendToLogService(entry);
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex <= currentLevelIndex;
  }

  /**
   * Get appropriate console method for log level
   */
  private getConsoleMethod(level: LogLevel): (message?: any, ...optionalParams: any[]) => void {
    switch (level) {
      case LogLevel.ERROR:
        return console.error;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.DEBUG:
        return console.debug;
      default:
        return console.log;
    }
  }
}

/**
 * Custom error classes
 */
export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public details?: any;
  public metadata?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_SERVER_ERROR',
    details?: any,
    metadata?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.metadata = metadata;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded', details?: any) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, metadata?: any) {
    super(message, 500, 'DATABASE_ERROR', undefined, metadata);
    this.name = 'DatabaseError';
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string, serviceName: string, metadata?: any) {
    super(
      `${serviceName}: ${message}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      { serviceName },
      metadata
    );
    this.name = 'ExternalServiceError';
  }
}
