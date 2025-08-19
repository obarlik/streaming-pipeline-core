/**
 * Observability and tracing support
 */

export interface TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly correlationId?: string;
  readonly userId?: string;
  readonly sessionId?: string;
}

export interface FeatureFlags {
  readonly enableDetailedLogging: boolean;
  readonly enablePerformanceMetrics: boolean;
  readonly enableDebugMode: boolean;
  readonly maxContentLength: number;
  readonly processorTimeout: number;
}

// Default feature flags
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  enableDetailedLogging: true,
  enablePerformanceMetrics: true,
  enableDebugMode: false,
  maxContentLength: 1000000, // 1MB
  processorTimeout: 5000 // 5 seconds
};

// Generate trace IDs
export function generateTraceId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export function generateSpanId(): string {
  return Math.random().toString(36).substring(2);
}

// Enhanced logging context
export interface LogContext extends Record<string, any> {
  traceId?: string;
  spanId?: string;
  correlationId?: string;
  operation?: string;
  component?: string;
  duration?: number;
  contentLength?: number;
  processorName?: string;
  rendererFormat?: string;
}

// Enhanced metrics tags
export interface MetricTags {
  [key: string]: string;
}

// Observability utilities
export class ObservabilityUtils {
  static createLogContext(
    traceContext?: TraceContext,
    additionalContext?: Record<string, any>
  ): LogContext {
    return {
      ...additionalContext,
      traceId: traceContext?.traceId,
      spanId: traceContext?.spanId,
      correlationId: traceContext?.correlationId
    };
  }

  static createMetricTags(
    baseTag: string,
    traceContext?: TraceContext,
    additionalTags?: Record<string, string>
  ): MetricTags {
    const tags: MetricTags = {
      component: 'streaming-pipeline',
      operation: baseTag
    };
    
    if (traceContext?.traceId) {
      tags.traceId = traceContext.traceId;
    }
    
    if (additionalTags) {
      Object.assign(tags, additionalTags);
    }
    
    return tags;
  }

  static sanitizeForLogging(content: string, maxLength: number = 100): string {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  static calculatePerformanceGrade(duration: number, contentLength: number): string {
    const ratio = contentLength / Math.max(duration, 1); // chars per ms
    if (ratio > 10000) return 'excellent';
    if (ratio > 5000) return 'good';
    if (ratio > 1000) return 'fair';
    return 'poor';
  }
}