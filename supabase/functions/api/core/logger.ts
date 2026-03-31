/**
 * Production-ready logging system for API edge functions
 * Provides structured logging with configurable levels and output formats
 */

import { Logger, LogEntry, RequestContext } from './types.ts';
import { ApiConfig } from './config.ts';

export class ApiLogger implements Logger {
  private config: ApiConfig['logging'];
  private requestId: string;

  constructor(config: ApiConfig['logging'], requestId: string) {
    this.config = config;
    this.requestId = requestId;
  }

  /**
   * Creates a structured log entry
   */
  private createLogEntry(
    level: LogEntry['level'],
    message: string,
    meta?: any,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: this.requestId,
      meta: this.sanitizeMeta(meta)
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack || ''
      };
    }

    return entry;
  }

  /**
   * Sanitizes metadata to remove sensitive information
   */
  private sanitizeMeta(meta?: any): any {
    if (!meta || !this.config.enableSensitiveData) {
      return undefined;
    }

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
      'apikey',
      'access_token',
      'refresh_token'
    ];

    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    return sanitize(meta);
  }

  /**
   * Outputs log entry to console with appropriate formatting
   */
  private output(entry: LogEntry): void {
    const shouldLog = this.shouldLog(entry.level);
    if (!shouldLog) return;

    const logMessage = this.formatLogMessage(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(logMessage);
        break;
      case 'info':
        console.info(logMessage);
        break;
      case 'warn':
        console.warn(logMessage);
        break;
      case 'error':
        console.error(logMessage);
        break;
    }
  }

  /**
   * Determines if a log level should be output based on configuration
   */
  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.config.level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Formats log message for console output
   */
  private formatLogMessage(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      `[${entry.requestId}]`,
      entry.message
    ];

    if (entry.userId) {
      parts.splice(-1, 0, `[User:${entry.userId}]`);
    }

    let message = parts.join(' ');

    if (entry.meta) {
      message += `\n  Meta: ${JSON.stringify(entry.meta, null, 2)}`;
    }

    if (entry.error) {
      message += `\n  Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack) {
        message += `\n  Stack: ${entry.error.stack}`;
      }
    }

    return message;
  }

  debug(message: string, meta?: any): void {
    const entry = this.createLogEntry('debug', message, meta);
    this.output(entry);
  }

  info(message: string, meta?: any): void {
    const entry = this.createLogEntry('info', message, meta);
    this.output(entry);
  }

  warn(message: string, meta?: any): void {
    const entry = this.createLogEntry('warn', message, meta);
    this.output(entry);
  }

  error(message: string, error?: Error, meta?: any): void {
    const entry = this.createLogEntry('error', message, meta, error);
    this.output(entry);
  }

  /**
   * Logs HTTP request information
   */
  logRequest(context: RequestContext, body?: any): void {
    const requestMeta: any = {
      method: context.method,
      path: context.path,
      url: context.url,
      userAgent: context.userAgent,
      ip: context.ip
    };

    if (this.config.enableRequestBody && body) {
      requestMeta.body = body;
    }

    this.info(`Incoming ${context.method} request to ${context.path}`, requestMeta);
  }

  /**
   * Logs HTTP response information
   */
  logResponse(
    context: RequestContext,
    statusCode: number,
    responseTime: number,
    responseSize?: number
  ): void {
    this.info(
      `Response ${statusCode} for ${context.method} ${context.path}`,
      {
        statusCode,
        responseTime: `${responseTime}ms`,
        responseSize: responseSize ? `${responseSize} bytes` : undefined
      }
    );
  }

  /**
   * Logs authentication events
   */
  logAuth(event: string, userId?: string, meta?: any): void {
    const logEntry = this.createLogEntry('info', `Auth: ${event}`, {
      userId,
      ...meta
    });

    logEntry.userId = userId;
    this.output(logEntry);
  }

  /**
   * Logs security events
   */
  logSecurity(event: string, severity: 'low' | 'medium' | 'high', meta?: any): void {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    const logEntry = this.createLogEntry(level, `Security: ${event}`, {
      severity,
      ...meta
    });

    this.output(logEntry);
  }

  /**
   * Logs performance metrics
   */
  logPerformance(operation: string, duration: number, meta?: any): void {
    this.info(
      `Performance: ${operation} completed in ${duration}ms`,
      {
        operation,
        duration,
        ...meta
      }
    );
  }
}

/**
 * Creates a new logger instance for a request
 */
export function createLogger(
  config: ApiConfig['logging'],
  requestId: string
): ApiLogger {
  return new ApiLogger(config, requestId);
}

/**
 * Generates a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extracts request information for logging
 */
export function extractRequestContext(req: {
  method: string;
  url: string;
  headers: Record<string, string>;
}): RequestContext {
  const url = new URL(req.url);
  
  return {
    id: generateRequestId(),
    method: req.method,
    path: url.pathname,
    url: req.url,
    headers: req.headers,
    userAgent: req.headers['user-agent'] || req.headers['User-Agent'],
    ip: req.headers['x-forwarded-for'] || 
        req.headers['x-real-ip'] || 
        req.headers['X-Forwarded-For'] || 
        req.headers['X-Real-IP'] ||
        'unknown',
    timestamp: new Date().toISOString()
  };
}
