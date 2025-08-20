import { StreamingPipeline, PipelineFactory } from '../orchestrator/StreamingPipeline';
import { IStreamProcessor, IStreamRenderer, BufferOptions } from '../framework/streaming-interfaces';

/**
 * 🌊 Fluent API for streaming pipeline configuration
 * Chain methods for easy setup: pipeline().buffer().processor().render()
 */
export class FluentPipeline {
  private pipeline: StreamingPipeline;

  constructor(pipeline?: StreamingPipeline) {
    this.pipeline = pipeline || new StreamingPipeline();
  }

  /** 📦 Configure circular buffer sizes */
  buffer(options: Partial<BufferOptions>): FluentPipeline {
    const fullOptions: BufferOptions = {
      lookBehindSize: 512,
      lookAheadSize: 2048,
      encoding: 'utf-8',
      autoCompact: true,
      ...options
    };
    this.pipeline.configureBuffer(fullOptions);
    return this;
  }

  /** ⚡ Add stream processor */
  processor(processor: IStreamProcessor): FluentPipeline {
    this.pipeline.registerProcessor(processor);
    return this;
  }

  /** 🎨 Add renderer for output format */
  renderer(renderer: IStreamRenderer): FluentPipeline {
    this.pipeline.registerRenderer(renderer);
    return this;
  }

  /** 🔄 Process stream with configured pipeline */
  async* stream(input: string | Uint8Array | ReadableStream, format: string): AsyncIterable<string> {
    yield* this.pipeline.processStream(input, format);
  }

  /** 📋 Get configured pipeline instance */
  build(): StreamingPipeline {
    return this.pipeline;
  }
}

/**
 * 🚀 Factory helpers for common configurations
 */
export class FluentFactory {
  /** 📝 Text processing with reasonable defaults */
  static text(): FluentPipeline {
    return new FluentPipeline(PipelineFactory.createTextPipeline());
  }

  /** 📊 Binary processing optimized */
  static binary(): FluentPipeline {
    return new FluentPipeline(PipelineFactory.createBinaryPipeline());
  }

  /** ⚡ High-performance for large content */
  static performance(): FluentPipeline {
    return new FluentPipeline(PipelineFactory.createHighPerformancePipeline());
  }

  /** 💾 Memory-constrained environments */
  static minimal(): FluentPipeline {
    return new FluentPipeline().buffer({ lookBehindSize: 32, lookAheadSize: 64 });
  }
}