/**
 * Streaming interfaces - single buffer system
 * Universal approach with circular buffer and bounded lookahead/lookbehind
 */

import { CircularStreamBuffer, TextCircularBuffer, BufferState } from './CircularStreamBuffer';

// Stream position interface
export interface StreamPosition {
  readonly line: number;
  readonly column: number;
  readonly offset: number;
}

// Core streaming output unit (unchanged)
export interface StreamChunk<TData = any> {
  readonly type: string;
  readonly content: string;
  readonly data?: TData;
  readonly position?: StreamPosition;
  readonly metadata?: Record<string, any>;
}

// Unified streaming context with single buffer
export interface StreamingContext {
  readonly buffer: CircularStreamBuffer | TextCircularBuffer;
  readonly position: StreamPosition;
  readonly bufferState: BufferState;
  readonly encoding: string;
  readonly metadata?: Record<string, any>;
  
  // Helper flags derived from buffer
  readonly isEOF: boolean;
  readonly needsRefill: boolean;
  readonly canAdvance: boolean;
}

// Universal processor interface - single method
export interface IStreamProcessor<TData = any> {
  readonly name: string;
  readonly priority: number;
  
  // Universal processor method
  canProcess(context: StreamingContext): boolean;
  process(context: StreamingContext): {
    chunks: StreamChunk<TData>[];
    advance: number; // How many positions to advance (usually 1)
  };
  
  // Optional configuration
  readonly preferredLookBehind?: number;
  readonly preferredLookAhead?: number;
  readonly encoding?: string;
  
  // Optional state management
  getState?(): any;
  setState?(state: any): void;
  resetState?(): void;
}

// Stream renderer (unchanged)
export interface IStreamRenderer<TData = any, TOutput = string> {
  readonly format: string;
  renderChunk(chunk: StreamChunk<TData>): TOutput;
  renderChunks(chunks: StreamChunk<TData>[]): TOutput;
}

// Pipeline interface
export interface IStreamingPipeline<TOutput = string> {
  // Primary streaming API
  processStream(
    input: string | Uint8Array | ReadableStream,
    format: string,
    options?: StreamOptions
  ): AsyncIterable<TOutput>;
  
  // Processor management
  registerProcessor(processor: IStreamProcessor): void;
  registerRenderer(renderer: IStreamRenderer): void;
  
  // Buffer configuration
  configureBuffer(options: BufferOptions): void;
  
  // State management
  reset(): void;
}

// Stream options
export interface StreamOptions {
  // Buffer configuration
  readonly lookBehindSize?: number;    // Default: 512
  readonly lookAheadSize?: number;     // Default: 2048
  readonly encoding?: string;          // Default: 'utf-8'
  
  // Processing options
  readonly autoRefill?: boolean;       // Default: true
  readonly preserveState?: boolean;    // Default: false
  
  // Performance tuning
  readonly refillThreshold?: number;   // When to refill buffer (default: 50%)
  readonly chunkSize?: number;         // Output chunk size
  
  // Metadata
  readonly metadata?: Record<string, any>;
}

export interface BufferOptions {
  readonly lookBehindSize: number;
  readonly lookAheadSize: number;
  readonly encoding: string;
  readonly autoCompact: boolean;
}

// Stream events for monitoring
export interface StreamEvent {
  readonly type: 'chunk' | 'refill' | 'eof' | 'error';
  readonly data?: any;
  readonly position?: StreamPosition;
  readonly timestamp: number;
}

// Helper functions for processors
export class StreamingUtils {
  /**
   * Check if current position matches a pattern
   */
  static matchesPattern(context: StreamingContext, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return context.buffer instanceof TextCircularBuffer && 
             context.buffer.lookAheadString(pattern.length) === pattern;
    } else {
      // For regex, we need to get a reasonable chunk to test
      const testString = context.buffer instanceof TextCircularBuffer ? 
        context.buffer.lookAheadString(100) : '';
      return pattern.test(testString);
    }
  }

  /**
   * Get text content around current position
   */
  static getContext(context: StreamingContext, behind: number = 10, ahead: number = 10): string {
    if (!(context.buffer instanceof TextCircularBuffer)) return '';
    
    const beforeText = context.buffer.lookBehindString(behind);
    const currentChar = context.buffer.peekChar() || '';
    const afterText = context.buffer.lookAheadString(ahead);
    
    return beforeText + currentChar + afterText;
  }

  /**
   * Find next occurrence of pattern
   */
  static findNext(context: StreamingContext, pattern: string, maxDistance: number = 100): number {
    if (!(context.buffer instanceof TextCircularBuffer)) return -1;
    
    const searchText = context.buffer.lookAheadString(maxDistance);
    return searchText.indexOf(pattern);
  }

  /**
   * Check if current position is at word boundary
   */
  static isWordBoundary(context: StreamingContext): boolean {
    if (!(context.buffer instanceof TextCircularBuffer)) return false;
    
    const current = context.buffer.peekChar();
    const before = context.buffer.lookBehindString(1);
    
    if (!current) return true;
    
    const isCurrentWord = /\w/.test(current);
    const isBeforeWord = before && /\w/.test(before);
    
    return isCurrentWord !== isBeforeWord;
  }
}

/**
 * Base processor class with common functionality
 */
export abstract class BaseStreamProcessor implements IStreamProcessor {
  abstract readonly name: string;
  abstract readonly priority: number;
  
  readonly preferredLookBehind: number = 64;
  readonly preferredLookAhead: number = 256;
  readonly encoding: string = 'utf-8';

  abstract canProcess(context: StreamingContext): boolean;
  abstract process(context: StreamingContext): {
    chunks: StreamChunk[];
    advance: number;
  };

  // Helper method to create chunks
  protected createChunk(
    type: string,
    content: string,
    data?: any,
    position?: StreamPosition
  ): StreamChunk {
    return {
      type,
      content,
      data,
      position,
      metadata: { processor: this.name }
    };
  }

  // State management (optional)
  getState?(): any;
  setState?(state: any): void;
  resetState?(): void;
}