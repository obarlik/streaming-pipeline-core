import { 
  IProcessor, 
  IRenderer, 
  ASTNode, 
  ParseResult, 
  ProcessingContext,
  IPipelineOrchestrator
} from '../framework/core-interfaces';
import { ILogger, IMetrics, IContainer, NoOpLogger, NoOpMetrics } from '../framework/services';
import { 
  TraceContext, 
  FeatureFlags, 
  DEFAULT_FEATURE_FLAGS, 
  generateTraceId, 
  generateSpanId, 
  ObservabilityUtils 
} from '../framework/observability';

export interface PipelineOptions {
  preserveAST?: boolean;
  enableValidation?: boolean;
  transformers?: any[];
}

/**
 * Clean AST-first pipeline orchestrator
 * No backward compatibility - modern design only
 */
export class Pipeline implements IPipelineOrchestrator {
  private processors: IProcessor[] = [];
  private renderers: Map<string, IRenderer> = new Map();
  private logger: ILogger;
  private metrics: IMetrics;
  private container?: IContainer;
  private featureFlags: FeatureFlags;

  constructor(
    logger?: ILogger,
    metrics?: IMetrics,
    container?: IContainer,
    featureFlags?: Partial<FeatureFlags>
  ) {
    this.logger = logger || new NoOpLogger();
    this.metrics = metrics || new NoOpMetrics();
    this.container = container;
    this.featureFlags = { ...DEFAULT_FEATURE_FLAGS, ...featureFlags };
  }

  registerProcessor(processor: IProcessor): void {
    this.processors.push(processor);
    this.processors.sort((a, b) => b.priority - a.priority);
    
    this.logger.info(`Registered processor: ${processor.name}`, { 
      priority: processor.priority 
    });
    
    this.metrics.increment('pipeline.processors.registered', { 
      name: processor.name 
    });
  }

  registerRenderer(renderer: IRenderer): void {
    this.renderers.set(renderer.format, renderer);
    
    this.logger.info(`Registered renderer: ${renderer.format}`);
    
    this.metrics.increment('pipeline.renderers.registered', { 
      format: renderer.format 
    });
  }

  /**
   * Parse content to AST only
   */
  async parseToAST(
    content: string,
    context?: ProcessingContext,
    traceContext?: TraceContext
  ): Promise<ParseResult> {
    const startTime = Date.now();
    const trace = traceContext || {
      traceId: generateTraceId(),
      spanId: generateSpanId()
    };

    try {
      if (content.length > this.featureFlags.maxContentLength) {
        throw new Error(`Content too large: ${content.length} > ${this.featureFlags.maxContentLength}`);
      }

      const logContext = ObservabilityUtils.createLogContext(trace, {
        operation: 'parseToAST',
        component: 'pipeline',
        contentLength: content.length,
        contentPreview: ObservabilityUtils.sanitizeForLogging(content)
      });

      this.logger.info('Starting AST parsing', logContext);

      const processingContext: ProcessingContext = {
        ...context,
        metadata: {
          ...context?.metadata,
          originalLength: content.length,
          traceId: trace.traceId,
          startTime
        }
      };

      // Find appropriate processor
      const processor = this.findProcessor(content, processingContext);
      if (!processor) {
        throw new Error('No suitable processor found for content');
      }

      // Parse to AST
      const parseResult = processor.parseToAST(content, processingContext);
      const duration = Date.now() - startTime;

      // Log completion
      this.logger.info('AST parsing completed', {
        ...logContext,
        duration,
        nodeCount: parseResult.metadata.nodeCount,
        processorUsed: processor.name,
        errorCount: parseResult.errors.length
      });

      if (this.featureFlags.enablePerformanceMetrics) {
        this.metrics.timing('pipeline.parsing.total', duration,
          ObservabilityUtils.createMetricTags('parseAST', trace, {
            processor: processor.name,
            status: parseResult.errors.length > 0 ? 'with-errors' : 'success'
          })
        );
      }

      return parseResult;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('AST parsing failed',
        ObservabilityUtils.createLogContext(trace, {
          operation: 'parseToAST',
          component: 'pipeline',
          error: error instanceof Error ? error.message : String(error),
          duration,
          contentLength: content.length
        })
      );

      if (this.featureFlags.enablePerformanceMetrics) {
        this.metrics.timing('pipeline.parsing.error', duration,
          ObservabilityUtils.createMetricTags('parseAST', trace, {
            status: 'error'
          })
        );
      }

      throw error;
    }
  }

  /**
   * Render from pre-built AST
   */
  async renderFromAST(
    ast: ASTNode,
    format: string,
    traceContext?: TraceContext
  ): Promise<string> {
    const startTime = Date.now();
    const trace = traceContext || {
      traceId: generateTraceId(),
      spanId: generateSpanId()
    };

    try {
      const renderer = this.renderers.get(format);
      if (!renderer) {
        this.logger.error('Renderer not found',
          ObservabilityUtils.createLogContext(trace, {
            operation: 'renderFromAST',
            component: 'pipeline',
            requestedFormat: format,
            availableFormats: Array.from(this.renderers.keys())
          })
        );
        throw new Error(`No renderer found for format: ${format}`);
      }

      const logContext = ObservabilityUtils.createLogContext(trace, {
        operation: 'renderFromAST',
        component: 'pipeline',
        targetFormat: format,
        astType: ast.type
      });

      this.logger.info('Starting AST rendering', logContext);

      const result = renderer.renderFromAST(ast);
      const duration = Date.now() - startTime;

      this.logger.info('AST rendering completed', {
        ...logContext,
        duration,
        outputLength: result.length,
        rendererUsed: renderer.format
      });

      if (this.featureFlags.enablePerformanceMetrics) {
        this.metrics.timing('pipeline.rendering.total', duration,
          ObservabilityUtils.createMetricTags('renderAST', trace, {
            renderer: format,
            status: 'success'
          })
        );
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.logger.error('AST rendering failed',
        ObservabilityUtils.createLogContext(trace, {
          operation: 'renderFromAST',
          component: 'pipeline',
          error: error instanceof Error ? error.message : String(error),
          duration,
          targetFormat: format
        })
      );

      if (this.featureFlags.enablePerformanceMetrics) {
        this.metrics.timing('pipeline.rendering.error', duration,
          ObservabilityUtils.createMetricTags('renderAST', trace, {
            status: 'error',
            targetFormat: format
          })
        );
      }

      throw error;
    }
  }

  /**
   * Complete pipeline: parse to AST then render
   */
  async process(
    content: string,
    format: string,
    context?: ProcessingContext,
    traceContext?: TraceContext,
    options: PipelineOptions = {}
  ): Promise<string> {
    const trace = traceContext || {
      traceId: generateTraceId(),
      spanId: generateSpanId()
    };

    // Parse to AST
    const parseResult = await this.parseToAST(content, context, trace);
    
    // Render from AST
    const result = await this.renderFromAST(parseResult.ast, format, trace);

    return result;
  }

  private findProcessor(content: string, context: ProcessingContext): IProcessor | undefined {
    return this.processors.find(processor => processor.canProcess(content, context));
  }
}