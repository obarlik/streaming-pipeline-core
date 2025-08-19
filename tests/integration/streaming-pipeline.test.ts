/**
 * Integration tests for StreamingPipeline
 * Focus: End-to-end processing, processor coordination, real streaming scenarios
 */

import { StreamingPipeline, PipelineFactory } from '../../src/orchestrator/StreamingPipeline';
import { MarkdownProcessor, HTMLRenderer } from '../../src/examples/MarkdownProcessor';
import { TestMarkdown, ExpectedResults, BufferConfigs } from '../fixtures/test-data';

describe('StreamingPipeline Integration', () => {
  
  describe('Basic Pipeline Operations', () => {
    let pipeline: StreamingPipeline;
    let processor: MarkdownProcessor;
    let renderer: HTMLRenderer;
    
    beforeEach(() => {
      pipeline = new StreamingPipeline();
      processor = new MarkdownProcessor();
      renderer = new HTMLRenderer();
      
      pipeline.registerProcessor(processor);
      pipeline.registerRenderer(renderer);
    });
    
    test('should process simple markdown correctly', async () => {
      const results: string[] = [];
      
      for await (const output of pipeline.processStream(TestMarkdown.simple, 'html')) {
        results.push(output);
      }
      
      const combined = results.join('');
      expect(combined).toContain('<h1>Hello World</h1>');
      expect(combined).toContain('This is a simple test.');
    });
    
    test('should handle complex markdown features', async () => {
      const results: string[] = [];
      
      for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
        results.push(output);
      }
      
      const combined = results.join('');
      
      // Check for various markdown elements
      expect(combined).toContain('<h1>Main Title</h1>');
      expect(combined).toContain('<h2>Subheading</h2>');
      expect(combined).toContain('<strong>bold text</strong>');
      expect(combined).toContain('<em>italic text</em>');
      expect(combined).toContain('<li>First list item</li>');
      expect(combined).toContain('<code>inline code</code>');
      expect(combined).toContain('<pre><code class="language-javascript">');
    });
    
    test('should stream results incrementally', async () => {
      const results: string[] = [];
      const timestamps: number[] = [];
      
      for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
        results.push(output);
        timestamps.push(Date.now());
      }
      
      expect(results.length).toBeGreaterThan(1); // Should produce multiple chunks
      
      // Check that results come incrementally (not all at once)
      if (timestamps.length > 1) {
        const maxGap = Math.max(...timestamps.slice(1).map((t, i) => t - timestamps[i]));
        expect(maxGap).toBeLessThan(100); // Should be streaming, not batch
      }
    });
    
    test('should handle empty input gracefully', async () => {
      const results: string[] = [];
      
      for await (const output of pipeline.processStream('', 'html')) {
        results.push(output);
      }
      
      expect(results.length).toBe(0); // No output for empty input
    });
  });
  
  describe('Buffer Configuration Impact', () => {
    
    test('should work with different buffer sizes', async () => {
      for (const [name, config] of Object.entries(BufferConfigs)) {
        const pipeline = PipelineFactory.createTextPipeline(config);
        pipeline.registerProcessor(new MarkdownProcessor());
        pipeline.registerRenderer(new HTMLRenderer());
        
        const results: string[] = [];
        
        for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
          results.push(output);
        }
        
        const combined = results.join('');
        expect(combined).toContain('<h1>Main Title</h1>');
        expect(combined.length).toBeGreaterThan(0);
      }
    });
    
    test('should handle large content with small buffers', async () => {
      const pipeline = PipelineFactory.createTextPipeline(BufferConfigs.tiny);
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      const results: string[] = [];
      
      for await (const output of pipeline.processStream(TestMarkdown.large, 'html')) {
        results.push(output);
      }
      
      expect(results.length).toBeGreaterThan(0);
      // Should handle large content without crashing
    });
  });
  
  describe('Error Handling', () => {
    
    test('should handle missing renderer gracefully', async () => {
      const pipeline = new StreamingPipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      // No renderer registered
      
      await expect(async () => {
        for await (const output of pipeline.processStream(TestMarkdown.simple, 'html')) {
          // Should throw error
        }
      }).rejects.toThrow('No renderer found for format: html');
    });
    
    test('should continue processing after processor errors', async () => {
      class ErrorProcessor extends MarkdownProcessor {
        process(context: any) {
          if (context.buffer.peekChar() === 'T') {
            throw new Error('Test error');
          }
          return super.process(context);
        }
      }
      
      const pipeline = new StreamingPipeline();
      pipeline.registerProcessor(new ErrorProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      const results: string[] = [];
      
      // Should not crash, should continue processing
      for await (const output of pipeline.processStream(TestMarkdown.simple, 'html')) {
        results.push(output);
      }
      
      expect(results.length).toBeGreaterThan(0); // Should produce some output
    });
  });
  
  describe('Multiple Processors', () => {
    
    test('should respect processor priority', async () => {
      class HighPriorityProcessor extends MarkdownProcessor {
        priority = 20; // Higher than default 10
        
        process(context: any) {
          const char = context.buffer.peekChar();
          if (char === '#') {
            return {
              chunks: [{ type: 'priority-heading', content: 'High Priority', data: {} }],
              advance: 1
            };
          }
          return { chunks: [], advance: 1 };
        }
      }
      
      const pipeline = new StreamingPipeline();
      pipeline.registerProcessor(new MarkdownProcessor()); // Priority 10
      pipeline.registerProcessor(new HighPriorityProcessor()); // Priority 20
      pipeline.registerRenderer(new HTMLRenderer());
      
      const results: string[] = [];
      
      for await (const output of pipeline.processStream('# Test', 'html')) {
        results.push(output);
      }
      
      const combined = results.join('');
      expect(combined).toContain('priority-heading'); // High priority should win
    });
  });
  
  describe('State Management', () => {
    
    test('should reset pipeline state correctly', async () => {
      const pipeline = new StreamingPipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      // Process some content
      const results1: string[] = [];
      for await (const output of pipeline.processStream(TestMarkdown.simple, 'html')) {
        results1.push(output);
      }
      
      // Reset and process again
      pipeline.reset();
      
      const results2: string[] = [];
      for await (const output of pipeline.processStream(TestMarkdown.simple, 'html')) {
        results2.push(output);
      }
      
      expect(results1.join('')).toBe(results2.join('')); // Should be identical
    });
  });
  
  describe('Real-world Scenarios', () => {
    
    test('should handle streaming from ReadableStream', async () => {
      const pipeline = PipelineFactory.createTextPipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      // Create a readable stream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('# Streaming '));
          controller.enqueue(encoder.encode('Test\n\n'));
          controller.enqueue(encoder.encode('**Bold** text.'));
          controller.close();
        }
      });
      
      const results: string[] = [];
      
      for await (const output of pipeline.processStream(stream, 'html')) {
        results.push(output);
      }
      
      const combined = results.join('');
      expect(combined).toContain('<h1>Streaming Test</h1>');
      expect(combined).toContain('<strong>Bold</strong>');
    });
    
    test('should handle binary data input', async () => {
      const pipeline = PipelineFactory.createBinaryPipeline();
      
      // Simple binary processor that converts to hex
      class HexProcessor {
        name = 'hex';
        priority = 10;
        
        canProcess() { return true; }
        
        process(context: any) {
          const byte = context.buffer.peek();
          if (byte === null) return { chunks: [], advance: 0 };
          
          return {
            chunks: [{
              type: 'hex',
              content: byte.toString(16).padStart(2, '0'),
              data: { byte }
            }],
            advance: 1
          };
        }
      }
      
      // Simple hex renderer
      class HexRenderer {
        format = 'hex';
        
        renderChunk(chunk: any) {
          return chunk.content + ' ';
        }
        
        renderChunks(chunks: any[]) {
          return chunks.map(c => this.renderChunk(c)).join('');
        }
      }
      
      pipeline.registerProcessor(new HexProcessor());
      pipeline.registerRenderer(new HexRenderer());
      
      const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
      const results: string[] = [];
      
      for await (const output of pipeline.processStream(testData, 'hex')) {
        results.push(output);
      }
      
      const combined = results.join('');
      expect(combined).toBe('48 65 6c 6c 6f ');
    });
  });
});