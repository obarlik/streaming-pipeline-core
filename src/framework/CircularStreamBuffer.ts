/**
 * Memory-efficient circular buffer for streaming with bounded lookahead/lookbehind
 */

import { StreamPosition } from './streaming-interfaces';

export interface BufferState {
  readonly size: number;
  readonly position: number;
  readonly available: number;
  readonly canLookBehind: number;
  readonly canLookAhead: number;
  readonly isEOF: boolean;
  readonly globalPosition: number;
}

export class CircularStreamBuffer {
  private buffer: Uint8Array;
  private head: number = 0;              // Write position
  private tail: number = 0;              // Read position
  private current: number = 0;           // Current processing position
  private globalPos: number = 0;         // Total stream position
  private eof: boolean = false;
  private filled: number = 0;            // How much data is in buffer

  constructor(
    private maxLookBehind: number = 512,
    private maxLookAhead: number = 2048,
    private encoding: string = 'utf8'
  ) {
    // Total buffer size = lookBehind + current + lookAhead
    const totalSize = maxLookBehind + 1 + maxLookAhead;
    this.buffer = new Uint8Array(totalSize);
  }

  /**
   * Get current byte/character at processing position
   */
  peek(): number | null {
    if (this.filled === 0) return null;
    return this.buffer[this.current];
  }

  /**
   * Look behind up to maxLookBehind distance
   */
  lookBehind(distance: number): Uint8Array {
    const actualDistance = Math.min(distance, this.maxLookBehind);
    const availableBehind = this.getAvailableBehind();
    const lookDistance = Math.min(actualDistance, availableBehind);
    
    if (lookDistance === 0) return new Uint8Array(0);
    
    const start = (this.current - lookDistance + this.buffer.length) % this.buffer.length;
    const result = new Uint8Array(lookDistance);
    
    for (let i = 0; i < lookDistance; i++) {
      result[i] = this.buffer[(start + i) % this.buffer.length];
    }
    
    return result;
  }

  /**
   * Look ahead up to maxLookAhead distance
   */
  lookAhead(distance: number): Uint8Array {
    const actualDistance = Math.min(distance, this.maxLookAhead);
    const availableAhead = this.getAvailableAhead();
    const lookDistance = Math.min(actualDistance, availableAhead);
    
    if (lookDistance === 0) return new Uint8Array(0);
    
    const result = new Uint8Array(lookDistance);
    
    for (let i = 0; i < lookDistance; i++) {
      const pos = (this.current + 1 + i) % this.buffer.length;
      result[i] = this.buffer[pos];
    }
    
    return result;
  }

  /**
   * Advance processing position by one
   */
  advance(): boolean {
    if (!this.canAdvance()) return false;
    
    this.current = (this.current + 1) % this.buffer.length;
    this.globalPos++;
    
    // Auto-compact if we've moved too far ahead
    this.autoCompact();
    
    return true;
  }

  /**
   * Check if we can advance
   */
  canAdvance(): boolean {
    return this.getAvailableAhead() > 0 || this.eof;
  }

  /**
   * Fill buffer with new streaming data
   */
  fill(data: Uint8Array): void {
    for (let i = 0; i < data.length && this.filled < this.buffer.length; i++) {
      this.buffer[this.head] = data[i];
      this.head = (this.head + 1) % this.buffer.length;
      this.filled++;
    }
  }

  /**
   * Mark end of stream
   */
  markEOF(): void {
    this.eof = true;
  }

  /**
   * Get buffer state information
   */
  getState(): BufferState {
    return {
      size: this.buffer.length,
      position: this.current,
      available: this.filled,
      canLookBehind: this.getAvailableBehind(),
      canLookAhead: this.getAvailableAhead(),
      isEOF: this.eof,
      globalPosition: this.globalPos
    };
  }

  /**
   * Get current position in stream coordinates
   */
  getStreamPosition(): StreamPosition {
    // Calculate line/column from global position
    // This would need to track newlines for accurate line/column
    return {
      line: 0, // TODO: implement line tracking
      column: 0, // TODO: implement column tracking  
      offset: this.globalPos
    };
  }

  /**
   * Check if buffer needs more data
   */
  needsRefill(): boolean {
    return !this.eof && this.getAvailableAhead() < this.maxLookAhead / 2;
  }

  /**
   * Clear buffer and reset
   */
  reset(): void {
    this.head = 0;
    this.tail = 0;
    this.current = 0;
    this.globalPos = 0;
    this.eof = false;
    this.filled = 0;
    this.buffer.fill(0);
  }

  // Private helper methods

  private getAvailableBehind(): number {
    if (this.current >= this.tail) {
      return this.current - this.tail;
    } else {
      return this.current + (this.buffer.length - this.tail);
    }
  }

  private getAvailableAhead(): number {
    if (this.head > this.current) {
      return this.head - this.current - 1;
    } else if (this.head < this.current) {
      return (this.buffer.length - this.current - 1) + this.head;
    } else {
      return this.filled > 0 ? this.buffer.length - 1 : 0;
    }
  }

  private autoCompact(): void {
    // Move tail forward if we have too much lookBehind data
    const behindDistance = this.getAvailableBehind();
    if (behindDistance > this.maxLookBehind) {
      const excess = behindDistance - this.maxLookBehind;
      this.tail = (this.tail + excess) % this.buffer.length;
      this.filled -= excess;
    }
  }
}

/**
 * String-aware circular buffer for text processing
 */
export class TextCircularBuffer extends CircularStreamBuffer {
  private decoder: TextDecoder;
  
  constructor(
    maxLookBehind: number = 512,
    maxLookAhead: number = 2048,
    encoding: string = 'utf-8'
  ) {
    super(maxLookBehind, maxLookAhead, encoding);
    this.decoder = new TextDecoder(encoding);
  }

  /**
   * Get current character as string
   */
  peekChar(): string | null {
    const byte = this.peek();
    if (byte === null) return null;
    return this.decoder.decode(new Uint8Array([byte]));
  }

  /**
   * Look behind as string
   */
  lookBehindString(distance: number): string {
    const bytes = this.lookBehind(distance);
    return this.decoder.decode(bytes);
  }

  /**
   * Look ahead as string  
   */
  lookAheadString(distance: number): string {
    const bytes = this.lookAhead(distance);
    return this.decoder.decode(bytes);
  }

  /**
   * Fill with string data
   */
  fillString(text: string): void {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    this.fill(bytes);
  }
}