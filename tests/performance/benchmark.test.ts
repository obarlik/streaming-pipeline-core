/**
 * Performance benchmark tests
 * Focus: Throughput, latency, memory usage under various conditions
 */

import { StreamingPipeline, PipelineFactory } from '../../src/orchestrator/StreamingPipeline';
import { MarkdownProcessor, HTMLRenderer } from '../../src/examples/MarkdownProcessor';
import { TestMarkdown, PerformanceTargets, BufferConfigs } from '../fixtures/test-data';

describe('Performance Benchmarks', () => {
  
  describe('Throughput Tests', () => {
    
    test('should achieve minimum processing speed', async () => {
      const pipeline = PipelineFactory.createHighPerformancePipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      const testContent = TestMarkdown.large; // 20KB+ content
      const startTime = Date.now();
      
      let chunkCount = 0;
      for await (const output of pipeline.processStream(testContent, 'html')) {
        chunkCount++;
      }
      
      const duration = Date.now() - startTime;
      const charsPerSec = (testContent.length / duration) * 1000;
      
      console.log(`Throughput: ${Math.round(charsPerSec).toLocaleString()} chars/sec`);
      console.log(`Chunks: ${chunkCount}, Duration: ${duration}ms`);
      
      expect(charsPerSec).toBeGreaterThan(PerformanceTargets.minCharsPerSec);
    });
    
    test('should maintain performance with different buffer sizes', async () => {
      const results: Record<string, number> = {};
      
      for (const [name, config] of Object.entries(BufferConfigs)) {
        const pipeline = PipelineFactory.createTextPipeline(config);
        pipeline.registerProcessor(new MarkdownProcessor());
        pipeline.registerRenderer(new HTMLRenderer());
        
        const startTime = Date.now();
        
        for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
          // Process all chunks
        }
        
        const duration = Date.now() - startTime;
        results[name] = (TestMarkdown.complex.length / duration) * 1000;
      }
      
      console.log('Buffer size performance:');
      Object.entries(results).forEach(([name, speed]) => {
        console.log(`  ${name}: ${Math.round(speed).toLocaleString()} chars/sec`);
      });
      
      // All configurations should meet minimum performance
      Object.values(results).forEach(speed => {
        expect(speed).toBeGreaterThan(PerformanceTargets.minCharsPerSec);
      });
    });
  });
  
  describe('Latency Tests', () => {
    
    test('should produce first chunk quickly', async () => {
      const pipeline = PipelineFactory.createTextPipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      const startTime = Date.now();
      let firstChunkTime: number | null = null;
      
      for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
        if (firstChunkTime === null) {
          firstChunkTime = Date.now();
        }
        break; // Only measure first chunk
      }
      
      const latency = firstChunkTime! - startTime;
      console.log(`First chunk latency: ${latency}ms`);
      
      expect(latency).toBeLessThan(PerformanceTargets.maxFirstChunkLatency);
    });
    
    test('should maintain low average latency between chunks', async () => {
      const pipeline = PipelineFactory.createTextPipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      const chunkTimes: number[] = [];
      let lastTime = Date.now();
      
      for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
        const now = Date.now();
        chunkTimes.push(now - lastTime);
        lastTime = now;
      }
      
      const avgLatency = chunkTimes.reduce((a, b) => a + b, 0) / chunkTimes.length;
      console.log(`Average chunk latency: ${avgLatency.toFixed(2)}ms`);
      console.log(`Max chunk latency: ${Math.max(...chunkTimes)}ms`);
      
      expect(avgLatency).toBeLessThan(PerformanceTargets.maxAvgChunkLatency);
    });
  });
  
  describe('Memory Usage Tests', () => {
    
    test('should maintain bounded memory usage', async () => {
      const pipeline = PipelineFactory.createTextPipeline(BufferConfigs.large);
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      // Process very large content
      const largeContent = TestMarkdown.simple.repeat(1000); // ~50KB
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      for await (const output of pipeline.processStream(largeContent, 'html')) {
        // Process all chunks
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerChar = memoryIncrease / largeContent.length;
      
      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`Memory per char: ${memoryPerChar.toFixed(2)} bytes`);
      
      expect(memoryPerChar).toBeLessThan(PerformanceTargets.maxMemoryPerChar);
      expect(memoryIncrease).toBeLessThan(PerformanceTargets.maxTotalMemory);
    });
    
    test('should garbage collect efficiently', async () => {
      const pipeline = PipelineFactory.createTextPipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      const measurements: number[] = [];
      
      // Process multiple batches
      for (let i = 0; i < 10; i++) {
        for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
          // Process chunks
        }
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
        
        measurements.push(process.memoryUsage().heapUsed);
      }
      
      // Memory should not grow continuously
      const firstHalf = measurements.slice(0, 5);
      const secondHalf = measurements.slice(5);
      
      const avgFirst = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
      const avgSecond = secondHalf.reduce((a, b) => a + b) / secondHalf.length;
      
      const memoryGrowth = (avgSecond - avgFirst) / avgFirst;
      
      console.log(`Memory growth over 10 runs: ${(memoryGrowth * 100).toFixed(2)}%`);
      
      expect(memoryGrowth).toBeLessThan(0.5); // Should not grow more than 50%
    });
  });
  
  describe('Scalability Tests', () => {
    
    test('should handle multiple concurrent pipelines', async () => {
      const pipelineCount = 5;
      const pipelines = Array.from({ length: pipelineCount }, () => {
        const p = PipelineFactory.createTextPipeline();
        p.registerProcessor(new MarkdownProcessor());
        p.registerRenderer(new HTMLRenderer());
        return p;
      });
      
      const startTime = Date.now();
      
      // Process concurrently
      const promises = pipelines.map(async (pipeline, i) => {
        const results: string[] = [];
        for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
          results.push(output);
        }
        return results.length;
      });
      
      const chunkCounts = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      console.log(`${pipelineCount} concurrent pipelines: ${duration}ms`);
      console.log(`Chunks per pipeline: ${chunkCounts.join(', ')}`);
      
      // All pipelines should complete successfully
      chunkCounts.forEach(count => {
        expect(count).toBeGreaterThan(0);
      });
      
      // Concurrent processing should not be much slower than sequential
      const avgDuration = duration / pipelineCount;
      expect(avgDuration).toBeLessThan(100); // Should be reasonable
    });
    
    test('should handle very large documents efficiently', async () => {
      const pipeline = PipelineFactory.createHighPerformancePipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      // Create 1MB+ document
      const sections = Array.from({ length: 100 }, (_, i) => `
## Section ${i + 1}

This is section ${i + 1} with **bold** and *italic* text.

- Item A in section ${i + 1}
- Item B in section ${i + 1}

\`\`\`javascript
function section${i + 1}() {
  return "Section ${i + 1}";
}
\`\`\`
`).join('\n');
      
      const startTime = Date.now();
      let chunkCount = 0;
      
      for await (const output of pipeline.processStream(sections, 'html')) {
        chunkCount++;
        
        // Periodically check we're making progress
        if (chunkCount % 1000 === 0) {
          const elapsed = Date.now() - startTime;
          const rate = (chunkCount / elapsed) * 1000;
          expect(rate).toBeGreaterThan(100); // Should maintain reasonable rate
        }
      }
      
      const duration = Date.now() - startTime;
      const charsPerSec = (sections.length / duration) * 1000;
      
      console.log(`Large document: ${sections.length} chars, ${chunkCount} chunks, ${duration}ms`);
      console.log(`Rate: ${Math.round(charsPerSec).toLocaleString()} chars/sec`);
      
      expect(charsPerSec).toBeGreaterThan(PerformanceTargets.minCharsPerSec);
    });
  });
  
  describe('Stress Tests', () => {
    
    test('should handle rapid buffer refills', async () => {
      const pipeline = PipelineFactory.createTextPipeline(BufferConfigs.tiny); // Small buffers
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      // Create content that requires many buffer refills
      const content = 'x'.repeat(10000) + '\n# Header\n' + 'y'.repeat(10000);
      
      const startTime = Date.now();
      let chunkCount = 0;
      
      for await (const output of pipeline.processStream(content, 'html')) {
        chunkCount++;
      }
      
      const duration = Date.now() - startTime;
      
      console.log(`Buffer refill stress test: ${chunkCount} chunks, ${duration}ms`);
      
      expect(chunkCount).toBeGreaterThan(0);
      expect(duration).toBeLessThan(5000); // Should complete in reasonable time
    });
    
    test('should handle edge case content patterns', async () => {
      const pipeline = PipelineFactory.createTextPipeline();
      pipeline.registerProcessor(new MarkdownProcessor());
      pipeline.registerRenderer(new HTMLRenderer());
      
      const edgeCases = [
        '# '.repeat(1000), // Many incomplete headers
        '**'.repeat(500), // Many incomplete bolds
        '`'.repeat(1000), // Many incomplete codes
        TestMarkdown.edge_cases,
        TestMarkdown.unicode
      ];
      
      for (const content of edgeCases) {
        const startTime = Date.now();
        let chunkCount = 0;
        
        for await (const output of pipeline.processStream(content, 'html')) {
          chunkCount++;
        }
        
        const duration = Date.now() - startTime;
        
        // Should handle edge cases without crashing or hanging
        expect(duration).toBeLessThan(1000);
        expect(chunkCount).toBeGreaterThanOrEqual(0);
      }
    });
  });
});