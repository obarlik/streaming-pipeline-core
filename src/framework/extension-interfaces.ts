/**
 * Extension points and plugin system for streaming pipeline
 * Flexible architecture with multiple hooks and middleware
 */

import { StreamChunk, StreamingContext, StreamPosition } from './streaming-interfaces';

// Plugin lifecycle events
export type PluginEvent = 
  | 'beforeProcess' 
  | 'afterProcess' 
  | 'beforeRender' 
  | 'afterRender'
  | 'onChunk'
  | 'onError'
  | 'onComplete';

// Plugin context passed to hooks
export interface PluginContext {
  readonly event: PluginEvent;
  readonly data?: any;
  readonly metadata?: Record<string, any>;
  readonly position?: StreamPosition;
  readonly traceId?: string;
}

// Core plugin interface
export interface IPlugin {
  readonly name: string;
  readonly version: string;
  readonly priority?: number;
  readonly events: readonly PluginEvent[];
  
  initialize?(pipeline: any): Promise<void> | void;
  execute(context: PluginContext): Promise<any> | any;
  cleanup?(): Promise<void> | void;
}

// Middleware for chunk transformation
export interface IChunkMiddleware {
  readonly name: string;
  readonly priority?: number;
  
  process(chunk: StreamChunk, context: StreamingContext): StreamChunk | StreamChunk[] | null;
}

// Content preprocessor (before streaming)
export interface IContentPreprocessor {
  readonly name: string;
  readonly priority?: number;
  
  preprocess(content: string, context: StreamingContext): string;
}

// Content postprocessor (after rendering)
export interface IContentPostprocessor {
  readonly name: string;
  readonly priority?: number;
  
  postprocess(output: string, format: string, context: StreamingContext): string;
}

// Stream filter (conditional processing)
export interface IStreamFilter {
  readonly name: string;
  
  shouldProcess(line: string, context: StreamingContext): boolean;
  shouldRender(chunk: StreamChunk, format: string): boolean;
}

// Custom error handler
export interface IErrorHandler {
  readonly name: string;
  
  canHandle(error: Error, context: PluginContext): boolean;
  handle(error: Error, context: PluginContext): any;
}

// Performance monitor
export interface IPerformanceMonitor {
  readonly name: string;
  
  onLineStart(line: string, context: StreamingContext): void;
  onLineEnd(line: string, chunks: StreamChunk[], duration: number): void;
  onStreamStart(content: string, format: string): void;
  onStreamEnd(totalLines: number, totalChunks: number, duration: number): void;
}

// Content validator
export interface IContentValidator {
  readonly name: string;
  
  validateInput(content: string): ValidationResult;
  validateChunk(chunk: StreamChunk): ValidationResult;
  validateOutput(output: string, format: string): ValidationResult;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
  readonly warnings: string[];
}

// Extension registry for managing all extensions
export interface IExtensionRegistry {
  // Plugin management
  registerPlugin(plugin: IPlugin): void;
  unregisterPlugin(name: string): void;
  getPlugin(name: string): IPlugin | undefined;
  getPlugins(event?: PluginEvent): IPlugin[];
  
  // Middleware management
  registerMiddleware(middleware: IChunkMiddleware): void;
  getMiddlewares(): IChunkMiddleware[];
  
  // Preprocessor/Postprocessor management
  registerPreprocessor(preprocessor: IContentPreprocessor): void;
  registerPostprocessor(postprocessor: IContentPostprocessor): void;
  getPreprocessors(): IContentPreprocessor[];
  getPostprocessors(): IContentPostprocessor[];
  
  // Filter management
  registerFilter(filter: IStreamFilter): void;
  getFilters(): IStreamFilter[];
  
  // Error handler management
  registerErrorHandler(handler: IErrorHandler): void;
  getErrorHandlers(): IErrorHandler[];
  
  // Performance monitor management
  registerPerformanceMonitor(monitor: IPerformanceMonitor): void;
  getPerformanceMonitors(): IPerformanceMonitor[];
  
  // Validator management
  registerValidator(validator: IContentValidator): void;
  getValidators(): IContentValidator[];
  
  // Utility methods
  getExtensionCounts(): Record<string, number>;
}

// Hook system for fine-grained control
export interface IHookSystem {
  // Register hooks
  on(event: PluginEvent, callback: (context: PluginContext) => any): void;
  once(event: PluginEvent, callback: (context: PluginContext) => any): void;
  off(event: PluginEvent, callback: (context: PluginContext) => any): void;
  
  // Emit events
  emit(event: PluginEvent, context: PluginContext): Promise<any[]>;
  emitSync(event: PluginEvent, context: PluginContext): any[];
  
  // Conditional hooks
  when(condition: (context: PluginContext) => boolean, callback: (context: PluginContext) => any): void;
  
  // Utility methods
  getHookCounts(): Record<string, number>;
  getRegisteredEvents(): PluginEvent[];
}

// Configuration system for extensions
export interface IExtensionConfig {
  readonly plugins: Record<string, any>;
  readonly middleware: Record<string, any>;
  readonly processors: Record<string, any>;
  readonly filters: Record<string, any>;
  readonly validators: Record<string, any>;
  readonly performance: Record<string, any>;
}

// Dynamic loader for runtime extensions
export interface IExtensionLoader {
  loadPlugin(path: string): Promise<IPlugin>;
  loadMiddleware(path: string): Promise<IChunkMiddleware>;
  loadFromConfig(config: IExtensionConfig): Promise<void>;
  discoverExtensions(directory: string): Promise<string[]>;
}

// Extension metadata for discovery
export interface ExtensionMetadata {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly author: string;
  readonly type: 'plugin' | 'middleware' | 'processor' | 'filter' | 'validator' | 'monitor';
  readonly dependencies?: string[];
  readonly peerDependencies?: string[];
  readonly configuration?: Record<string, any>;
}