import {
  IPlugin,
  IChunkMiddleware,
  IContentPreprocessor,
  IContentPostprocessor,
  IStreamFilter,
  IErrorHandler,
  IPerformanceMonitor,
  IContentValidator,
  IExtensionRegistry,
  PluginEvent
} from '../framework/extension-interfaces';
import { ILogger, IMetrics, NoOpLogger, NoOpMetrics } from '../framework/services';

/**
 * Central registry for all pipeline extensions
 * Manages plugins, middleware, and hooks
 */
export class ExtensionRegistry implements IExtensionRegistry {
  private plugins = new Map<string, IPlugin>();
  private middlewares: IChunkMiddleware[] = [];
  private preprocessors: IContentPreprocessor[] = [];
  private postprocessors: IContentPostprocessor[] = [];
  private filters: IStreamFilter[] = [];
  private errorHandlers: IErrorHandler[] = [];
  private performanceMonitors: IPerformanceMonitor[] = [];
  private validators: IContentValidator[] = [];
  
  private logger: ILogger;
  private metrics: IMetrics;

  constructor(logger?: ILogger, metrics?: IMetrics) {
    this.logger = logger || new NoOpLogger();
    this.metrics = metrics || new NoOpMetrics();
  }

  // Plugin management
  registerPlugin(plugin: IPlugin): void {
    if (this.plugins.has(plugin.name)) {
      this.logger.warn(`Plugin ${plugin.name} already registered, replacing...`);
    }

    this.plugins.set(plugin.name, plugin);
    this.logger.info(`Registered plugin: ${plugin.name} v${plugin.version}`, {
      events: plugin.events,
      priority: plugin.priority
    });
    
    this.metrics.increment('extensions.plugins.registered', {
      name: plugin.name,
      version: plugin.version
    });

    // Initialize plugin if it has initialize method
    if (plugin.initialize) {
      try {
        const result = plugin.initialize(this);
        if (result instanceof Promise) {
          result.catch(error => {
            this.logger.error(`Plugin ${plugin.name} initialization failed`, { error });
          });
        }
      } catch (error) {
        this.logger.error(`Plugin ${plugin.name} initialization failed`, { error });
      }
    }
  }

  unregisterPlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (plugin) {
      // Cleanup plugin if it has cleanup method
      if (plugin.cleanup) {
        try {
          const result = plugin.cleanup();
          if (result instanceof Promise) {
            result.catch(error => {
              this.logger.error(`Plugin ${name} cleanup failed`, { error });
            });
          }
        } catch (error) {
          this.logger.error(`Plugin ${name} cleanup failed`, { error });
        }
      }

      this.plugins.delete(name);
      this.logger.info(`Unregistered plugin: ${name}`);
      this.metrics.increment('extensions.plugins.unregistered', { name });
    }
  }

  getPlugin(name: string): IPlugin | undefined {
    return this.plugins.get(name);
  }

  getPlugins(event?: PluginEvent): IPlugin[] {
    const allPlugins = Array.from(this.plugins.values());
    
    if (!event) {
      return allPlugins.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    return allPlugins
      .filter(plugin => plugin.events.includes(event))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // Middleware management
  registerMiddleware(middleware: IChunkMiddleware): void {
    this.middlewares.push(middleware);
    this.middlewares.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    this.logger.info(`Registered middleware: ${middleware.name}`, {
      priority: middleware.priority
    });
    
    this.metrics.increment('extensions.middleware.registered', {
      name: middleware.name
    });
  }

  getMiddlewares(): IChunkMiddleware[] {
    return [...this.middlewares];
  }

  // Preprocessor management
  registerPreprocessor(preprocessor: IContentPreprocessor): void {
    this.preprocessors.push(preprocessor);
    this.preprocessors.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    this.logger.info(`Registered preprocessor: ${preprocessor.name}`);
    this.metrics.increment('extensions.preprocessors.registered', {
      name: preprocessor.name
    });
  }

  getPreprocessors(): IContentPreprocessor[] {
    return [...this.preprocessors];
  }

  // Postprocessor management
  registerPostprocessor(postprocessor: IContentPostprocessor): void {
    this.postprocessors.push(postprocessor);
    this.postprocessors.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    this.logger.info(`Registered postprocessor: ${postprocessor.name}`);
    this.metrics.increment('extensions.postprocessors.registered', {
      name: postprocessor.name
    });
  }

  getPostprocessors(): IContentPostprocessor[] {
    return [...this.postprocessors];
  }

  // Filter management
  registerFilter(filter: IStreamFilter): void {
    this.filters.push(filter);
    this.logger.info(`Registered filter: ${filter.name}`);
    this.metrics.increment('extensions.filters.registered', {
      name: filter.name
    });
  }

  getFilters(): IStreamFilter[] {
    return [...this.filters];
  }

  // Error handler management
  registerErrorHandler(handler: IErrorHandler): void {
    this.errorHandlers.push(handler);
    this.logger.info(`Registered error handler: ${handler.name}`);
    this.metrics.increment('extensions.errorHandlers.registered', {
      name: handler.name
    });
  }

  getErrorHandlers(): IErrorHandler[] {
    return [...this.errorHandlers];
  }

  // Performance monitor management
  registerPerformanceMonitor(monitor: IPerformanceMonitor): void {
    this.performanceMonitors.push(monitor);
    this.logger.info(`Registered performance monitor: ${monitor.name}`);
    this.metrics.increment('extensions.performanceMonitors.registered', {
      name: monitor.name
    });
  }

  getPerformanceMonitors(): IPerformanceMonitor[] {
    return [...this.performanceMonitors];
  }

  // Validator management
  registerValidator(validator: IContentValidator): void {
    this.validators.push(validator);
    this.logger.info(`Registered validator: ${validator.name}`);
    this.metrics.increment('extensions.validators.registered', {
      name: validator.name
    });
  }

  getValidators(): IContentValidator[] {
    return [...this.validators];
  }

  // Utility methods
  getExtensionCounts(): Record<string, number> {
    return {
      plugins: this.plugins.size,
      middlewares: this.middlewares.length,
      preprocessors: this.preprocessors.length,
      postprocessors: this.postprocessors.length,
      filters: this.filters.length,
      errorHandlers: this.errorHandlers.length,
      performanceMonitors: this.performanceMonitors.length,
      validators: this.validators.length
    };
  }

  clear(): void {
    // Cleanup all plugins
    for (const plugin of this.plugins.values()) {
      if (plugin.cleanup) {
        try {
          plugin.cleanup();
        } catch (error) {
          this.logger.error(`Plugin ${plugin.name} cleanup failed`, { error });
        }
      }
    }

    this.plugins.clear();
    this.middlewares = [];
    this.preprocessors = [];
    this.postprocessors = [];
    this.filters = [];
    this.errorHandlers = [];
    this.performanceMonitors = [];
    this.validators = [];

    this.logger.info('Extension registry cleared');
  }
}