/**
 * Performance Monitoring and Analytics System
 * Production-ready analytics with performance tracking, user behavior, and business metrics
 */

import { log } from './logger';

export interface AnalyticsConfig {
  enablePerformanceMonitoring: boolean;
  enableUserTracking: boolean;
  enableBusinessTracking: boolean;
  enableErrorTracking: boolean;
  enableHeatmap: boolean;
  enableSessionRecording: boolean;
  trackingEndpoint?: string;
  sampleRate: number;
  debugMode: boolean;
}

export interface PerformanceMetrics {
  pageLoad: number;
  domContentLoaded: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  firstInputDelay: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
}

export interface UserEvent {
  type: 'click' | 'scroll' | 'hover' | 'focus' | 'blur' | 'form_submit' | 'navigation';
  element: string;
  element_id?: string;
  element_class?: string;
  text?: string;
  href?: string;
  timestamp: number;
  coordinates?: { x: number; y: number };
  metadata?: Record<string, any>;
}

export interface BusinessEvent {
  event: string;
  category: string;
  action?: string;
  label?: string;
  value?: number;
  currency?: string;
  properties?: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId: string;
}

export interface PageView {
  url: string;
  title: string;
  referrer: string;
  timestamp: number;
  userId?: string;
  sessionId: string;
  userAgent: string;
  screenResolution: string;
  viewportSize: string;
}

export class Analytics {
  private config: AnalyticsConfig;
  private sessionId: string;
  private userId?: string;
  private performanceMetrics: Partial<PerformanceMetrics> = {};
  private eventQueue: any[] = [];
  private isInitialized = false;
  private observers: PerformanceObserver[] = [];

  constructor(config: Partial<AnalyticsConfig> = {}) {
    this.config = {
      enablePerformanceMonitoring: true,
      enableUserTracking: true,
      enableBusinessTracking: true,
      enableErrorTracking: true,
      enableHeatmap: false,
      enableSessionRecording: false,
      sampleRate: 1.0,
      debugMode: process.env.NODE_ENV === 'development',
      ...config,
    };

    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate;
  }

  private async sendToAnalytics(data: any, type: string): Promise<void> {
    if (!this.shouldSample()) {
      return;
    }

    if (this.config.debugMode) {
      console.log(`Analytics [${type}]:`, data);
    }

    if (!this.config.trackingEndpoint) {
      return;
    }

    try {
      await fetch(this.config.trackingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: Date.now(),
          sessionId: this.sessionId,
          userId: this.userId,
        }),
      });
    } catch (error) {
      log.error('Failed to send analytics data', { error, type, data }, ['analytics']);
    }
  }

  private trackPerformanceMetrics(): void {
    if (!this.config.enablePerformanceMonitoring || typeof window === 'undefined') {
      return;
    }

    // Page load metrics
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          this.performanceMetrics.pageLoad = navigation.loadEventEnd - navigation.navigationStart;
          this.performanceMetrics.domContentLoaded = navigation.domContentLoadedEventEnd - navigation.navigationStart;
        }

        // Paint metrics
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach((entry) => {
          if (entry.name === 'first-contentful-paint') {
            this.performanceMetrics.firstContentfulPaint = entry.startTime;
          }
        });

        // LCP, FID, CLS need PerformanceObserver
        this.observeWebVitals();

        this.flushPerformanceMetrics();
      }, 0);
    });
  }

  private observeWebVitals(): void {
    if (!window.PerformanceObserver) {
      return;
    }

    // Largest Contentful Paint (LCP)
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.performanceMetrics.largestContentfulPaint = lastEntry.startTime;
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);
    } catch (e) {
      log.warn('LCP observer not supported', {}, ['analytics']);
    }

    // First Input Delay (FID)
    try {
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart) {
            this.performanceMetrics.firstInputDelay = entry.processingStart - entry.startTime;
          }
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);
    } catch (e) {
      log.warn('FID observer not supported', {}, ['analytics']);
    }

    // Cumulative Layout Shift (CLS)
    try {
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.performanceMetrics.cumulativeLayoutShift = clsValue;
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);
    } catch (e) {
      log.warn('CLS observer not supported', {}, ['analytics']);
    }
  }

  private flushPerformanceMetrics(): void {
    this.sendToAnalytics(this.performanceMetrics, 'performance');
  }

  private trackUserEvents(): void {
    if (!this.config.enableUserTracking || typeof document === 'undefined') {
      return;
    }

    // Click events
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const userEvent: UserEvent = {
        type: 'click',
        element: target.tagName.toLowerCase(),
        element_id: target.id,
        element_class: target.className,
        text: target.textContent?.substring(0, 100),
        href: (target as HTMLAnchorElement).href,
        timestamp: Date.now(),
        coordinates: { x: event.clientX, y: event.clientY },
      };

      this.eventQueue.push(userEvent);
      this.flushEventQueue();
    });

    // Scroll events (throttled)
    let scrollTimeout: NodeJS.Timeout;
    document.addEventListener('scroll', () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const userEvent: UserEvent = {
          type: 'scroll',
          element: 'window',
          timestamp: Date.now(),
          coordinates: { x: window.scrollX, y: window.scrollY },
        };

        this.eventQueue.push(userEvent);
      }, 100);
    });

    // Form submissions
    document.addEventListener('submit', (event) => {
      const target = event.target as HTMLFormElement;
      const userEvent: UserEvent = {
        type: 'form_submit',
        element: 'form',
        element_id: target.id,
        element_class: target.className,
        timestamp: Date.now(),
        metadata: {
          action: target.action,
          method: target.method,
        },
      };

      this.eventQueue.push(userEvent);
      this.flushEventQueue();
    });
  }

  private flushEventQueue(): void {
    if (this.eventQueue.length === 0) {
      return;
    }

    const events = this.eventQueue.splice(0, 10); // Send max 10 events at once
    this.sendToAnalytics(events, 'user_events');
  }

  private trackPageViews(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const trackView = () => {
      const pageView: PageView = {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        timestamp: Date.now(),
        sessionId: this.sessionId,
        userId: this.userId,
        userAgent: navigator.userAgent,
        screenResolution: `${screen.width}x${screen.height}`,
        viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      };

      this.sendToAnalytics(pageView, 'page_view');
    };

    // Track initial page view
    if (document.readyState === 'complete') {
      trackView();
    } else {
      window.addEventListener('load', trackView);
    }

    // Track SPA navigation changes
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(trackView, 100); // Small delay to ensure title is updated
      }
    });

    observer.observe(document, { subtree: true, childList: true });
  }

  // Public API methods
  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;

    if (this.config.enablePerformanceMonitoring) {
      this.trackPerformanceMetrics();
    }

    if (this.config.enableUserTracking) {
      this.trackUserEvents();
    }

    this.trackPageViews();

    log.info('Analytics initialized', {
      sessionId: this.sessionId,
      config: this.config,
    }, ['analytics']);
  }

  setUserId(userId: string): void {
    this.userId = userId;
    log.info('Analytics user ID set', { userId }, ['analytics']);
  }

  track(event: string, properties: Record<string, any> = {}): void {
    if (!this.config.enableBusinessTracking) {
      return;
    }

    const businessEvent: BusinessEvent = {
      event,
      category: 'custom',
      properties,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    this.sendToAnalytics(businessEvent, 'business_event');
  }

  trackPageView(url?: string, title?: string): void {
    const pageView: PageView = {
      url: url || window.location.href,
      title: title || document.title,
      referrer: document.referrer,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    };

    this.sendToAnalytics(pageView, 'page_view');
  }

  trackConversion(event: string, value?: number, currency?: string): void {
    const conversionEvent: BusinessEvent = {
      event,
      category: 'conversion',
      value,
      currency,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
    };

    this.sendToAnalytics(conversionEvent, 'conversion');
  }

  trackError(error: Error, context?: Record<string, any>): void {
    if (!this.config.enableErrorTracking) {
      return;
    }

    this.sendToAnalytics({
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    }, 'error');
  }

  // E-commerce specific methods
  trackProductView(productId: string, productName: string, price?: number): void {
    this.track('product_view', {
      productId,
      productName,
      price,
    });
  }

  trackAddToCart(productId: string, productName: string, price: number, quantity: number): void {
    this.track('add_to_cart', {
      productId,
      productName,
      price,
      quantity,
      value: price * quantity,
    });
  }

  trackPurchase(orderId: string, total: number, currency: string, items: any[]): void {
    this.trackConversion('purchase', total, currency);
    this.track('purchase', {
      orderId,
      total,
      currency,
      items,
    });
  }

  trackSearch(query: string, resultsCount: number, filters?: Record<string, any>): void {
    this.track('search', {
      query,
      resultsCount,
      filters,
    });
  }

  // Performance measurement methods
  startTiming(name: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      this.sendToAnalytics({
        name,
        duration,
        timestamp: Date.now(),
      }, 'timing');
    };
  }

  // Heatmap tracking
  trackMouseMove(event: MouseEvent): void {
    if (!this.config.enableHeatmap) {
      return;
    }

    this.eventQueue.push({
      type: 'mousemove',
      x: event.clientX,
      y: event.clientY,
      timestamp: Date.now(),
    });

    if (this.eventQueue.length >= 50) {
      this.flushEventQueue();
    }
  }

  // Cleanup
  destroy(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.flushEventQueue();
    this.flushPerformanceMetrics();
  }
}

// Default analytics instance
export const analytics = new Analytics({
  enablePerformanceMonitoring: true,
  enableUserTracking: true,
  enableBusinessTracking: true,
  enableErrorTracking: true,
  enableHeatmap: false,
  enableSessionRecording: false,
  sampleRate: 1.0,
  debugMode: process.env.NODE_ENV === 'development',
  trackingEndpoint: process.env.REACT_APP_ANALYTICS_ENDPOINT,
});

// Auto-initialize
if (typeof window !== 'undefined') {
  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => analytics.initialize());
  } else {
    analytics.initialize();
  }
}

// Export convenience functions
export const track = {
  event: (event: string, properties?: Record<string, any>) => analytics.track(event, properties),
  pageView: (url?: string, title?: string) => analytics.trackPageView(url, title),
  conversion: (event: string, value?: number, currency?: string) => analytics.trackConversion(event, value, currency),
  error: (error: Error, context?: Record<string, any>) => analytics.trackError(error, context),
  productView: (productId: string, productName: string, price?: number) => analytics.trackProductView(productId, productName, price),
  addToCart: (productId: string, productName: string, price: number, quantity: number) => analytics.trackAddToCart(productId, productName, price, quantity),
  purchase: (orderId: string, total: number, currency: string, items: any[]) => analytics.trackPurchase(orderId, total, currency, items),
  search: (query: string, resultsCount: number, filters?: Record<string, any>) => analytics.trackSearch(query, resultsCount, filters),
  startTiming: (name: string) => analytics.startTiming(name),
  setUserId: (userId: string) => analytics.setUserId(userId),
};

export default analytics;
