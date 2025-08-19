import { PluginEvent, PluginContext, IHookSystem } from '../framework/extension-interfaces';
import { ILogger, NoOpLogger } from '../framework/services';

type HookCallback = (context: PluginContext) => any;
type ConditionalHook = {
  condition: (context: PluginContext) => boolean;
  callback: HookCallback;
};

/**
 * Event-driven hook system for fine-grained pipeline control
 */
export class HookSystem implements IHookSystem {
  private hooks = new Map<PluginEvent, HookCallback[]>();
  private onceHooks = new Map<PluginEvent, HookCallback[]>();
  private conditionalHooks = new Map<PluginEvent, ConditionalHook[]>();
  private logger: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger || new NoOpLogger();
  }

  // Register persistent hooks
  on(event: PluginEvent, callback: HookCallback): void {
    if (!this.hooks.has(event)) {
      this.hooks.set(event, []);
    }
    this.hooks.get(event)!.push(callback);
    
    this.logger.debug(`Registered hook for event: ${event}`, {
      totalHooks: this.hooks.get(event)!.length
    });
  }

  // Register one-time hooks
  once(event: PluginEvent, callback: HookCallback): void {
    if (!this.onceHooks.has(event)) {
      this.onceHooks.set(event, []);
    }
    this.onceHooks.get(event)!.push(callback);
    
    this.logger.debug(`Registered once hook for event: ${event}`);
  }

  // Remove hooks
  off(event: PluginEvent, callback: HookCallback): void {
    // Remove from persistent hooks
    const hooks = this.hooks.get(event);
    if (hooks) {
      const index = hooks.indexOf(callback);
      if (index > -1) {
        hooks.splice(index, 1);
        this.logger.debug(`Removed hook for event: ${event}`);
      }
    }

    // Remove from once hooks
    const onceHooks = this.onceHooks.get(event);
    if (onceHooks) {
      const index = onceHooks.indexOf(callback);
      if (index > -1) {
        onceHooks.splice(index, 1);
        this.logger.debug(`Removed once hook for event: ${event}`);
      }
    }
  }

  // Emit events asynchronously
  async emit(event: PluginEvent, context: PluginContext): Promise<any[]> {
    const results: any[] = [];
    const startTime = Date.now();

    try {
      // Execute persistent hooks
      const hooks = this.hooks.get(event) || [];
      for (const hook of hooks) {
        try {
          const result = await hook(context);
          results.push(result);
        } catch (error) {
          this.logger.error(`Hook execution failed for event ${event}`, { error });
          results.push({ error });
        }
      }

      // Execute once hooks
      const onceHooks = this.onceHooks.get(event) || [];
      for (const hook of onceHooks) {
        try {
          const result = await hook(context);
          results.push(result);
        } catch (error) {
          this.logger.error(`Once hook execution failed for event ${event}`, { error });
          results.push({ error });
        }
      }

      // Clear once hooks after execution
      if (onceHooks.length > 0) {
        this.onceHooks.delete(event);
      }

      // Execute conditional hooks
      const conditionalHooks = this.conditionalHooks.get(event) || [];
      for (const { condition, callback } of conditionalHooks) {
        try {
          if (condition(context)) {
            const result = await callback(context);
            results.push(result);
          }
        } catch (error) {
          this.logger.error(`Conditional hook execution failed for event ${event}`, { error });
          results.push({ error });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Emitted event ${event}`, {
        hookCount: hooks.length + onceHooks.length + conditionalHooks.length,
        duration,
        resultCount: results.length
      });

      return results;
    } catch (error) {
      this.logger.error(`Event emission failed for ${event}`, { error });
      throw error;
    }
  }

  // Emit events synchronously
  emitSync(event: PluginEvent, context: PluginContext): any[] {
    const results: any[] = [];
    const startTime = Date.now();

    try {
      // Execute persistent hooks
      const hooks = this.hooks.get(event) || [];
      for (const hook of hooks) {
        try {
          const result = hook(context);
          results.push(result);
        } catch (error) {
          this.logger.error(`Sync hook execution failed for event ${event}`, { error });
          results.push({ error });
        }
      }

      // Execute once hooks
      const onceHooks = this.onceHooks.get(event) || [];
      for (const hook of onceHooks) {
        try {
          const result = hook(context);
          results.push(result);
        } catch (error) {
          this.logger.error(`Sync once hook execution failed for event ${event}`, { error });
          results.push({ error });
        }
      }

      // Clear once hooks after execution
      if (onceHooks.length > 0) {
        this.onceHooks.delete(event);
      }

      // Execute conditional hooks
      const conditionalHooks = this.conditionalHooks.get(event) || [];
      for (const { condition, callback } of conditionalHooks) {
        try {
          if (condition(context)) {
            const result = callback(context);
            results.push(result);
          }
        } catch (error) {
          this.logger.error(`Sync conditional hook execution failed for event ${event}`, { error });
          results.push({ error });
        }
      }

      const duration = Date.now() - startTime;
      this.logger.debug(`Emitted sync event ${event}`, {
        hookCount: hooks.length + onceHooks.length + conditionalHooks.length,
        duration,
        resultCount: results.length
      });

      return results;
    } catch (error) {
      this.logger.error(`Sync event emission failed for ${event}`, { error });
      throw error;
    }
  }

  // Register conditional hooks
  when(condition: (context: PluginContext) => boolean, callback: HookCallback): void {
    // This is a bit tricky - we need to know which events to register for
    // For simplicity, register for all events
    const allEvents: PluginEvent[] = [
      'beforeProcess', 'afterProcess', 'beforeRender', 'afterRender',
      'onChunk', 'onError', 'onComplete'
    ];

    for (const event of allEvents) {
      if (!this.conditionalHooks.has(event)) {
        this.conditionalHooks.set(event, []);
      }
      this.conditionalHooks.get(event)!.push({ condition, callback });
    }

    this.logger.debug('Registered conditional hook for all events');
  }

  // Utility methods
  getHookCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const [event, hooks] of this.hooks) {
      counts[`${event}_persistent`] = hooks.length;
    }
    
    for (const [event, hooks] of this.onceHooks) {
      counts[`${event}_once`] = hooks.length;
    }
    
    for (const [event, hooks] of this.conditionalHooks) {
      counts[`${event}_conditional`] = hooks.length;
    }
    
    return counts;
  }

  clear(): void {
    this.hooks.clear();
    this.onceHooks.clear();
    this.conditionalHooks.clear();
    this.logger.debug('Hook system cleared');
  }

  // Get all registered events
  getRegisteredEvents(): PluginEvent[] {
    const events = new Set<PluginEvent>();
    
    for (const event of this.hooks.keys()) {
      events.add(event);
    }
    
    for (const event of this.onceHooks.keys()) {
      events.add(event);
    }
    
    for (const event of this.conditionalHooks.keys()) {
      events.add(event);
    }
    
    return Array.from(events);
  }
}