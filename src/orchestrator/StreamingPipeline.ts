import {
  IStreamProcessor,
  IStreamRenderer,
  IStreamingPipeline,
  StreamChunk,
  StreamingContext,
  StreamOptions,
  BufferOptions,
  StreamEvent
} from '../framework/streaming-interfaces';
import { CircularStreamBuffer, TextCircularBuffer } from '../framework/CircularStreamBuffer';
import { ILogger, IMetrics, NoOpLogger, NoOpMetrics } from '../framework/services';

/**
 * Streaming pipeline with circular buffer system
 * Single buffer approach with bounded lookahead/lookbehind
 */
export class StreamingPipeline implements IStreamingPipeline {
  private processors: IStreamProcessor[] = [];
  private renderers: Map<string, IStreamRenderer> = new Map();
  private logger: ILogger;
  private metrics: IMetrics;
  
  // Buffer configuration
  private bufferOptions: BufferOptions = {
    lookBehindSize: 512,
    lookAheadSize: 2048,
    encoding: 'utf-8',
    autoCompact: true
  };

  constructor(logger?: ILogger, metrics?: IMetrics) {
    this.logger = logger || new NoOpLogger();
    this.metrics = metrics || new NoOpMetrics();
  }

  /**
   * Primary streaming API with circular buffer
   */
  async* processStream(
    input: string | Uint8Array | ReadableStream,
    format: string,
    options: StreamOptions = {}
  ): AsyncIterable<string> {
    const renderer = this.getRenderer(format);
    
    // Configure buffer based on options
    const lookBehindSize = options.lookBehindSize || this.bufferOptions.lookBehindSize;
    const lookAheadSize = options.lookAheadSize || this.bufferOptions.lookAheadSize;
    const encoding = options.encoding || this.bufferOptions.encoding;
    
    // Create appropriate buffer based on input type
    const buffer = this.createBuffer(input, lookBehindSize, lookAheadSize, encoding);
    
    this.logger.info('Starting streaming processing', {
      inputType: typeof input,
      format,
      lookBehindSize,
      lookAheadSize,
      processorsCount: this.processors.length
    });

    // Fill initial buffer
    await this.fillBuffer(buffer, input);
    
    let totalChunks = 0;
    const startTime = Date.now();

    // Main processing loop
    while (!buffer.getState().isEOF || buffer.canAdvance()) {
      try {
        const context = this.createContext(buffer, encoding, options);
        
        // Find processor for current position
        const processor = this.findProcessor(context);
        
        if (processor) {
          // Process current position
          const result = processor.process(context);
          
          // Render chunks immediately
          for (const chunk of result.chunks) {
            const output = renderer.renderChunk(chunk);
            if (output) {
              yield output;
              totalChunks++;
            }
          }
          
          // Ensure at least 1 advance to prevent infinite loops
          const safeAdvance = Math.max(1, result.advance);
          for (let i = 0; i < safeAdvance; i++) {
            if (!buffer.advance()) break;
          }
          
          this.metrics.increment('stream.chunks.processed', { processor: processor.name });
        } else {
          // No processor found, advance one position
          if (!buffer.advance()) break;
        }
        
        // Refill buffer if needed
        if (buffer.needsRefill() && options.autoRefill !== false) {
          await this.fillBuffer(buffer, input);
        }
        
        // Emit progress metrics periodically
        if (totalChunks % 100 === 0) {
          this.metrics.gauge('stream.chunks.total', totalChunks);
        }
        
      } catch (error) {
        this.logger.error('Processing error', { error: (error as Error).message });
        
        // Try to advance past error
        if (!buffer.advance()) break;
      }
    }
    
    const duration = Date.now() - startTime;
    
    this.logger.info('Streaming processing completed', {
      totalChunks,
      duration,
      globalPosition: buffer.getState().globalPosition
    });
    
    this.metrics.timing('stream.processing.duration', duration);
  }

  /**
   * Register stream processor
   */
  registerProcessor(processor: IStreamProcessor): void {
    this.processors.push(processor);
    this.processors.sort((a, b) => b.priority - a.priority);
    
    this.logger.info(`Registered processor: ${processor.name}`, {
      priority: processor.priority,
      processorsCount: this.processors.length
    });
    
    this.metrics.increment('stream.processors.registered', { name: processor.name });
  }

  /**
   * Register stream renderer
   */
  registerRenderer(renderer: IStreamRenderer): void {
    this.renderers.set(renderer.format, renderer);
    
    this.logger.info(`Registered renderer: ${renderer.format}`);
    this.metrics.increment('stream.renderers.registered', { format: renderer.format });
  }

  /**
   * Configure buffer settings
   */
  configureBuffer(options: BufferOptions): void {
    this.bufferOptions = { ...this.bufferOptions, ...options };
    
    this.logger.info('Buffer configured', this.bufferOptions);
  }

  /**
   * Reset pipeline state
   */
  reset(): void {
    this.logger.debug('Pipeline reset');
  }

  // Private helper methods

  private createBuffer(
    input: string | Uint8Array | ReadableStream,
    lookBehindSize: number,
    lookAheadSize: number,
    encoding: string
  ): CircularStreamBuffer | TextCircularBuffer {
    if (typeof input === 'string' || encoding !== 'binary') {
      return new TextCircularBuffer(lookBehindSize, lookAheadSize, encoding);
    } else {
      return new CircularStreamBuffer(lookBehindSize, lookAheadSize, encoding);
    }
  }

  private async fillBuffer(
    buffer: CircularStreamBuffer | TextCircularBuffer,
    input: string | Uint8Array | ReadableStream
  ): Promise<void> {
    if (typeof input === 'string') {
      if (buffer instanceof TextCircularBuffer) {
        buffer.fillString(input);
        buffer.markEOF();
      }
    } else if (input instanceof Uint8Array) {
      buffer.fill(input);
      buffer.markEOF();
    } else if (input instanceof ReadableStream) {
      // Handle streaming input
      const reader = input.getReader();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            buffer.markEOF();
            break;
          }
          
          if (value instanceof Uint8Array) {
            buffer.fill(value);
          } else if (typeof value === 'string') {
            if (buffer instanceof TextCircularBuffer) {
              buffer.fillString(value);
            }
          }
          
          // Don't fill entire stream at once - allow processing
          if (!buffer.needsRefill()) {
            break;
          }
        }
      } finally {
        reader.releaseLock();
      }
    }
  }

  private createContext(
    buffer: CircularStreamBuffer | TextCircularBuffer,
    encoding: string,
    options: StreamOptions
  ): StreamingContext {
    const bufferState = buffer.getState();
    const position = buffer.getStreamPosition();
    
    return {
      buffer,
      position,
      bufferState,
      encoding,
      metadata: options.metadata,
      isEOF: bufferState.isEOF,
      needsRefill: buffer.needsRefill(),
      canAdvance: buffer.canAdvance()
    };
  }

  private findProcessor(context: StreamingContext): IStreamProcessor | null {
    for (const processor of this.processors) {
      if (processor.canProcess(context)) {
        return processor;
      }
    }
    return null;
  }

  private getRenderer(format: string): IStreamRenderer {
    const renderer = this.renderers.get(format);
    if (!renderer) {
      throw new Error(`No renderer found for format: ${format}`);
    }
    return renderer;
  }
}

/**
 * Pipeline factory with common configurations
 */
export class PipelineFactory {
  /**
   * Create text processing pipeline
   */
  static createTextPipeline(options?: {
    lookBehindSize?: number;
    lookAheadSize?: number;
    encoding?: string;
  }): StreamingPipeline {
    const pipeline = new StreamingPipeline();
    
    pipeline.configureBuffer({
      lookBehindSize: options?.lookBehindSize || 256,
      lookAheadSize: options?.lookAheadSize || 1024,
      encoding: options?.encoding || 'utf-8',
      autoCompact: true
    });
    
    return pipeline;
  }

  /**
   * Create binary processing pipeline
   */
  static createBinaryPipeline(options?: {
    lookBehindSize?: number;
    lookAheadSize?: number;
  }): StreamingPipeline {
    const pipeline = new StreamingPipeline();
    
    pipeline.configureBuffer({
      lookBehindSize: options?.lookBehindSize || 128,
      lookAheadSize: options?.lookAheadSize || 512,
      encoding: 'binary',
      autoCompact: true
    });
    
    return pipeline;
  }

  /**
   * Create high-performance pipeline for large streams
   */
  static createHighPerformancePipeline(): StreamingPipeline {
    const pipeline = new StreamingPipeline();
    
    pipeline.configureBuffer({
      lookBehindSize: 1024,
      lookAheadSize: 4096,
      encoding: 'utf-8',
      autoCompact: true
    });
    
    return pipeline;
  }
}