# API Reference

Complete API documentation for the Streaming Pipeline Core with circular buffer system.

## Core Classes

### StreamingPipeline

The main pipeline orchestrator with circular buffer management.

```typescript
class StreamingPipeline implements IStreamingPipeline {
  // Primary streaming API
  async* processStream(
    input: string | Uint8Array | ReadableStream,
    format: string,
    options?: StreamOptions
  ): AsyncIterable<string>
  
  // Registration methods
  registerProcessor(processor: IStreamProcessor): void
  registerRenderer(renderer: IStreamRenderer): void
  
  // Buffer configuration
  configureBuffer(options: BufferOptions): void
  
  // State management
  reset(): void
}
```

#### processStream()

Primary API for streaming processing with circular buffer.

**Parameters:**
- `input`: Content to process (string, Uint8Array, or ReadableStream)
- `format`: Output format identifier (e.g., 'html', 'json')
- `options`: Optional streaming configuration

**Returns:** AsyncIterable<string> - Real-time streaming output

**Example:**
```typescript
for await (const output of pipeline.processStream(content, 'html', {
  lookBehindSize: 256,
  lookAheadSize: 1024,
  autoRefill: true
})) {
  console.log(output); // Process each chunk as it arrives
}
```

### CircularStreamBuffer

Memory-efficient circular buffer for streaming with bounded lookahead/lookbehind.

```typescript
class CircularStreamBuffer {
  constructor(
    maxLookBehind: number = 512,
    maxLookAhead: number = 2048,
    encoding: string = 'utf8'
  )
  
  // Core operations
  peek(): number | null
  advance(): boolean
  canAdvance(): boolean
  
  // Lookahead/lookbehind
  lookAhead(distance: number): Uint8Array
  lookBehind(distance: number): Uint8Array
  
  // Data management
  fill(data: Uint8Array): void
  markEOF(): void
  reset(): void
  
  // State inspection
  getState(): BufferState
  getStreamPosition(): StreamPosition
  needsRefill(): boolean
}
```

### TextCircularBuffer

Text-aware extension of CircularStreamBuffer with string methods.

```typescript
class TextCircularBuffer extends CircularStreamBuffer {
  constructor(
    maxLookBehind: number = 512,
    maxLookAhead: number = 2048,
    encoding: string = 'utf-8'
  )
  
  // Text-specific operations
  peekChar(): string | null
  lookAheadString(distance: number): string
  lookBehindString(distance: number): string
  fillString(text: string): void
}
```

### PipelineFactory

Factory methods for common pipeline configurations.

```typescript
class PipelineFactory {
  // Pre-configured pipelines
  static createTextPipeline(options?: {
    lookBehindSize?: number;
    lookAheadSize?: number;
    encoding?: string;
  }): StreamingPipeline
  
  static createBinaryPipeline(options?: {
    lookBehindSize?: number;
    lookAheadSize?: number;
  }): StreamingPipeline
  
  static createHighPerformancePipeline(): StreamingPipeline
}
```

## Interfaces

### IStreamProcessor

Universal processor interface with single process method.

```typescript
interface IStreamProcessor<TData = any> {
  readonly name: string
  readonly priority: number
  
  // Universal processor method
  canProcess(context: StreamingContext): boolean
  process(context: StreamingContext): {
    chunks: StreamChunk<TData>[]
    advance: number  // How many positions to advance
  }
  
  // Optional configuration
  readonly preferredLookBehind?: number
  readonly preferredLookAhead?: number
  readonly encoding?: string
  
  // Optional state management
  getState?(): any
  setState?(state: any): void
  resetState?(): void
}
```

### StreamingContext

Context provided to processors with circular buffer access.

```typescript
interface StreamingContext {
  readonly buffer: CircularStreamBuffer | TextCircularBuffer
  readonly position: StreamPosition
  readonly bufferState: BufferState
  readonly encoding: string
  readonly metadata?: Record<string, any>
  
  // Helper flags
  readonly isEOF: boolean
  readonly needsRefill: boolean
  readonly canAdvance: boolean
}
```

### StreamChunk

Output unit from processors.

```typescript
interface StreamChunk<TData = any> {
  readonly type: string
  readonly content: string
  readonly data?: TData
  readonly position?: StreamPosition
  readonly metadata?: Record<string, any>
}
```

### IStreamRenderer

Renderer interface for converting chunks to output format.

```typescript
interface IStreamRenderer<TData = any, TOutput = string> {
  readonly format: string
  
  renderChunk(chunk: StreamChunk<TData>): TOutput
  renderChunks(chunks: StreamChunk<TData>[]): TOutput
}
```

## Configuration Types

### StreamOptions

Options for streaming processing.

```typescript
interface StreamOptions {
  // Buffer configuration
  readonly lookBehindSize?: number     // Default: 512
  readonly lookAheadSize?: number      // Default: 2048
  readonly encoding?: string           // Default: 'utf-8'
  
  // Processing options
  readonly autoRefill?: boolean        // Default: true
  readonly preserveState?: boolean     // Default: false
  
  // Performance tuning
  readonly refillThreshold?: number    // Default: 50%
  readonly chunkSize?: number          // Output chunk size
  
  // Metadata
  readonly metadata?: Record<string, any>
}
```

### BufferOptions

Configuration for circular buffer behavior.

```typescript
interface BufferOptions {
  readonly lookBehindSize: number
  readonly lookAheadSize: number
  readonly encoding: string
  readonly autoCompact: boolean
}
```

### BufferState

Current state of the circular buffer.

```typescript
interface BufferState {
  readonly size: number           // Total buffer size
  readonly position: number       // Current position
  readonly available: number      // Available data
  readonly canLookBehind: number  // Available lookbehind
  readonly canLookAhead: number   // Available lookahead
  readonly isEOF: boolean         // End of stream
  readonly globalPosition: number // Absolute position
}
```

### StreamPosition

Position within the stream.

```typescript
interface StreamPosition {
  readonly line: number
  readonly column: number
  readonly offset: number
}
```

## Base Classes

### BaseStreamProcessor

Base class for implementing processors.

```typescript
abstract class BaseStreamProcessor implements IStreamProcessor {
  abstract readonly name: string
  abstract readonly priority: number
  
  readonly preferredLookBehind: number = 64
  readonly preferredLookAhead: number = 256
  readonly encoding: string = 'utf-8'

  abstract canProcess(context: StreamingContext): boolean
  abstract process(context: StreamingContext): {
    chunks: StreamChunk[]
    advance: number
  }

  // Helper method for creating chunks
  protected createChunk(
    type: string,
    content: string,
    data?: any,
    position?: StreamPosition
  ): StreamChunk
}
```

## Utility Classes

### StreamingUtils

Helper functions for common processor operations.

```typescript
class StreamingUtils {
  // Pattern matching
  static matchesPattern(context: StreamingContext, pattern: string | RegExp): boolean
  
  // Context helpers
  static getContext(context: StreamingContext, behind?: number, ahead?: number): string
  static findNext(context: StreamingContext, pattern: string, maxDistance?: number): number
  static isWordBoundary(context: StreamingContext): boolean
}
```

## Error Types

Common error types thrown by the system.

```typescript
class BufferOverflowError extends Error {
  constructor(bufferSize: number, requestedSize: number)
}

class EncodingError extends Error {
  constructor(encoding: string, position: number)
}

class PatternNotFoundError extends Error {
  constructor(pattern: string | Uint8Array)
}

class LookaheadExceededError extends Error {
  constructor(requested: number, available: number)
}
```

## Usage Patterns

### Basic Processing

```typescript
// Create and configure pipeline
const pipeline = PipelineFactory.createTextPipeline({
  lookBehindSize: 256,
  lookAheadSize: 1024
});

// Register components
pipeline.registerProcessor(new MyProcessor());
pipeline.registerRenderer(new MyRenderer());

// Process content
for await (const output of pipeline.processStream(content, 'format')) {
  // Handle output
}
```

### Custom Processor

```typescript
class CustomProcessor extends BaseStreamProcessor {
  readonly name = 'custom'
  readonly priority = 10
  
  canProcess(context: StreamingContext): boolean {
    return context.buffer.peekChar() === '#'
  }
  
  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer
    const ahead = buffer.lookAheadString(100)
    
    // Process pattern and return chunks
    return {
      chunks: [this.createChunk('heading', 'processed content')],
      advance: 5  // Move past processed content
    }
  }
}
```

### Memory Management

```typescript
// Configure for memory-constrained environment
const pipeline = PipelineFactory.createTextPipeline({
  lookBehindSize: 64,    // Minimal history
  lookAheadSize: 128     // Basic lookahead
});

// Configure for complex parsing
const complexPipeline = PipelineFactory.createTextPipeline({
  lookBehindSize: 1024,  // Rich context
  lookAheadSize: 4096    // Complex pattern matching
});
```

### Performance Optimization

```typescript
// High-performance configuration
const pipeline = PipelineFactory.createHighPerformancePipeline();

// Custom high-performance settings
pipeline.configureBuffer({
  lookBehindSize: 2048,
  lookAheadSize: 8192,
  encoding: 'utf-8',
  autoCompact: true
});
```