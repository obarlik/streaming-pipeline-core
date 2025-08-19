import { IContentProcessor, IContentRenderer, ContentSegment, ProcessingContext } from '../framework/interfaces';
import { ILogger, IMetrics, IContainer, NoOpLogger, NoOpMetrics } from '../framework/services';
import { TraceContext, FeatureFlags, DEFAULT_FEATURE_FLAGS, generateTraceId, generateSpanId, ObservabilityUtils } from '../framework/observability';

export class StreamingOrchestrator {
  private processors: IContentProcessor[] = [];
  private renderers: Map<string, IContentRenderer> = new Map();
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

  registerProcessor(processor: IContentProcessor): void {
    this.processors.push(processor);
    this.processors.sort((a, b) => b.priority - a.priority);
    this.logger.info(`Registered processor: ${processor.name}`, { priority: processor.priority });
    this.metrics.increment('processors.registered', { name: processor.name });
  }

  registerRenderer(renderer: IContentRenderer): void {
    this.renderers.set(renderer.format, renderer);
    this.logger.info(`Registered renderer: ${renderer.format}`);
    this.metrics.increment('renderers.registered', { format: renderer.format });
  }

  async processContent(
    content: string, 
    targetFormat: string = 'text',
    traceContext?: TraceContext
  ): Promise<string> {
    const startTime = Date.now();
    const trace = traceContext || {
      traceId: generateTraceId(),
      spanId: generateSpanId()
    };
    
    try {
      // Validate content length against feature flags
      if (content.length > this.featureFlags.maxContentLength) {
        throw new Error(`Content too large: ${content.length} > ${this.featureFlags.maxContentLength}`);
      }

      const logContext = ObservabilityUtils.createLogContext(trace, {
        operation: 'processContent',
        component: 'orchestrator',
        contentLength: content.length,
        targetFormat,
        contentPreview: ObservabilityUtils.sanitizeForLogging(content)
      });
      
      this.logger.info('Starting content processing', logContext);

      const context: ProcessingContext = {
        metadata: { 
          originalLength: content.length,
          traceId: trace.traceId,
          startTime 
        },
        variables: new Map()
      };

      const segments = await this.processToSegments(content, context, trace);
      const result = await this.renderSegments(segments, targetFormat, trace);
      
      const duration = Date.now() - startTime;
      const performanceGrade = ObservabilityUtils.calculatePerformanceGrade(duration, content.length);
      
      if (this.featureFlags.enablePerformanceMetrics) {
        this.metrics.timing('processing.total', duration, 
          ObservabilityUtils.createMetricTags('process', trace, {
            status: 'success',
            performance: performanceGrade,
            targetFormat
          })
        );
      }
      
      this.logger.info('Content processing completed', {
        ...logContext,
        duration, 
        segmentCount: segments.length,
        outputLength: result.length,
        performance: performanceGrade
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (this.featureFlags.enablePerformanceMetrics) {
        this.metrics.timing('processing.error', duration,
          ObservabilityUtils.createMetricTags('process', trace, {
            status: 'error',
            targetFormat
          })
        );
      }
      
      this.logger.error('Content processing failed', 
        ObservabilityUtils.createLogContext(trace, {
          operation: 'processContent',
          component: 'orchestrator',
          error: error instanceof Error ? error.message : String(error),
          duration,
          contentLength: content.length
        })
      );
      throw error;
    }
  }

  private async processToSegments(
    content: string, 
    context: ProcessingContext, 
    trace: TraceContext
  ): Promise<ContentSegment[]> {
    const lines = content.split('\n');
    const segments: ContentSegment[] = [];

    for (const line of lines) {
      let processed = false;
      
      for (const processor of this.processors) {
        if (processor.canProcess(line, context)) {
          const lineSegments = processor.process(line, context);
          segments.push(...lineSegments);
          processed = true;
          break;
        }
      }

      if (!processed) {
        segments.push({ type: 'text', content: line });
      }
    }

    return segments;
  }

  private async renderSegments(
    segments: ContentSegment[], 
    format: string,
    trace: TraceContext
  ): Promise<string> {
    const renderer = this.renderers.get(format);
    if (!renderer) {
      this.logger.error('Renderer not found', 
        ObservabilityUtils.createLogContext(trace, {
          operation: 'renderSegments',
          component: 'orchestrator',
          requestedFormat: format,
          availableFormats: Array.from(this.renderers.keys())
        })
      );
      throw new Error(`No renderer found for format: ${format}`);
    }

    this.logger.debug('Starting rendering', 
      ObservabilityUtils.createLogContext(trace, {
        operation: 'renderSegments',
        component: 'orchestrator',
        rendererFormat: renderer.format,
        segmentCount: segments.length
      })
    );

    return renderer.render(segments);
  }

  // External service support
  getService<T>(token: string): T | undefined {
    return this.container?.get<T>(token);
  }

  hasService(token: string): boolean {
    return this.container?.has(token) || false;
  }
}