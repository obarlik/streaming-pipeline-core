import { 
  IASTProcessor, 
  IASTRenderer, 
  ASTNode, 
  ParseResult, 
  ASTUtils,
  ProcessingContext 
} from '../framework/ast';
import { ILogger, IMetrics, IContainer, NoOpLogger, NoOpMetrics } from '../framework/services';
import { 
  TraceContext, 
  FeatureFlags, 
  DEFAULT_FEATURE_FLAGS, 
  generateTraceId, 
  generateSpanId, 
  ObservabilityUtils 
} from '../framework/observability';

export interface ASTProcessingOptions {
  astOptional?: boolean;
  preserveAST?: boolean;
  enableValidation?: boolean;
  transformers?: any[];
}

export class ASTOrchestrator {
  private processors: IASTProcessor[] = [];
  private renderers: Map<string, IASTRenderer> = new Map();
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

  registerProcessor(processor: IASTProcessor): void {
    this.processors.push(processor);
    this.processors.sort((a, b) => b.priority - a.priority);
    
    this.logger.info(`Registered AST processor: ${processor.name}`, { 
      priority: processor.priority 
    });
    
    this.metrics.increment('ast.processors.registered', { 
      name: processor.name 
    });
  }

  registerRenderer(renderer: IASTRenderer): void {
    this.renderers.set(renderer.format, renderer);
    
    this.logger.info(`Registered AST renderer: ${renderer.format}`);
    
    this.metrics.increment('ast.renderers.registered', { 
      format: renderer.format 
    });
  }

  /**
   * Parse content to AST only (no rendering)
   */
  async parseToAST(
    content: string,
    traceContext?: TraceContext,
    options: ASTProcessingOptions = {}
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
        component: 'ast-orchestrator',
        contentLength: content.length,
        contentPreview: ObservabilityUtils.sanitizeForLogging(content)
      });

      this.logger.info('Starting AST parsing', logContext);

      const context: ProcessingContext = {
        metadata: {
          originalLength: content.length,
          traceId: trace.traceId,
          startTime,
          astMode: true
        },
        variables: new Map()
      };

      // Find appropriate processor
      const processor = this.findProcessor(content, context);
      if (!processor) {
        throw new Error('No suitable AST processor found for content');
      }

      // Parse to AST
      const parseResult = processor.parseToAST(content, context);
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
        this.metrics.timing('ast.parsing.total', duration,
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
          component: 'ast-orchestrator',
          error: error instanceof Error ? error.message : String(error),
          duration,
          contentLength: content.length
        })
      );

      if (this.featureFlags.enablePerformanceMetrics) {
        this.metrics.timing('ast.parsing.error', duration,
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
    targetFormat: string,
    traceContext?: TraceContext
  ): Promise<string> {
    const startTime = Date.now();
    const trace = traceContext || {
      traceId: generateTraceId(),
      spanId: generateSpanId()
    };

    try {
      const renderer = this.renderers.get(targetFormat);
      if (!renderer) {
        this.logger.error('AST renderer not found',
          ObservabilityUtils.createLogContext(trace, {
            operation: 'renderFromAST',
            component: 'ast-orchestrator',
            requestedFormat: targetFormat,
            availableFormats: Array.from(this.renderers.keys())
          })
        );
        throw new Error(`No AST renderer found for format: ${targetFormat}`);
      }

      const logContext = ObservabilityUtils.createLogContext(trace, {
        operation: 'renderFromAST',
        component: 'ast-orchestrator',
        targetFormat,
        astType: ast.type,
        astNodeCount: ASTUtils.getASTStats(ast).nodeCount
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
        this.metrics.timing('ast.rendering.total', duration,
          ObservabilityUtils.createMetricTags('renderAST', trace, {
            renderer: targetFormat,
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
          component: 'ast-orchestrator',
          error: error instanceof Error ? error.message : String(error),
          duration,
          targetFormat
        })
      );

      if (this.featureFlags.enablePerformanceMetrics) {
        this.metrics.timing('ast.rendering.error', duration,
          ObservabilityUtils.createMetricTags('renderAST', trace, {
            status: 'error',
            targetFormat
          })
        );
      }

      throw error;
    }
  }

  /**
   * Complete pipeline: parse to AST then render
   */
  async processWithAST(
    content: string,
    targetFormat: string,
    traceContext?: TraceContext,
    options: ASTProcessingOptions = {}
  ): Promise<{
    result: string;
    ast?: ASTNode;
    parseResult: ParseResult;
  }> {
    const trace = traceContext || {
      traceId: generateTraceId(),
      spanId: generateSpanId()
    };

    // Parse to AST
    const parseResult = await this.parseToAST(content, trace, options);
    
    // Render from AST
    const result = await this.renderFromAST(parseResult.ast, targetFormat, trace);

    // Return result with optional AST
    return {
      result,
      ast: options.preserveAST ? parseResult.ast : undefined,
      parseResult
    };
  }

  /**
   * Get AST statistics
   */
  getASTStats(ast: ASTNode): {
    nodeCount: number;
    maxDepth: number;
    typeDistribution: Record<string, number>;
  } {
    return ASTUtils.getASTStats(ast);
  }

  /**
   * Validate AST structure
   */
  validateAST(ast: ASTNode): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!ast.type) {
      errors.push('AST node missing type');
    }

    if (ast.content === undefined) {
      errors.push('AST node missing content');
    }

    if (ast.children) {
      for (let i = 0; i < ast.children.length; i++) {
        const childValidation = this.validateAST(ast.children[i]);
        if (!childValidation.valid) {
          errors.push(`Child ${i}: ${childValidation.errors.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private findProcessor(content: string, context: ProcessingContext): IASTProcessor | undefined {
    return this.processors.find(processor => processor.canProcess(content, context));
  }
}