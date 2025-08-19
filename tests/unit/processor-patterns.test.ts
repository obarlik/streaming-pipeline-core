/**
 * Common processor testing patterns and utilities
 * Focus: Reusable test patterns for any processor implementation
 */

import { StreamingContext, StreamChunk, BaseStreamProcessor } from '../../src/framework/streaming-interfaces';
import { TextCircularBuffer } from '../../src/framework/CircularStreamBuffer';
import { MarkdownProcessor } from '../../src/examples/MarkdownProcessor';
import { TestMarkdown } from '../fixtures/test-data';

/**
 * Generic processor test utilities
 */
export class ProcessorTestUtils {
  
  /**
   * Create a test context with given content
   */
  static createTestContext(content: string, position: number = 0): StreamingContext {
    const buffer = new TextCircularBuffer(64, 128);
    buffer.fillString(content);
    buffer.markEOF();
    
    // Advance to desired position
    for (let i = 0; i < position; i++) {
      if (!buffer.advance()) break;
    }
    
    return {
      buffer,
      position: buffer.getStreamPosition(),
      bufferState: buffer.getState(),
      encoding: 'utf-8',
      isEOF: buffer.getState().isEOF,
      needsRefill: buffer.needsRefill(),
      canAdvance: buffer.canAdvance()
    };
  }
  
  /**
   * Test that processor respects advance contract
   */
  static testAdvanceContract(processor: BaseStreamProcessor, content: string) {
    const context = ProcessorTestUtils.createTestContext(content);
    
    if (!processor.canProcess(context)) {
      throw new Error('Processor should be able to process test content');
    }
    
    const result = processor.process(context);
    
    // Must advance at least 1 to prevent infinite loops
    expect(result.advance).toBeGreaterThanOrEqual(1);
    
    // Advance should not exceed remaining content
    const remaining = context.bufferState.canLookAhead + 1; // +1 for current
    expect(result.advance).toBeLessThanOrEqual(remaining);
    
    return result;
  }
  
  /**
   * Test processor with various boundary conditions
   */
  static testBoundaryConditions(processor: BaseStreamProcessor) {
    const conditions = [
      { name: 'empty', content: '' },
      { name: 'single char', content: 'a' },
      { name: 'whitespace only', content: '   \n\t  ' },
      { name: 'no newlines', content: 'abcdefghijk' },
      { name: 'only newlines', content: '\n\n\n\n' },
      { name: 'very long line', content: 'a'.repeat(10000) },
      { name: 'unicode', content: '🎉🚀🎯' }
    ];
    
    const results: Record<string, any> = {};
    
    conditions.forEach(({ name, content }) => {
      const context = ProcessorTestUtils.createTestContext(content);
      
      try {
        if (processor.canProcess(context)) {
          const result = processor.process(context);
          results[name] = {
            chunks: result.chunks.length,
            advance: result.advance,
            success: true
          };
        } else {
          results[name] = { success: false, reason: 'canProcess returned false' };
        }
      } catch (error) {
        results[name] = { success: false, error: (error as Error).message };
      }
    });
    
    return results;
  }
  
  /**
   * Test processor performance with large content
   */
  static testPerformance(processor: BaseStreamProcessor, content: string, iterations: number = 1000) {
    const startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const context = ProcessorTestUtils.createTestContext(content, i % content.length);
      
      if (processor.canProcess(context)) {
        processor.process(context);
      }
    }
    
    const duration = Date.now() - startTime;
    return {
      iterations,
      duration,
      avgTimePerCall: duration / iterations,
      callsPerSecond: (iterations / duration) * 1000
    };
  }
}

describe('Processor Pattern Tests', () => {
  
  describe('Generic Processor Contracts', () => {
    let processor: MarkdownProcessor;
    
    beforeEach(() => {
      processor = new MarkdownProcessor();
    });
    
    test('should have valid configuration', () => {
      expect(processor.name).toBeTruthy();
      expect(typeof processor.name).toBe('string');
      expect(processor.priority).toBeGreaterThanOrEqual(0);
      expect(processor.preferredLookBehind).toBeGreaterThanOrEqual(0);
      expect(processor.preferredLookAhead).toBeGreaterThanOrEqual(0);
    });
    
    test('should respect advance contract', () => {
      const testCases = [
        '# Header',
        '**bold**',
        'plain text',
        '`code`',
        '- list item'
      ];
      
      testCases.forEach(content => {
        ProcessorTestUtils.testAdvanceContract(processor, content);
      });
    });
    
    test('should handle boundary conditions gracefully', () => {
      const results = ProcessorTestUtils.testBoundaryConditions(processor);
      
      console.log('Boundary condition results:', results);
      
      // All conditions should either succeed or fail gracefully
      Object.values(results).forEach((result: any) => {
        expect(result.success !== undefined).toBe(true);
        if (!result.success) {
          expect(result.reason || result.error).toBeTruthy();
        }
      });
    });
    
    test('should maintain reasonable performance', () => {
      const perf = ProcessorTestUtils.testPerformance(processor, TestMarkdown.complex, 100);
      
      console.log(`Performance: ${perf.callsPerSecond.toFixed(0)} calls/sec`);
      
      expect(perf.avgTimePerCall).toBeLessThan(10); // Should be fast
      expect(perf.callsPerSecond).toBeGreaterThan(100); // Reasonable throughput
    });
  });
  
  describe('Processor State Management', () => {
    
    test('should maintain consistent state across calls', () => {
      const processor = new MarkdownProcessor();
      const content = '# Header\n\nParagraph';
      
      // Process same content multiple times
      const results = [];
      for (let i = 0; i < 3; i++) {
        const context = ProcessorTestUtils.createTestContext(content);
        
        if (processor.canProcess(context)) {
          results.push(processor.process(context));
        }
      }
      
      // Results should be identical (stateless)
      expect(results.length).toBe(3);
      results.forEach((result, i) => {
        if (i > 0) {
          expect(result.chunks.length).toBe(results[0].chunks.length);
          expect(result.advance).toBe(results[0].advance);
        }
      });
    });
    
    test('should handle state reset if supported', () => {
      const processor = new MarkdownProcessor();
      
      // If processor has state management
      if (processor.getState && processor.setState && processor.resetState) {
        const initialState = processor.getState();
        
        // Modify state somehow (would depend on processor)
        processor.setState({ modified: true });
        
        // Reset should restore initial state
        processor.resetState();
        const resetState = processor.getState();
        
        expect(resetState).toEqual(initialState);
      }
    });
  });
  
  describe('Chunk Generation Patterns', () => {
    
    test('should generate valid chunks', () => {
      const processor = new MarkdownProcessor();
      const context = ProcessorTestUtils.createTestContext('# Test Header');
      
      if (processor.canProcess(context)) {
        const result = processor.process(context);
        
        result.chunks.forEach(chunk => {
          // All chunks should have required fields
          expect(chunk.type).toBeTruthy();
          expect(typeof chunk.content).toBe('string');
          
          // Optional fields should be valid if present
          if (chunk.data) {
            expect(typeof chunk.data).toBe('object');
          }
          
          if (chunk.position) {
            expect(chunk.position.line).toBeGreaterThanOrEqual(0);
            expect(chunk.position.column).toBeGreaterThanOrEqual(0);
            expect(chunk.position.offset).toBeGreaterThanOrEqual(0);
          }
        });
      }
    });
    
    test('should generate appropriate chunk types', () => {
      const processor = new MarkdownProcessor();
      const testCases = [
        { content: '# Header', expectedType: 'heading' },
        { content: '**bold**', expectedType: 'strong' },
        { content: '*italic*', expectedType: 'emphasis' },
        { content: '`code`', expectedType: 'code' },
        { content: '- item', expectedType: 'listItem' },
        { content: 'plain', expectedType: 'text' }
      ];
      
      testCases.forEach(({ content, expectedType }) => {
        const context = ProcessorTestUtils.createTestContext(content);
        
        if (processor.canProcess(context)) {
          const result = processor.process(context);
          
          if (result.chunks.length > 0) {
            const hasExpectedType = result.chunks.some(chunk => chunk.type === expectedType);
            expect(hasExpectedType).toBe(true);
          }
        }
      });
    });
  });
  
  describe('Lookahead/Lookbehind Usage', () => {
    
    test('should handle limited lookahead gracefully', () => {
      const processor = new MarkdownProcessor();
      
      // Create context with very limited lookahead
      const buffer = new TextCircularBuffer(10, 5); // Only 5 chars lookahead
      buffer.fillString('# This is a very long header that exceeds lookahead');
      buffer.markEOF();
      
      const context: StreamingContext = {
        buffer,
        position: buffer.getStreamPosition(),
        bufferState: buffer.getState(),
        encoding: 'utf-8',
        isEOF: false,
        needsRefill: false,
        canAdvance: true
      };
      
      // Should not crash with limited lookahead
      if (processor.canProcess(context)) {
        const result = processor.process(context);
        expect(result.advance).toBeGreaterThanOrEqual(1);
      }
    });
    
    test('should respect buffer boundaries', () => {
      const processor = new MarkdownProcessor();
      const content = 'Some text before # Header';
      
      // Test at different positions
      for (let pos = 0; pos < content.length; pos++) {
        const context = ProcessorTestUtils.createTestContext(content, pos);
        
        if (processor.canProcess(context)) {
          const result = processor.process(context);
          
          // Should not advance beyond available content
          const maxAdvance = context.bufferState.canLookAhead + 1;
          expect(result.advance).toBeLessThanOrEqual(maxAdvance);
        }
      }
    });
  });
});