/**
 * External service interfaces - injectable from outside
 */

export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

export interface IMetrics {
  increment(metric: string, tags?: Record<string, string>): void;
  timing(metric: string, duration: number, tags?: Record<string, string>): void;
  gauge(metric: string, value: number, tags?: Record<string, string>): void;
}

export interface IContainer {
  get<T>(token: string): T;
  has(token: string): boolean;
}

// Service tokens for external DI
export const SERVICE_TOKENS = {
  LOGGER: 'logger',
  METRICS: 'metrics',
  CONTAINER: 'container'
} as const;

// Default implementations (no-op)
export class NoOpLogger implements ILogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

export class NoOpMetrics implements IMetrics {
  increment(): void {}
  timing(): void {}
  gauge(): void {}
}