/**
 * Core configuration for the API edge functions
 * Provides centralized configuration management with validation
 */

// Deno types declaration
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

export interface ApiConfig {
  supabase: {
    url: string;
    serviceRoleKey: string;
    anonKey: string;
  };
  cors: {
    origins: string[];
    allowedHeaders: string[];
    allowedMethods: string[];
    credentials: boolean;
    maxAge: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };
  security: {
    jwtSecret: string;
    tokenExpiry: number;
    refreshTokenExpiry: number;
    bcryptRounds: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableRequestBody: boolean;
    enableSensitiveData: boolean;
  };
  sms: {
    provider: 'eskiz' | 'mock';
    apiKey?: string;
    baseUrl?: string;
    codeExpiry: number;
    maxAttempts: number;
  };
}

/**
 * Validates required environment variables
 * @throws {Error} If required environment variables are missing
 */
export function validateEnvironment(): void {
  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY',
    'JWT_SECRET'
  ];

  const missing = required.filter(key => !Deno.env.get(key));
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Creates and returns validated API configuration
 * @returns {ApiConfig} Validated configuration object
 */
export function createConfig(): ApiConfig {
  validateEnvironment();

  const config: ApiConfig = {
    supabase: {
      url: Deno.env.get('SUPABASE_URL')!,
      serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      anonKey: Deno.env.get('SUPABASE_ANON_KEY')!
    },
    cors: {
      origins: Deno.env.get('CORS_ORIGINS')?.split(',') || ['*'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Access-Token',
        'x-access-token',
        'X-Seller-Token',
        'x-seller-token',
        'X-Client-Info',
        'apikey'
      ],
      allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      credentials: false,
      maxAge: parseInt(Deno.env.get('CORS_MAX_AGE') || '600')
    },
    rateLimit: {
      windowMs: parseInt(Deno.env.get('RATE_LIMIT_WINDOW_MS') || '900000'), // 15 minutes
      maxRequests: parseInt(Deno.env.get('RATE_LIMIT_MAX_REQUESTS') || '100'),
      skipSuccessfulRequests: Deno.env.get('RATE_LIMIT_SKIP_SUCCESS') === 'true'
    },
    security: {
      jwtSecret: Deno.env.get('JWT_SECRET')!,
      tokenExpiry: parseInt(Deno.env.get('JWT_EXPIRY') || '3600'), // 1 hour
      refreshTokenExpiry: parseInt(Deno.env.get('REFRESH_TOKEN_EXPIRY') || '604800'), // 7 days
      bcryptRounds: parseInt(Deno.env.get('BCRYPT_ROUNDS') || '12')
    },
    logging: {
      level: (Deno.env.get('LOG_LEVEL') as ApiConfig['logging']['level']) || 'info',
      enableRequestBody: Deno.env.get('LOG_REQUEST_BODY') === 'true',
      enableSensitiveData: Deno.env.get('LOG_SENSITIVE_DATA') === 'true'
    },
    sms: {
      provider: (Deno.env.get('SMS_PROVIDER') as ApiConfig['sms']['provider']) || 'mock',
      apiKey: Deno.env.get('ESKIZ_API_KEY'),
      baseUrl: Deno.env.get('ESKIZ_BASE_URL'),
      codeExpiry: parseInt(Deno.env.get('SMS_CODE_EXPIRY') || '300'), // 5 minutes
      maxAttempts: parseInt(Deno.env.get('SMS_MAX_ATTEMPTS') || '3')
    }
  };

  // Validate SMS provider configuration
  if (config.sms.provider === 'eskiz' && (!config.sms.apiKey || !config.sms.baseUrl)) {
    throw new Error('SMS provider "eskiz" requires ESKIZ_API_KEY and ESKIZ_BASE_URL');
  }

  return config;
}

/**
 * Default configuration for development/testing
 */
export const defaultConfig: Partial<ApiConfig> = {
  cors: {
    origins: ['*'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Access-Token',
      'x-access-token',
      'X-Seller-Token',
      'x-seller-token',
      'X-Client-Info',
      'apikey'
    ],
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: false,
    maxAge: 600
  },
  rateLimit: {
    windowMs: 900000,
    maxRequests: 100,
    skipSuccessfulRequests: false
  },
  security: {
    jwtSecret: 'default-jwt-secret-change-in-production',
    tokenExpiry: 3600,
    refreshTokenExpiry: 604800,
    bcryptRounds: 12
  },
  logging: {
    level: 'info',
    enableRequestBody: false,
    enableSensitiveData: false
  },
  sms: {
    provider: 'mock',
    codeExpiry: 300,
    maxAttempts: 3
  }
};
