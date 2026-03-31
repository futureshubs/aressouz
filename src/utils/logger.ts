/**
 * Comprehensive Logging System
 * Production-ready logging with multiple levels, structured output, and error tracking
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  stack?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  remoteEndpoint?: string;
  enableStructuredOutput: boolean;
  enablePerformanceLogging: boolean;
  enableErrorTracking: boolean;
  maxLogSize: number;
  batchSize: number;
  flushInterval: number;
}

export class Logger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      enableConsole: true,
      enableRemote: false,
      enableStructuredOutput: true,
      enablePerformanceLogging: true,
      enableErrorTracking: true,
      maxLogSize: 1000,
      batchSize: 50,
      flushInterval: 5000,
      ...config,
    };

    this.sessionId = crypto.randomUUID();
    this.setupErrorHandlers();
    this.startFlushTimer();
  }

  private setupErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      // Client-side error handling
      window.addEventListener('error', (event) => {
        this.error('Unhandled JavaScript Error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled Promise Rejection', {
          reason: event.reason,
          stack: event.reason?.stack,
        });
      });
    }
  }

  private startFlushTimer(): void {
    if (this.config.enableRemote && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.level;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    tags?: string[]
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      userId: this.getCurrentUserId(),
      sessionId: this.sessionId,
      requestId: this.getCurrentRequestId(),
      tags,
      metadata: {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
      },
    };
  }

  private getCurrentUserId(): string | undefined {
    // Try to get user ID from various sources
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('user_id') || undefined;
    }
    return undefined;
  }

  private getCurrentRequestId(): string | undefined {
    // Try to get request ID from various sources
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('request_id') || undefined;
    }
    return undefined;
  }

  private log(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
      return;
    }

    // Console logging
    if (this.config.enableConsole) {
      this.logToConsole(entry);
    }

    // Buffer for remote logging
    if (this.config.enableRemote) {
      this.logBuffer.push(entry);
      
      // Flush immediately for errors
      if (entry.level >= LogLevel.ERROR) {
        this.flush();
      } else if (this.logBuffer.length >= this.config.batchSize) {
        this.flush();
      }
    }

    // Error tracking
    if (this.config.enableErrorTracking && entry.level >= LogLevel.ERROR) {
      this.trackError(entry);
    }
  }

  private logToConsole(entry: LogEntry): void {
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    
    const logMessage = `[${timestamp}] ${levelName}: ${entry.message}`;
    
    if (this.config.enableStructuredOutput) {
      const consoleMethod = this.getConsoleMethod(entry.level);
      consoleMethod(logMessage, {
        context: entry.context,
        userId: entry.userId,
        sessionId: entry.sessionId,
        requestId: entry.requestId,
        tags: entry.tags,
        metadata: entry.metadata,
      });
    } else {
      const consoleMethod = this.getConsoleMethod(entry.level);
      consoleMethod(logMessage, entry.context);
    }
  }

  private getConsoleMethod(level: LogLevel): Console['log'] {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        return console.error;
      default:
        return console.log;
    }
  }

  private async trackError(entry: LogEntry): Promise<void> {
    try {
      // Send to error tracking service (e.g., Sentry, Bugsnag)
      if (this.config.remoteEndpoint) {
        await fetch(`${this.config.remoteEndpoint}/errors`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        });
      }
    } catch (error) {
      // Don't let error tracking errors break the app
      console.error('Failed to track error:', error);
    }
  }

  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.config.enableRemote) {
      return;
    }

    const logsToSend = this.logBuffer.splice(0, this.config.batchSize);

    try {
      await fetch(`${this.config.remoteEndpoint}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsToSend,
          metadata: {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
          },
        }),
      });
    } catch (error) {
      // Re-add failed logs to buffer for retry
      this.logBuffer.unshift(...logsToSend);
      console.error('Failed to flush logs:', error);
    }
  }

  // Public logging methods
  debug(message: string, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, context, tags);
    this.log(entry);
  }

  info(message: string, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, context, tags);
    this.log(entry);
  }

  warn(message: string, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, context, tags);
    this.log(entry);
  }

  error(message: string, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, context, tags);
    this.log(entry);
  }

  fatal(message: string, context?: Record<string, any>, tags?: string[]): void {
    const entry = this.createLogEntry(LogLevel.FATAL, message, context, tags);
    this.log(entry);
  }

  // Performance logging
  startTimer(name: string): () => void {
    if (!this.config.enablePerformanceLogging) {
      return () => {};
    }

    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.debug(`Performance: ${name}`, {
        duration: `${duration.toFixed(2)}ms`,
        type: 'performance',
      }, ['performance']);
    };
  }

  // Request/Response logging
  logRequest(method: string, url: string, headers?: Record<string, string>): void {
    this.debug(`API Request: ${method} ${url}`, {
      method,
      url,
      headers: this.sanitizeHeaders(headers),
      type: 'api_request',
    }, ['api']);
  }

  logResponse(method: string, url: string, status: number, duration?: number): void {
    const level = status >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    const entry = this.createLogEntry(level, `API Response: ${method} ${url} ${status}`, {
      method,
      url,
      status,
      duration: duration ? `${duration.toFixed(2)}ms` : undefined,
      type: 'api_response',
    }, ['api']);

    this.log(entry);
  }

  // User action logging
  logUserAction(action: string, context?: Record<string, any>): void {
    this.info(`User Action: ${action}`, {
      action,
      ...context,
      type: 'user_action',
    }, ['user_action']);
  }

  // Business event logging
  logBusinessEvent(event: string, context?: Record<string, any>): void {
    this.info(`Business Event: ${event}`, {
      event,
      ...context,
      type: 'business_event',
    }, ['business']);
  }

  // Security event logging
  logSecurityEvent(event: string, context?: Record<string, any>): void {
    this.warn(`Security Event: ${event}`, {
      event,
      ...context,
      type: 'security',
    }, ['security']);
  }

  private sanitizeHeaders(headers?: Record<string, string>): Record<string, string> | undefined {
    if (!headers) return undefined;

    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // Configuration methods
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  setUserId(userId: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('user_id', userId);
    }
  }

  setRequestId(requestId: string): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('request_id', requestId);
    }
  }

  clearUserId(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('user_id');
    }
  }

  clearRequestId(): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('request_id');
    }
  }

  // Cleanup
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush(); // Final flush
  }
}

// Default logger instance
export const logger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  enableConsole: true,
  enableRemote: process.env.NODE_ENV === 'production',
  remoteEndpoint: process.env.REACT_APP_LOGGING_ENDPOINT,
  enableStructuredOutput: true,
  enablePerformanceLogging: true,
  enableErrorTracking: true,
});

// Export convenience functions
export const log = {
  debug: (message: string, context?: Record<string, any>, tags?: string[]) => 
    logger.debug(message, context, tags),
  info: (message: string, context?: Record<string, any>, tags?: string[]) => 
    logger.info(message, context, tags),
  warn: (message: string, context?: Record<string, any>, tags?: string[]) => 
    logger.warn(message, context, tags),
  error: (message: string, context?: Record<string, any>, tags?: string[]) => 
    logger.error(message, context, tags),
  fatal: (message: string, context?: Record<string, any>, tags?: string[]) => 
    logger.fatal(message, context, tags),
  startTimer: (name: string) => logger.startTimer(name),
  logRequest: (method: string, url: string, headers?: Record<string, string>) => 
    logger.logRequest(method, url, headers),
  logResponse: (method: string, url: string, status: number, duration?: number) => 
    logger.logResponse(method, url, status, duration),
  logUserAction: (action: string, context?: Record<string, any>) => 
    logger.logUserAction(action, context),
  logBusinessEvent: (event: string, context?: Record<string, any>) => 
    logger.logBusinessEvent(event, context),
  logSecurityEvent: (event: string, context?: Record<string, any>) => 
    logger.logSecurityEvent(event, context),
  setUserId: (userId: string) => logger.setUserId(userId),
  setRequestId: (requestId: string) => logger.setRequestId(requestId),
  clearUserId: () => logger.clearUserId(),
  clearRequestId: () => logger.clearRequestId(),
};

export default logger;
