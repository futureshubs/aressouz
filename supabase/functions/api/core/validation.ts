/**
 * Comprehensive validation system for API edge functions
 * Provides input validation, sanitization, and error handling
 */

import { ValidationSchema, ValidationRule, ValidationResult, ValidationError } from './types.ts';

export class Validator {
  /**
   * Validates data against a schema
   */
  static validate(data: any, schema: ValidationSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const validatedData: any = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const fieldErrors = this.validateField(field, value, rules);
      
      if (fieldErrors.length > 0) {
        errors.push(...fieldErrors);
      } else if (value !== undefined) {
        validatedData[field] = this.sanitizeValue(value, rules);
      } else if (rules.required) {
        errors.push({
          field,
          message: `${field} is required`,
          code: 'REQUIRED_FIELD',
          value
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      data: errors.length === 0 ? validatedData : undefined
    };
  }

  /**
   * Validates a single field against its rules
   */
  private static validateField(
    field: string,
    value: any,
    rules: ValidationRule
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Skip validation if field is not required and value is empty
    if (!rules.required && (value === undefined || value === null || value === '')) {
      return errors;
    }

    // Type validation
    if (rules.type && !this.validateType(value, rules.type)) {
      errors.push({
        field,
        message: `${field} must be of type ${rules.type}`,
        code: 'INVALID_TYPE',
        value
      });
      return errors; // Type validation takes precedence
    }

    // Required validation
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field,
        message: `${field} is required`,
        code: 'REQUIRED_FIELD',
        value
      });
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength) {
        errors.push({
          field,
          message: `${field} must be at least ${rules.minLength} characters long`,
          code: 'MIN_LENGTH',
          value
        });
      }

      if (rules.maxLength !== undefined && value.length > rules.maxLength) {
        errors.push({
          field,
          message: `${field} must not exceed ${rules.maxLength} characters`,
          code: 'MAX_LENGTH',
          value
        });
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push({
          field,
          message: `${field} format is invalid`,
          code: 'INVALID_FORMAT',
          value
        });
      }

      // Specific type validations
      if (rules.type === 'email' && !this.validateEmail(value)) {
        errors.push({
          field,
          message: `${field} must be a valid email address`,
          code: 'INVALID_EMAIL',
          value
        });
      }

      if (rules.type === 'phone' && !this.validatePhone(value)) {
        errors.push({
          field,
          message: `${field} must be a valid phone number`,
          code: 'INVALID_PHONE',
          value
        });
      }

      if (rules.type === 'url' && !this.validateUrl(value)) {
        errors.push({
          field,
          message: `${field} must be a valid URL`,
          code: 'INVALID_URL',
          value
        });
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push({
          field,
          message: `${field} must be at least ${rules.min}`,
          code: 'MIN_VALUE',
          value
        });
      }

      if (rules.max !== undefined && value > rules.max) {
        errors.push({
          field,
          message: `${field} must not exceed ${rules.max}`,
          code: 'MAX_VALUE',
          value
        });
      }
    }

    // Enum validation
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({
        field,
        message: `${field} must be one of: ${rules.enum.join(', ')}`,
        code: 'INVALID_ENUM',
        value
      });
    }

    // Custom validation
    if (rules.custom) {
      const customResult = rules.custom(value);
      if (customResult !== true) {
        errors.push({
          field,
          message: typeof customResult === 'string' ? customResult : `${field} is invalid`,
          code: 'CUSTOM_VALIDATION',
          value
        });
      }
    }

    return errors;
  }

  /**
   * Validates value type
   */
  private static validateType(value: any, type: ValidationRule['type']): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'email':
        return typeof value === 'string' && this.validateEmail(value);
      case 'phone':
        return typeof value === 'string' && this.validatePhone(value);
      case 'url':
        return typeof value === 'string' && this.validateUrl(value);
      case 'date':
        return typeof value === 'string' && !isNaN(Date.parse(value));
      default:
        return true;
    }
  }

  /**
   * Validates email format
   */
  private static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates phone number format (supports multiple formats)
   */
  private static validatePhone(phone: string): boolean {
    // Remove all non-digit characters
    const cleanPhone = phone.replace(/\D/g, '');
    
    // Check for common phone number lengths
    const validLengths = [10, 11, 12]; // US, International, etc.
    
    return validLengths.includes(cleanPhone.length) && /^\d+$/.test(cleanPhone);
  }

  /**
   * Validates URL format
   */
  private static validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitizes value based on rules
   */
  private static sanitizeValue(value: any, rules: ValidationRule): any {
    if (typeof value === 'string') {
      // Trim whitespace
      let sanitized = value.trim();
      
      // Convert to lowercase if needed
      if (rules.type === 'email') {
        sanitized = sanitized.toLowerCase();
      }
      
      return sanitized;
    }
    
    return value;
  }
}

// Common validation schemas
export const CommonSchemas = {
  // Phone number validation (Uzbekistan format: 998XXXXXXXXX)
  phone: {
    required: true,
    type: 'phone' as const,
    pattern: /^998\d{9}$/
  },

  // SMS code validation
  smsCode: {
    required: true,
    type: 'string' as const,
    pattern: /^\d{6}$/,
    minLength: 6,
    maxLength: 6
  },

  // User registration validation
  userRegistration: {
    phone: {
      required: true,
      type: 'phone' as const,
      pattern: /^998\d{9}$/
    },
    code: {
      required: true,
      type: 'string' as const,
      pattern: /^\d{6}$/,
      minLength: 6,
      maxLength: 6
    },
    firstName: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\u0400-\u04FF\s]+$/
    },
    lastName: {
      required: true,
      type: 'string' as const,
      minLength: 2,
      maxLength: 50,
      pattern: /^[a-zA-Z\u0400-\u04FF\s]+$/
    },
    birthDate: {
      required: false,
      type: 'date' as const,
      custom: (value: string) => {
        const date = new Date(value);
        const today = new Date();
        const minAge = 13;
        const maxAge = 120;
        
        const age = today.getFullYear() - date.getFullYear();
        const ageDiff = new Date(today.getFullYear(), date.getMonth(), date.getDate());
        const hasHadBirthday = ageDiff <= today;
        const actualAge = hasHadBirthday ? age : age - 1;
        
        if (actualAge < minAge || actualAge > maxAge) {
          return `Age must be between ${minAge} and ${maxAge} years`;
        }
        
        return true;
      }
    },
    gender: {
      required: false,
      type: 'string' as const,
      enum: ['male', 'female', 'other']
    }
  },

  // User sign-in validation
  userSignIn: {
    phone: {
      required: true,
      type: 'phone' as const,
      pattern: /^998\d{9}$/
    },
    code: {
      required: true,
      type: 'string' as const,
      pattern: /^\d{6}$/,
      minLength: 6,
      maxLength: 6
    }
  },

  // SMS send validation
  smsSend: {
    phone: {
      required: true,
      type: 'phone' as const,
      pattern: /^998\d{9}$/
    },
    purpose: {
      required: false,
      type: 'string' as const,
      enum: ['signin', 'signup', 'password_reset']
    }
  },

  // Pagination validation
  pagination: {
    page: {
      required: false,
      type: 'number' as const,
      min: 1,
      max: 1000
    },
    limit: {
      required: false,
      type: 'number' as const,
      min: 1,
      max: 100
    }
  },

  // ID validation
  id: {
    required: true,
    type: 'string' as const,
    minLength: 1,
    maxLength: 255
  },

  // Product search validation
  productSearch: {
    query: {
      required: false,
      type: 'string' as const,
      minLength: 1,
      maxLength: 100
    },
    category: {
      required: false,
      type: 'string' as const,
      minLength: 1,
      maxLength: 50
    },
    minPrice: {
      required: false,
      type: 'number' as const,
      min: 0
    },
    maxPrice: {
      required: false,
      type: 'number' as const,
      min: 0
    },
    sortBy: {
      required: false,
      type: 'string' as const,
      enum: ['price_asc', 'price_desc', 'created_at_asc', 'created_at_desc', 'rating_desc']
    }
  }
};

/**
 * Middleware function for request validation
 */
export function validateRequest(schema: ValidationSchema) {
  return (data: any): ValidationResult => {
    return Validator.validate(data, schema);
  };
}

/**
 * Sanitizes and validates query parameters
 */
export function validateQueryParams(params: URLSearchParams, schema: ValidationSchema): ValidationResult {
  const data: any = {};
  
  // Convert URLSearchParams to object
  for (const [key, value] of params.entries()) {
    // Handle multiple values for the same key
    if (data[key]) {
      if (Array.isArray(data[key])) {
        data[key].push(value);
      } else {
        data[key] = [data[key], value];
      }
    } else {
      data[key] = value;
    }
  }
  
  return Validator.validate(data, schema);
}

/**
 * Validates file upload
 */
export function validateFile(file: {
  name: string;
  size: number;
  type: string;
}, options: {
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
}): ValidationResult {
  const errors: ValidationError[] = [];
  
  if (options.maxSize && file.size > options.maxSize) {
    errors.push({
      field: 'file',
      message: `File size must not exceed ${options.maxSize} bytes`,
      code: 'FILE_TOO_LARGE',
      value: file.size
    });
  }
  
  if (options.allowedTypes && !options.allowedTypes.includes(file.type)) {
    errors.push({
      field: 'file',
      message: `File type ${file.type} is not allowed`,
      code: 'INVALID_FILE_TYPE',
      value: file.type
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    data: errors.length === 0 ? file : undefined
  };
}
