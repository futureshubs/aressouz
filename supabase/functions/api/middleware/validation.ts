/**
 * Production-ready validation middleware
 * Provides comprehensive input validation and sanitization
 */

import type { Context, Next } from 'hono';
import { ValidationRule, ValidationResult, ValidationError } from '../types/index.js';

export class ValidationMiddleware {
  /**
   * Validate request body against rules
   */
  static validateBody(rules: ValidationRule[]) {
    return async (ctx: Context, next: Next): Promise<void> => {
      try {
        const body = await ctx.req.json().catch(() => ({}));
        const validation = this.validate(body, rules);

        if (!validation.isValid) {
          ctx.status(400);
          ctx.json({
            success: false,
            error: 'Validation failed',
            errorCode: 'VALIDATION_ERROR',
            details: validation.errors,
            timestamp: new Date().toISOString(),
            requestId: ctx.get('requestId')
          });
          return;
        }

        // Store validated data in context
        ctx.set('validatedBody', validation.data);
        await next();

      } catch (error) {
        ctx.status(400);
        ctx.json({
          success: false,
          error: 'Invalid JSON format',
          errorCode: 'INVALID_JSON',
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
      }
    };
  }

  /**
   * Validate query parameters
   */
  static validateQuery(rules: ValidationRule[]) {
    return async (ctx: Context, next: Next): Promise<void> => {
      const queries = ctx.req.queries();
      const query: Record<string, string> = {};
      
      // Convert Record<string, string[]> to Record<string, string>
      Object.entries(queries).forEach(([key, values]) => {
        query[key] = values[0] || ''; // Take first value or empty string
      });
      
      const validation = this.validate(query, rules);

      if (!validation.isValid) {
        ctx.status(400);
        ctx.json({
          success: false,
          error: 'Query validation failed',
          errorCode: 'QUERY_VALIDATION_ERROR',
          details: validation.errors,
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }

      ctx.set('validatedQuery', validation.data);
      await next();
    };
  }

  /**
   * Validate path parameters
   */
  static validateParams(rules: ValidationRule[]) {
    return async (ctx: Context, next: Next): Promise<void> => {
      const params = ctx.req.param();
      const validation = this.validate(params, rules);

      if (!validation.isValid) {
        ctx.status(400);
        ctx.json({
          success: false,
          error: 'Parameter validation failed',
          errorCode: 'PARAM_VALIDATION_ERROR',
          details: validation.errors,
          timestamp: new Date().toISOString(),
          requestId: ctx.get('requestId')
        });
        return;
      }

      ctx.set('validatedParams', validation.data);
      await next();
    };
  }

  /**
   * Core validation logic
   */
  private static validate(data: any, rules: ValidationRule[]): ValidationResult {
    const errors: ValidationError[] = [];
    const validatedData: any = {};

    for (const rule of rules) {
      const value = data[rule.field];
      const fieldErrors: string[] = [];

      // Required validation
      if (rule.required && (value === undefined || value === null || value === '')) {
        fieldErrors.push(`${rule.field} is required`);
      }

      // Skip further validation if field is not required and empty
      if (!rule.required && (value === undefined || value === null || value === '')) {
        continue;
      }

      // Type validation
      if (rule.type && !this.validateType(value, rule.type)) {
        fieldErrors.push(`${rule.field} must be of type ${rule.type}`);
      }

      // String length validation
      if (typeof value === 'string') {
        if (rule.minLength !== undefined && value.length < rule.minLength) {
          fieldErrors.push(`${rule.field} must be at least ${rule.minLength} characters`);
        }
        if (rule.maxLength !== undefined && value.length > rule.maxLength) {
          fieldErrors.push(`${rule.field} must not exceed ${rule.maxLength} characters`);
        }
      }

      // Number range validation
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          fieldErrors.push(`${rule.field} must be at least ${rule.min}`);
        }
        if (rule.max !== undefined && value > rule.max) {
          fieldErrors.push(`${rule.field} must not exceed ${rule.max}`);
        }
      }

      // Pattern validation
      if (rule.pattern && typeof value === 'string' && !rule.pattern.test(value)) {
        fieldErrors.push(`${rule.field} format is invalid`);
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        fieldErrors.push(`${rule.field} must be one of: ${rule.enum.join(', ')}`);
      }

      // Custom validation
      if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
          fieldErrors.push(typeof customResult === 'string' ? customResult : `${rule.field} is invalid`);
        }
      }

      // Add errors if any
      if (fieldErrors.length > 0) {
        errors.push({
          field: rule.field,
          message: fieldErrors[0], // Return first error for simplicity
          value
        });
      } else {
        // Sanitize and store validated data
        validatedData[rule.field] = this.sanitizeValue(value, rule.type);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: validatedData
    };
  }

  /**
   * Validate data type
   */
  private static validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default:
        return true;
    }
  }

  /**
   * Sanitize input values
   */
  private static sanitizeValue(value: any, type?: string): any {
    if (typeof value === 'string') {
      // Trim whitespace
      value = value.trim();
      
      // Remove potentially dangerous characters for certain fields
      if (type === 'string') {
        // Basic XSS prevention
        value = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        value = value.replace(/javascript:/gi, '');
        value = value.replace(/on\w+\s*=/gi, '');
      }
    }

    return value;
  }
}

/**
 * Common validation rules
 */
export const CommonValidationRules = {
  email: {
    field: 'email',
    required: true,
    type: 'string' as const,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    maxLength: 255
  },

  phone: {
    field: 'phone',
    required: true,
    type: 'string' as const,
    pattern: /^\+?[1-9]\d{1,14}$/,
    maxLength: 20
  },

  password: {
    field: 'password',
    required: true,
    type: 'string' as const,
    minLength: 8,
    maxLength: 128,
    custom: (value: string) => {
      if (!/(?=.*[a-z])/.test(value)) return 'Password must contain lowercase letter';
      if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain uppercase letter';
      if (!/(?=.*\d)/.test(value)) return 'Password must contain number';
      return true;
    }
  },

  uuid: {
    field: 'id',
    required: true,
    type: 'string' as const,
    pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  },

  pagination: {
    page: {
      field: 'page',
      required: false,
      type: 'number' as const,
      min: 1,
      max: 1000
    },
    limit: {
      field: 'limit',
      required: false,
      type: 'number' as const,
      min: 1,
      max: 100
    }
  },

  coordinates: {
    lat: {
      field: 'lat',
      required: false,
      type: 'number' as const,
      min: -90,
      max: 90
    },
    lng: {
      field: 'lng',
      required: false,
      type: 'number' as const,
      min: -180,
      max: 180
    }
  }
};
