/**
 * Comprehensive error handling system for API edge functions
 * Provides standardized error types, handling, and response formatting
 */

import { ApiError, ApiResponse, RequestContext } from './types.ts';
import { ApiLogger } from './logger.ts';

// ============================================================================
// Error Classes
// ============================================================================

export class ApiErrorBase extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, any>;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: string,
    statusCode: number = 500,
    details?: Record<string, any>,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

// Validation Errors (400)
export class ValidationError extends ApiErrorBase {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

export class MissingFieldError extends ValidationError {
  constructor(field: string) {
    super(`Missing required field: ${field}`, { field });
  }
}

export class InvalidFormatError extends ValidationError {
  constructor(field: string, expectedFormat: string) {
    super(`Invalid format for ${field}. Expected: ${expectedFormat}`, { 
      field, 
      expectedFormat 
    });
  }
}

// Authentication Errors (401)
export class AuthenticationError extends ApiErrorBase {
  constructor(message: string = 'Authentication required', details?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, details);
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor() {
    super('Invalid or expired token');
  }
}

export class MissingTokenError extends AuthenticationError {
  constructor() {
    super('Authentication token is required');
  }
}

// Authorization Errors (403)
export class AuthorizationError extends ApiErrorBase {
  constructor(message: string = 'Access denied', details?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, details);
  }
}

export class InsufficientPermissionsError extends AuthorizationError {
  constructor(resource: string, action: string) {
    super(`Insufficient permissions to ${action} ${resource}`, { resource, action });
  }
}

// Not Found Errors (404)
export class NotFoundError extends ApiErrorBase {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 'NOT_FOUND', 404, { resource, identifier });
  }
}

// Conflict Errors (409)
export class ConflictError extends ApiErrorBase {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONFLICT_ERROR', 409, details);
  }
}

export class DuplicateResourceError extends ConflictError {
  constructor(resource: string, field: string, value: any) {
    super(`${resource} with ${field} '${value}' already exists`, { 
      resource, 
      field, 
      value 
    });
  }
}

// Rate Limit Errors (429)
export class RateLimitError extends ApiErrorBase {
  constructor(retryAfter?: number) {
    super('Too many requests', 'RATE_LIMIT_ERROR', 429, { retryAfter });
  }
}

// Server Errors (500)
export class ServerError extends ApiErrorBase {
  constructor(message: string = 'Internal server error', details?: Record<string, any>) {
    super(message, 'SERVER_ERROR', 500, details, false);
  }
}

export class DatabaseError extends ServerError {
  constructor(message: string, details?: Record<string, any>) {
    super(`Database error: ${message}`, details);
  }
}

export class ExternalServiceError extends ServerError {
  constructor(service: string, message: string, details?: Record<string, any>) {
    super(`External service error (${service}): ${message}`, { service, ...details });
  }
}

// ============================================================================
// Error Handler
// ============================================================================

export class ErrorHandler {
  private logger: ApiLogger;
  private isDevelopment: boolean;

  constructor(logger: ApiLogger, isDevelopment: boolean = false) {
    this.logger = logger;
    this.isDevelopment = isDevelopment;
  }

  /**
   * Handles errors and returns appropriate API response
   */
  handleError(error: Error, context?: RequestContext): ApiResponse {
    // Log the error
    this.logError(error, context);

    // Convert to API error if it's not already
    const apiError = this.convertToApiError(error);

    // Create error response
    return this.createErrorResponse(apiError);
  }

  /**
   * Logs error with context information
   */
  private logError(error: Error, context?: RequestContext): void {
    const logMeta: any = {
      errorName: error.name,
      errorCode: error instanceof ApiErrorBase ? error.code : 'UNKNOWN_ERROR',
      statusCode: error instanceof ApiErrorBase ? error.statusCode : 500,
      isOperational: error instanceof ApiErrorBase ? error.isOperational : false
    };

    if (context) {
      logMeta.request = {
        method: context.method,
        path: context.path,
        url: context.url,
        userAgent: context.userAgent,
        ip: context.ip
      };
    }

    if (error instanceof ApiErrorBase && error.details) {
      logMeta.errorDetails = error.details;
    }

    // Use appropriate log level based on error type
    if (error instanceof ApiErrorBase) {
      if (error.statusCode >= 500) {
        this.logger.error(error.message, error, logMeta);
      } else if (error.statusCode >= 400) {
        this.logger.warn(error.message, logMeta);
      } else {
        this.logger.info(error.message, logMeta);
      }
    } else {
      this.logger.error('Unhandled error', error, logMeta);
    }
  }

  /**
   * Converts any error to ApiErrorBase
   */
  private convertToApiError(error: Error): ApiErrorBase {
    if (error instanceof ApiErrorBase) {
      return error;
    }

    // Handle common error types
    if (error.name === 'TypeError') {
      return new ValidationError(`Invalid data type: ${error.message}`);
    }

    if (error.name === 'ReferenceError') {
      return new ServerError(`Reference error: ${error.message}`);
    }

    if (error.name === 'SyntaxError') {
      return new ValidationError(`Invalid syntax: ${error.message}`);
    }

    // Default to server error for unknown errors
    return new ServerError(
      this.isDevelopment ? error.message : 'Internal server error',
      { originalError: error.name }
    );
  }

  /**
   * Creates standardized error response
   */
  private createErrorResponse(error: ApiErrorBase): ApiResponse {
    const response: ApiResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message
      }
    };

    // Include details in development or for operational errors
    if ((this.isDevelopment || error.isOperational) && error.details) {
      response.error!.details = error.details;
    }

    // Include stack trace in development
    if (this.isDevelopment && error.stack) {
      response.error!.stack = error.stack;
    }

    return response;
  }

  /**
   * Creates success response
   */
  createSuccessResponse<T>(data?: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Creates paginated response
   */
  createPaginatedResponse<T>(
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    },
    message?: string
  ): ApiResponse<T[]> {
    return {
      success: true,
      data,
      message,
      meta: {
        pagination,
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(),
        version: '1.0.0'
      }
    };
  }

  /**
   * Generates a request ID for error tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Wraps async functions to handle errors automatically
   */
  static wrapAsync<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    errorHandler: ErrorHandler,
    context?: RequestContext
  ) {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        throw errorHandler.handleError(error as Error, context);
      }
    };
  }
}

// ============================================================================
// Error Middleware
// ============================================================================

/**
 * Creates error handling middleware
 */
export function createErrorHandlerMiddleware(
  logger: ApiLogger,
  isDevelopment: boolean = false
) {
  const errorHandler = new ErrorHandler(logger, isDevelopment);

  return (error: Error, context?: RequestContext): ApiResponse => {
    return errorHandler.handleError(error, context);
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Checks if an error is operational (recoverable)
 */
export function isOperationalError(error: Error): boolean {
  return error instanceof ApiErrorBase && error.isOperational;
}

/**
 * Creates a validation error from validation results
 */
export function createValidationError(errors: Array<{
  field: string;
  message: string;
  code: string;
  value?: any;
}>): ValidationError {
  return new ValidationError('Validation failed', {
    validationErrors: errors
  });
}

/**
 * Handles database errors and converts them to appropriate API errors
 */
export function handleDatabaseError(error: any): ApiErrorBase {
  // PostgreSQL error codes
  switch (error.code) {
    case '23505': // Unique violation
      return new DuplicateResourceError(
        'resource',
        error.constraint || 'unknown',
        error.detail || 'unknown'
      );
    case '23503': // Foreign key violation
      return new ValidationError('Referenced resource does not exist');
    case '23502': // Not null violation
      return new MissingFieldError(error.column || 'unknown');
    case '22001': // String too long
      return new InvalidFormatError(
        error.column || 'field',
        'string too long'
      );
    case '08006': // Connection failure
    case '08001': // Connection does not exist
      return new DatabaseError('Database connection failed');
    case '57014': // Query canceled
      return new DatabaseError('Database query timeout');
    default:
      return new DatabaseError(error.message || 'Unknown database error');
  }
}

/**
 * Handles external service errors
 */
export function handleExternalServiceError(
  service: string,
  error: any
): ExternalServiceError {
  if (error.response) {
    // HTTP error response
    const status = error.response.status;
    const message = error.response.data?.message || error.message;
    
    return new ExternalServiceError(
      service,
      `HTTP ${status}: ${message}`,
      {
        status,
        url: error.config?.url,
        method: error.config?.method
      }
    );
  }

  if (error.request) {
    // Network error
    return new ExternalServiceError(
      service,
      'Network error - service unreachable',
      { url: error.config?.url }
    );
  }

  // Other errors
  return new ExternalServiceError(service, error.message);
}
