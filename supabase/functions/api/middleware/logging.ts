/**
 * Production-ready logging middleware
 * Provides structured request/response logging
 */

import type { Context, Next } from 'hono';
import { LogLevel, LogEntry } from '../types/index.js';

export class LoggingMiddleware {
  private logLevel: LogLevel;
  private enableConsoleLogging: boolean;

  constructor(logLevel: LogLevel = LogLevel.INFO, enableConsoleLogging: boolean = true) {
    this.logLevel = logLevel;
    this.enableConsoleLogging = enableConsoleLogging;
  }

  /**
   * Request logging middleware
   */
  public handle = async (ctx: Context, next: Next): Promise<void> => {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    // Store request ID in context for use in other middleware
    ctx.set('requestId', requestId);

    // Log incoming request
    this.log({
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message: 'Incoming request',
      requestId,
      method: ctx.req.method,
      path: ctx.req.path,
      ip: this.getClientIp(ctx),
      userAgent: ctx.req.header('user-agent')
    });

    await next();

    // Calculate request duration
    const duration = Date.now() - startTime;
    const statusCode = ctx.res.status;

    // Log outgoing response
    this.log({
      timestamp: new Date().toISOString(),
      level: this.getLogLevelForStatus(statusCode),
      message: 'Request completed',
      requestId,
      userId: ctx.get('user')?.id,
      method: ctx.req.method,
      path: ctx.req.path,
      statusCode,
      duration,
      ip: this.getClientIp(ctx),
      userAgent: ctx.req.header('user-agent')
    });
  };

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(ctx: Context): string {
    return ctx.req.header('x-forwarded-for') || 
           ctx.req.header('x-real-ip') || 
           ctx.req.header('cf-connecting-ip') || 
           'unknown';
  }

  /**
   * Get appropriate log level based on HTTP status code
   */
  private getLogLevelForStatus(statusCode: number): LogLevel {
    if (statusCode >= 500) {
      return LogLevel.ERROR;
    }
    if (statusCode >= 400) {
      return LogLevel.WARN;
    }
    if (statusCode >= 300) {
      return LogLevel.INFO;
    }
    return LogLevel.INFO;
  }

  /**
   * Log entry with structured format
   */
  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    if (this.enableConsoleLogging) {
      const logMethod = this.getConsoleMethod(entry.level);
      const logMessage = this.formatLogMessage(entry);
      logMethod(logMessage);
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

  /**
   * Format log message for console output
   */
  private formatLogMessage(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.requestId ? `[${entry.requestId}]` : '',
      entry.method && entry.path ? `${entry.method} ${entry.path}` : '',
      entry.statusCode ? `${entry.statusCode}` : '',
      entry.duration ? `${entry.duration}ms` : '',
      entry.message
    ].filter(Boolean);

    return parts.join(' ');
  }
}

/**
 * Performance monitoring middleware
 */
export class PerformanceMiddleware {
  private slowRequestThreshold: number; // in milliseconds

  constructor(slowRequestThreshold: number = 1000) {
    this.slowRequestThreshold = slowRequestThreshold;
  }

  /**
   * Monitor request performance
   */
  public handle = async (ctx: Context, next: Next): Promise<void> => {
    const startTime = Date.now();
    const requestId = ctx.get('requestId');

    await next();

    const duration = Date.now() - startTime;

    // Log slow requests
    if (duration > this.slowRequestThreshold) {
      console.warn(`[PERFORMANCE] Slow request detected: ${ctx.req.method} ${ctx.req.path} - ${duration}ms [${requestId}]`);
      
      // TODO: Send to monitoring service
      // await this.reportSlowRequest(ctx, duration, requestId);
    }

    // Add performance headers
    ctx.header('X-Response-Time', `${duration}ms`);
  };
}

/**
 * Security monitoring middleware
 */
export class SecurityMiddleware {
  /**
   * Monitor for suspicious activity
   */
  public handle = async (ctx: Context, next: Next): Promise<void> => {
    const requestId = ctx.get('requestId');
    const clientIp = this.getClientIp(ctx);
    const userAgent = ctx.req.header('user-agent') || '';

    // Check for suspicious patterns
    const suspicious = this.detectSuspiciousActivity(ctx, userAgent);

    if (suspicious) {
      console.warn(`[SECURITY] Suspicious activity detected: ${suspicious} from ${clientIp} [${requestId}]`);
      
      // TODO: Send to security monitoring service
      // await this.reportSuspiciousActivity(suspicious, clientIp, requestId);
    }

    await next();
  };

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(ctx: Context, userAgent: string): string | null {
    const path = ctx.req.path;
    const method = ctx.req.method;

    // Check for common attack patterns
    const suspiciousPatterns = [
      { pattern: /\.\./, description: 'path traversal attempt' },
      { pattern: /<script|javascript:/i, description: 'XSS attempt' },
      { pattern: /union.*select/i, description: 'SQL injection attempt' },
      { pattern: /\$\{.*\}/, description: 'template injection attempt' },
      { pattern: /cmd\.exe|powershell/i, description: 'command injection attempt' }
    ];

    for (const { pattern, description } of suspiciousPatterns) {
      if (pattern.test(path) || pattern.test(userAgent)) {
        return description;
      }
    }

    // Check for unusual request methods
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
    if (!allowedMethods.includes(method)) {
      return `unusual HTTP method: ${method}`;
    }

    // Check for missing user agent (likely bot)
    if (!userAgent && method !== 'GET') {
      return 'missing user agent';
    }

    return null;
  }

  /**
   * Get client IP address from request
   */
  private getClientIp(ctx: Context): string {
    return ctx.req.header('x-forwarded-for') || 
           ctx.req.header('x-real-ip') || 
           ctx.req.header('cf-connecting-ip') || 
           'unknown';
  }
}
