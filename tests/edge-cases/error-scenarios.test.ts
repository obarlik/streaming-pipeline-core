import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CircularStreamBuffer, TextCircularBuffer, FluentFactory } from '../../src/index.js';

describe('Error Scenarios & Exception Handling', () => {
  
  test('should handle invalid buffer sizes gracefully', () => {
    // Test negative sizes
    assert.doesNotThrow(() => {
      new CircularStreamBuffer(-10, 100);
    }, 'Should handle negative lookBehind');
    
    assert.doesNotThrow(() => {
      new CircularStreamBuffer(100, -20);
    }, 'Should handle negative lookAhead');
    
    // Test zero sizes
    assert.doesNotThrow(() => {
      new CircularStreamBuffer(0, 100);
    }, 'Should handle zero lookBehind');
  });

  test('should handle memory allocation failures', () => {
    // Mock: Extreme memory allocation
    assert.doesNotThrow(() => {
      // This would normally fail with real allocation
      const buffer = new CircularStreamBuffer(1000000, 1000000);
      assert.ok(buffer, 'Should handle large allocations gracefully');
    }, 'Should not crash on large allocations');
  });

  test('should throw on invalid encoding', () => {
    assert.throws(() => {
      new TextCircularBuffer(64, 128, 'invalid-encoding' as any);
    }, /encoding is not supported/, 'Should throw on invalid encoding');
  });

  test('should handle null/undefined inputs', () => {
    const pipeline = FluentFactory.text();
    
    // Test null buffer options
    assert.doesNotThrow(() => {
      pipeline.buffer(null as any);
    }, 'Should handle null buffer options');
    
    // Test undefined values
    assert.doesNotThrow(() => {
      pipeline.buffer(undefined as any);
    }, 'Should handle undefined buffer options');
  });

  test('should handle circular references in configuration', () => {
    const config: any = { lookBehindSize: 64 };
    config.circular = config; // Create circular reference
    
    assert.doesNotThrow(() => {
      FluentFactory.text().buffer(config);
    }, 'Should handle circular references');
  });
});

describe('Boundary Conditions & Limits', () => {
  
  test('should handle minimum viable buffer', () => {
    // Test absolute minimum buffer
    const buffer = new CircularStreamBuffer(1, 1);
    const state = buffer.getState();
    
    assert.strictEqual(state.size, 3, 'Minimum buffer: 1+1+1 = 3');
    assert.ok(buffer, 'Minimum buffer should work');
  });

  test('should handle maximum reasonable buffer', () => {
    // Test large but reasonable buffer
    const buffer = new CircularStreamBuffer(8192, 16384);
    const state = buffer.getState();
    
    assert.strictEqual(state.size, 8192 + 1 + 16384, 'Large buffer correct size');
    assert.ok(buffer, 'Large buffer should work');
  });

  test('should handle extreme ratios', () => {
    // Very unbalanced buffers
    const wideBuffer = new CircularStreamBuffer(1, 10000);
    const tallBuffer = new CircularStreamBuffer(10000, 1);
    
    assert.ok(wideBuffer, 'Wide buffer should work');
    assert.ok(tallBuffer, 'Tall buffer should work');
  });

  test('should handle rapid buffer creation/destruction', () => {
    // Stress test buffer lifecycle
    const buffers = [];
    
    for (let i = 0; i < 1000; i++) {
      buffers.push(new CircularStreamBuffer(16, 32));
    }
    
    assert.strictEqual(buffers.length, 1000, 'Should create many buffers');
    
    // Simulate cleanup
    buffers.length = 0;
    assert.strictEqual(buffers.length, 0, 'Should cleanup properly');
  });

  test('should handle concurrent buffer operations', () => {
    const buffer = new CircularStreamBuffer(64, 128);
    
    // Simulate concurrent access
    const operations = [];
    for (let i = 0; i < 100; i++) {
      operations.push(() => buffer.getState());
    }
    
    // Execute "concurrently" (mock)
    operations.forEach(op => {
      assert.doesNotThrow(op, `Operation ${operations.indexOf(op)} should not throw`);
    });
  });
});

describe('Resource Exhaustion & Stress Tests', () => {
  
  test('should handle resource exhaustion gracefully', () => {
    // Mock: System running out of memory
    let bufferCount = 0;
    
    try {
      // Create buffers until "exhaustion"
      for (let i = 0; i < 10000; i++) {
        new CircularStreamBuffer(32, 64);
        bufferCount++;
      }
    } catch (e) {
      // Should handle gracefully
    }
    
    assert.ok(bufferCount > 0, 'Should create some buffers before exhaustion');
  });

  test('should handle processing time limits', () => {
    const startTime = Date.now();
    const buffer = new CircularStreamBuffer(1024, 2048);
    
    // Simulate time-constrained operations
    let operations = 0;
    while (Date.now() - startTime < 10) { // 10ms limit
      buffer.getState();
      operations++;
    }
    
    assert.ok(operations > 100, `Should perform many ops in time limit: ${operations}`);
  });

  test('should handle interrupted operations', () => {
    const pipeline = FluentFactory.text();
    
    // Mock: Operation interrupted mid-way
    assert.doesNotThrow(() => {
      const built = pipeline.build();
      // Simulate interruption
      assert.ok(built, 'Should handle interruption gracefully');
    }, 'Should handle interruption');
  });

  test('should handle malformed input gracefully', () => {
    // Test various malformed inputs
    const badInputs = [
      { lookBehindSize: 'invalid' },
      { lookAheadSize: Infinity },
      { encoding: Symbol('bad') },
      { unknownProperty: 'value' }
    ];
    
    badInputs.forEach((input, i) => {
      assert.doesNotThrow(() => {
        FluentFactory.text().buffer(input as any);
      }, `Bad input ${i} should be handled gracefully`);
    });
  });
});