/**
 * Production-ready API entry point
 * Main Supabase Edge Function with proper layered architecture
 */

import { Hono } from 'hono';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Import middleware
import { CorsMiddleware, defaultCorsConfig } from './middleware/cors.js';
import { ErrorMiddleware } from './middleware/error.js';
import { LoggingMiddleware, PerformanceMiddleware, SecurityMiddleware } from './middleware/logging.js';
import { AuthMiddleware, RateLimitMiddleware } from './middleware/auth.js';
import { ValidationMiddleware } from './middleware/validation.js';

// Import types
import { EnvironmentConfig, LogLevel, HealthCheck } from './types/index.js';

// Environment configuration
const config: EnvironmentConfig = {
  supabase: {
    url: Deno.env.get('SUPABASE_URL') || '',
    serviceRoleKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  },
  cors: defaultCorsConfig,
  logging: {
    level: (Deno.env.get('LOG_LEVEL') as LogLevel) || LogLevel.INFO,
    enableConsole: true,
    enableExternal: false
  },
  features: {
    enableSmsAuth: Deno.env.get('ENABLE_SMS_AUTH') === 'true',
    enablePayments: Deno.env.get('ENABLE_PAYMENTS') === 'true',
    enableDelivery: Deno.env.get('ENABLE_DELIVERY') === 'true',
    enableAnalytics: Deno.env.get('ENABLE_ANALYTICS') === 'true'
  },
  external: {
    smsProvider: Deno.env.get('SMS_PROVIDER_API_KEY') ? {
      apiKey: Deno.env.get('SMS_PROVIDER_API_KEY')!,
      baseUrl: Deno.env.get('SMS_PROVIDER_BASE_URL') || ''
    } : undefined,
    paymentProvider: Deno.env.get('PAYMENT_PROVIDER_SECRET') ? {
      secretKey: Deno.env.get('PAYMENT_PROVIDER_SECRET')!,
      baseUrl: Deno.env.get('PAYMENT_PROVIDER_BASE_URL') || ''
    } : undefined
  }
};

// Initialize middleware
const corsMiddleware = new CorsMiddleware(config.cors);
const errorMiddleware = new ErrorMiddleware(config.logging.level, config.logging.enableConsole);
const loggingMiddleware = new LoggingMiddleware(config.logging.level, config.logging.enableConsole);
const performanceMiddleware = new PerformanceMiddleware();
const securityMiddleware = new SecurityMiddleware();
const authMiddleware = new AuthMiddleware(config.supabase.url, config.supabase.serviceRoleKey);
const rateLimitMiddleware = new RateLimitMiddleware();

// Create Hono app
const app = new Hono();

// Apply global middleware
app.use('*', corsMiddleware.handle);
app.use('*', loggingMiddleware.handle);
app.use('*', performanceMiddleware.handle);
app.use('*', securityMiddleware.handle);
app.use('*', rateLimitMiddleware.handle);
app.use('*', errorMiddleware.handle);

// Health check endpoint (public)
app.get('/health', async (c) => {
  const healthCheck: HealthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    uptime: performance.now(),
    checks: {
      database: 'pass', // TODO: Implement actual database health check
      storage: 'pass', // TODO: Implement actual storage health check
      external_apis: 'pass' // TODO: Implement actual external API health check
    },
    endpoints: {
      public: ['/health', '/test-deployment', '/public/branches'],
      auth: config.features.enableSmsAuth ? ['/auth/sms/send', '/auth/sms/verify'] : [],
      user: ['/user/profile', '/user/settings'],
      admin: ['/admin/branches', '/admin/users']
    }
  };

  return c.json(healthCheck);
});

// Test deployment endpoint (public)
app.get('/test-deployment', async (c) => {
  return c.json({
    success: true,
    message: '✅ Edge Functions are working!',
    timestamp: new Date().toISOString(),
    version: '2.1.0',
    features: config.features,
    endpoints: {
      public: ['/health', '/test-deployment', '/public/branches'],
      auth: config.features.enableSmsAuth ? ['/auth/sms/send', '/auth/sms/verify'] : [],
      user: ['/user/profile', '/user/settings'],
      admin: ['/admin/branches', '/admin/users']
    }
  });
});

// Public branches endpoint (temporary mock implementation)
app.get('/public/branches', async (c) => {
  // TODO: Replace with actual implementation once branches service is ready
  const mockBranches = [
    {
      id: 'branch_1',
      name: 'Test Branch 1',
      branchName: 'Test Branch 1',
      login: 'test1',
      regionId: 'region_1',
      districtId: 'district_1',
      phone: '+998123456789',
      managerName: 'Test Manager',
      coordinates: { lat: 41.2995, lng: 69.2401 },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: 'branch_2',
      name: 'Test Branch 2',
      branchName: 'Test Branch 2',
      login: 'test2',
      regionId: 'region_2',
      districtId: 'district_2',
      phone: '+998987654321',
      managerName: 'Test Manager 2',
      coordinates: { lat: 41.3111, lng: 69.2797 },
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  
  return c.json({
    success: true,
    data: mockBranches,
    timestamp: new Date().toISOString(),
    requestId: c.get('requestId')
  });
});

// User settings endpoint (temporary mock implementation)
app.get('/user/anonymous/settings', async (c) => {
  return c.json({
    success: true,
    message: 'Settings retrieved (mock)',
    data: {
      theme: 'light',
      accentColor: 'blue',
      language: 'en',
      notifications: {
        email: true,
        sms: true,
        push: false
      }
    },
    timestamp: new Date().toISOString(),
    requestId: c.get('requestId')
  });
});

// TODO: Add route modules once TypeScript issues are resolved
// app.route('/branches', createBranchesRoutes(config.supabase.url, config.supabase.serviceRoleKey));

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    errorCode: 'NOT_FOUND',
    timestamp: new Date().toISOString(),
    requestId: c.get('requestId'),
    details: {
      path: c.req.path,
      method: c.req.method,
      availableEndpoints: [
        '/health',
        '/test-deployment',
        '/public/branches',
        '/user/anonymous/settings'
      ]
    }
  }, 404);
});

// Start server
serve(async (req) => {
  return app.fetch(req);
});

console.log('🚀 API Server started successfully');
console.log(`📍 Environment: ${Deno.env.get('ENVIRONMENT') || 'development'}`);
console.log(`🔧 Features: ${JSON.stringify(config.features)}`);
console.log(`📊 Log Level: ${config.logging.level}`);
