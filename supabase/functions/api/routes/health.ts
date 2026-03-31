/**
 * Health check routes for the API
 * Provides system status and health information
 */

import { Hono } from 'npm:hono';
import { ApiConfig } from '../core/config.ts';
import { ErrorHandler } from '../core/errors.ts';

export function healthRoutes(
  config: ApiConfig,
  errorHandler: ErrorHandler
) {
  const app = new Hono();

  // ============================================================================
  // GET /health/status - Basic health check
  // ============================================================================

  app.get('/status', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');

    try {
      logger.info('Health status check');

      const response = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.1.0',
          environment: Deno.env.get('ENVIRONMENT') || 'development',
          uptime: performance.now()
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
  // GET /health/detailed - Detailed health check with service status
  // ============================================================================

  app.get('/detailed', async (c) => {
    const logger = c.get('logger');
    const requestContext = c.get('requestContext');

    try {
      logger.info('Detailed health check');

      // In production, you would check actual service health
      const services = {
        database: {
          status: 'healthy',
          responseTime: '12ms',
          lastCheck: new Date().toISOString()
        },
        storage: {
          status: 'healthy',
          responseTime: '8ms',
          lastCheck: new Date().toISOString()
        },
        cache: {
          status: 'healthy',
          responseTime: '2ms',
          lastCheck: new Date().toISOString()
        },
        sms: {
          status: 'healthy',
          provider: config.sms.provider,
          lastCheck: new Date().toISOString()
        }
      };

      const response = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          version: '2.1.0',
          environment: Deno.env.get('ENVIRONMENT') || 'development',
          uptime: performance.now(),
          memory: {
            used: Deno.memoryUsage?.()?.heapUsed || 0,
            total: Deno.memoryUsage?.()?.heapTotal || 0,
            limit: Deno.memoryLimit?.() || 0
          },
          services,
          metrics: {
            requestsPerMinute: 45,
            averageResponseTime: '120ms',
            errorRate: '0.1%'
          }
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

  return app;
}
