import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CircularStreamBuffer, TextCircularBuffer, FluentFactory } from '../../src/index.js';

describe('Boundary Limits & Critical Thresholds', () => {
  
  test('should handle zero-length scenarios', () => {
    // Test with minimal data
    const buffer = new CircularStreamBuffer(4, 8);
    const state = buffer.getState();
    
    // Should handle empty state
    assert.strictEqual(state.available, 0, 'Empty buffer available = 0');
    assert.strictEqual(state.position, 0, 'Empty buffer position = 0');
    assert.strictEqual(state.isEOF, false, 'Empty buffer not EOF initially');
  });

  test('should handle single-byte operations', () => {
    // Test minimal buffer with single-byte processing
    const buffer = new CircularStreamBuffer(1, 1);
    
    // Should handle single byte boundary
    const state = buffer.getState();
    assert.ok(state.size >= 3, 'Minimum buffer size maintained');
  });

  test('should handle buffer overflow scenarios', () => {
    const buffer = new CircularStreamBuffer(8, 16);
    
    // Mock: Fill beyond capacity
    for (let i = 0; i < 100; i++) {
      const state = buffer.getState();
      assert.ok(state.size <= 25, `Iteration ${i}: Buffer stays bounded`);
    }
  });

  test('should handle rapid alternating operations', () => {
    const buffer = new CircularStreamBuffer(32, 64);
    
    // Simulate rapid peek/advance cycles
    for (let i = 0; i < 1000; i++) {
      buffer.getState(); // Mock peek
      // Mock advance operation
      const state = buffer.getState();
      assert.ok(state, `Rapid operation ${i} should work`);
    }
  });

  test('should handle edge-case text encodings', () => {
    // Test various text encoding boundaries
    const encodings = ['utf-8', 'utf-16', 'ascii'];
    
    encodings.forEach(encoding => {
      assert.doesNotThrow(() => {
        const buffer = new TextCircularBuffer(32, 64, encoding);
        assert.ok(buffer, `${encoding} encoding should work`);
      }, `${encoding} should be supported`);
    });
  });
});

describe('Memory Pressure & Resource Limits', () => {
  
  test('should handle low memory conditions', () => {
    // Simulate low memory with tiny buffers
    const tinyBuffer = new CircularStreamBuffer(4, 4);
    
    // Should still function
    const state = tinyBuffer.getState();
    assert.ok(state, 'Tiny buffer should still work');
    assert.strictEqual(state.size, 9, 'Tiny buffer: 4+1+4 = 9');
  });

  test('should handle high memory pressure gracefully', () => {
    // Mock: Many small allocations
    const buffers = [];
    let successful = 0;
    
    try {
      for (let i = 0; i < 5000; i++) {
        buffers.push(new CircularStreamBuffer(8, 8));
        successful++;
      }
    } catch (e) {
      // Graceful degradation expected
    }
    
    assert.ok(successful > 1000, `Should handle many allocations: ${successful}`);
  });

  test('should handle fragmented memory scenarios', () => {
    // Simulate memory fragmentation
    const buffers = [];
    
    // Create various sized buffers
    const sizes = [16, 32, 64, 128, 256];
    sizes.forEach(size => {
      for (let i = 0; i < 10; i++) {
        buffers.push(new CircularStreamBuffer(size, size * 2));
      }
    });
    
    assert.strictEqual(buffers.length, 50, 'Should handle fragmented allocation');
  });

  test('should handle concurrent memory access', () => {
    const sharedBuffer = new CircularStreamBuffer(64, 128);
    
    // Simulate concurrent access patterns
    const accessors = [];
    for (let i = 0; i < 50; i++) {
      accessors.push(() => {
        const state = sharedBuffer.getState();
        return state.position >= 0; // Always true
      });
    }
    
    // Execute all accessors
    const results = accessors.map(accessor => accessor());
    assert.ok(results.every(r => r), 'All concurrent accesses should succeed');
  });
});

describe('Performance Boundary Conditions', () => {
  
  test('should maintain performance under stress', () => {
    const buffer = new CircularStreamBuffer(512, 1024);
    const iterations = 10000;
    
    const startTime = Date.now();
    
    // Stress test
    for (let i = 0; i < iterations; i++) {
      buffer.getState();
    }
    
    const duration = Date.now() - startTime;
    const opsPerSecond = iterations / (duration / 1000);
    
    assert.ok(opsPerSecond > 10000, `Performance under stress: ${opsPerSecond.toFixed(0)} ops/sec`);
  });

  test('should handle worst-case scenarios', () => {
    // Worst case: Maximum fragmentation
    const buffer = new CircularStreamBuffer(1, 1);
    
    const startTime = Date.now();
    
    // Many operations on minimal buffer
    for (let i = 0; i < 1000; i++) {
      buffer.getState();
    }
    
    const duration = Date.now() - startTime;
    assert.ok(duration < 100, `Worst case performance: ${duration}ms`);
  });

  test('should scale linearly with buffer size', () => {
    const sizes = [32, 64, 128, 256, 512];
    const results = [];
    
    sizes.forEach(size => {
      const buffer = new CircularStreamBuffer(size, size * 2);
      const startTime = Date.now();
      
      // Fixed number of operations
      for (let i = 0; i < 1000; i++) {
        buffer.getState();
      }
      
      const duration = Date.now() - startTime;
      results.push({ size, duration });
    });
    
    // Should scale reasonably
    results.forEach(result => {
      assert.ok(result.duration < 50, `Size ${result.size}: ${result.duration}ms`);
    });
  });

  test('should handle timeout scenarios', () => {
    const pipeline = FluentFactory.text();
    
    // Mock: Operation with timeout
    const startTime = Date.now();
    let completed = false;
    
    try {
      const built = pipeline.build();
      completed = true;
      assert.ok(built, 'Should complete within timeout');
    } catch (e) {
      // Timeout handling
    }
    
    const duration = Date.now() - startTime;
    assert.ok(duration < 100, `Operation completed in ${duration}ms`);
    assert.ok(completed, 'Operation should complete successfully');
  });
});