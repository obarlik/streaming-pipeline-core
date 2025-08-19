/**
 * Unit tests for CircularStreamBuffer
 * Focus: Memory management, boundary conditions, circular wrapping
 */

import { CircularStreamBuffer, TextCircularBuffer } from '../../src/framework/CircularStreamBuffer';
import { TestBinary, TestMarkdown, BufferConfigs } from '../fixtures/test-data';

describe('CircularStreamBuffer', () => {
  
  describe('Basic Operations', () => {
    let buffer: CircularStreamBuffer;
    
    beforeEach(() => {
      buffer = new CircularStreamBuffer(64, 128);
    });
    
    test('should initialize with correct configuration', () => {
      const state = buffer.getState();
      expect(state.size).toBe(64 + 1 + 128); // lookBehind + current + lookAhead
      expect(state.position).toBe(0);
      expect(state.available).toBe(0);
      expect(state.isEOF).toBe(false);
    });
    
    test('should fill and peek data correctly', () => {
      buffer.fill(TestBinary.simple);
      
      expect(buffer.peek()).toBe(0x48); // 'H'
      expect(buffer.canAdvance()).toBe(true);
    });
    
    test('should advance position correctly', () => {
      buffer.fill(TestBinary.simple);
      
      const initialPos = buffer.getState().globalPosition;
      const advanced = buffer.advance();
      
      expect(advanced).toBe(true);
      expect(buffer.getState().globalPosition).toBe(initialPos + 1);
    });
    
    test('should handle empty buffer', () => {
      expect(buffer.peek()).toBeNull();
      expect(buffer.canAdvance()).toBe(false);
      expect(buffer.advance()).toBe(false);
    });
  });
  
  describe('Lookahead/Lookbehind', () => {
    let buffer: CircularStreamBuffer;
    
    beforeEach(() => {
      buffer = new CircularStreamBuffer(10, 20);
      buffer.fill(TestBinary.simple);
    });
    
    test('should provide correct lookahead', () => {
      const ahead = buffer.lookAhead(3);
      expect(Array.from(ahead)).toEqual([0x65, 0x6C, 0x6C]); // "ell"
    });
    
    test('should provide correct lookbehind after advance', () => {
      buffer.advance(); // Move to 'e'
      buffer.advance(); // Move to 'l'
      
      const behind = buffer.lookBehind(2);
      expect(Array.from(behind)).toEqual([0x48, 0x65]); // "He"
    });
    
    test('should respect lookahead limits', () => {
      const ahead = buffer.lookAhead(100); // Request more than available
      expect(ahead.length).toBeLessThanOrEqual(20); // Max lookAhead size
    });
    
    test('should respect lookbehind limits', () => {
      // Advance several times
      for (let i = 0; i < 5; i++) buffer.advance();
      
      const behind = buffer.lookBehind(100); // Request more than limit
      expect(behind.length).toBeLessThanOrEqual(10); // Max lookBehind size
    });
  });
  
  describe('Memory Management', () => {
    test('should auto-compact when lookbehind exceeds limit', () => {
      const buffer = new CircularStreamBuffer(5, 10); // Small lookBehind
      buffer.fill(new Uint8Array(20).fill(0x41)); // Fill with 'A'
      
      // Advance past lookBehind limit
      for (let i = 0; i < 10; i++) {
        buffer.advance();
      }
      
      const state = buffer.getState();
      expect(state.canLookBehind).toBeLessThanOrEqual(5); // Should be compacted
    });
    
    test('should handle buffer refill correctly', () => {
      const buffer = new CircularStreamBuffer(10, 20);
      
      // Initial fill
      buffer.fill(TestBinary.simple);
      const state1 = buffer.getState();
      
      // Refill with more data
      buffer.fill(TestBinary.simple);
      const state2 = buffer.getState();
      
      expect(state2.available).toBeGreaterThan(state1.available);
    });
    
    test('should detect when refill is needed', () => {
      const buffer = new CircularStreamBuffer(10, 20);
      buffer.fill(TestBinary.simple);
      
      // Advance most of the way through
      for (let i = 0; i < 4; i++) {
        buffer.advance();
      }
      
      expect(buffer.needsRefill()).toBe(true);
    });
  });
  
  describe('Boundary Conditions', () => {
    test('should handle circular buffer wrapping', () => {
      const buffer = new CircularStreamBuffer(5, 10);
      const largeData = new Uint8Array(100).fill(0x41);
      
      buffer.fill(largeData);
      
      // Should not crash and should maintain bounded size
      const state = buffer.getState();
      expect(state.size).toBe(5 + 1 + 10); // Still bounded
    });
    
    test('should handle EOF correctly', () => {
      const buffer = new CircularStreamBuffer(10, 20);
      buffer.fill(TestBinary.simple);
      buffer.markEOF();
      
      // Advance to end
      while (buffer.canAdvance()) {
        buffer.advance();
      }
      
      expect(buffer.getState().isEOF).toBe(true);
      expect(buffer.canAdvance()).toBe(false);
    });
    
    test('should reset correctly', () => {
      const buffer = new CircularStreamBuffer(10, 20);
      buffer.fill(TestBinary.simple);
      buffer.advance();
      buffer.advance();
      
      buffer.reset();
      
      const state = buffer.getState();
      expect(state.globalPosition).toBe(0);
      expect(state.available).toBe(0);
      expect(state.isEOF).toBe(false);
    });
  });
});

describe('TextCircularBuffer', () => {
  
  describe('Text-Specific Operations', () => {
    let buffer: TextCircularBuffer;
    
    beforeEach(() => {
      buffer = new TextCircularBuffer(64, 128);
    });
    
    test('should handle UTF-8 text correctly', () => {
      buffer.fillString(TestMarkdown.unicode);
      
      expect(buffer.peekChar()).toBe('#');
      
      buffer.advance(); // Move to space
      buffer.advance(); // Move to 'T'
      
      expect(buffer.peekChar()).toBe('T');
    });
    
    test('should provide string lookahead/lookbehind', () => {
      buffer.fillString('Hello World');
      buffer.advance(); // Move to 'e'
      
      const ahead = buffer.lookAheadString(5);
      expect(ahead).toBe('llo W');
      
      const behind = buffer.lookBehindString(1);
      expect(behind).toBe('H');
    });
    
    test('should handle empty and whitespace strings', () => {
      buffer.fillString(TestMarkdown.whitespace);
      
      let charCount = 0;
      while (buffer.canAdvance()) {
        const char = buffer.peekChar();
        expect(char).toMatch(/\s/); // Should only be whitespace
        buffer.advance();
        charCount++;
      }
      
      expect(charCount).toBeGreaterThan(0);
    });
  });
  
  describe('Encoding Handling', () => {
    test('should handle different encodings', () => {
      const buffer = new TextCircularBuffer(64, 128, 'utf-8');
      buffer.fillString('🎉🚀');
      
      expect(buffer.peekChar()).toBe('🎉');
      buffer.advance();
      expect(buffer.peekChar()).toBe('🚀');
    });
  });
});

describe('Performance Tests', () => {
  
  test('should handle large buffers efficiently', () => {
    const buffer = new CircularStreamBuffer(1024, 2048);
    const startTime = Date.now();
    
    // Fill with large data
    buffer.fill(TestBinary.large);
    
    // Perform many operations
    for (let i = 0; i < 1000; i++) {
      buffer.peek();
      buffer.lookAhead(10);
      buffer.lookBehind(10);
      if (buffer.canAdvance()) buffer.advance();
    }
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(100); // Should be fast
  });
  
  test('should maintain constant memory usage', () => {
    const buffer = new CircularStreamBuffer(100, 200);
    
    // Fill buffer multiple times (simulating streaming)
    for (let i = 0; i < 10; i++) {
      buffer.fill(new Uint8Array(1000).fill(i));
      
      // Advance through some data
      for (let j = 0; j < 100; j++) {
        if (buffer.canAdvance()) buffer.advance();
      }
    }
    
    const state = buffer.getState();
    expect(state.size).toBe(100 + 1 + 200); // Should remain constant
  });
});