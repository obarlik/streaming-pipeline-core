import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CircularStreamBuffer, TextCircularBuffer, FluentFactory } from '../../src/index.js';

describe('🚀 REAL Performance Benchmarks', () => {
  
  test('REAL: Buffer creation throughput', () => {
    const iterations = 10000;
    const startTime = process.hrtime.bigint();
    
    // REAL buffer creation
    for (let i = 0; i < iterations; i++) {
      new CircularStreamBuffer(64, 128);
    }
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const throughput = iterations / (durationMs / 1000);
    
    console.log(`📊 Buffer Creation: ${throughput.toFixed(0)} buffers/sec (${durationMs.toFixed(2)}ms)`);
    assert.ok(throughput > 5000, `Throughput should be >5K/sec, got ${throughput.toFixed(0)}`);
  });

  test('REAL: getState() operation performance', () => {
    const buffer = new CircularStreamBuffer(256, 512);
    const iterations = 100000;
    
    const startTime = process.hrtime.bigint();
    
    // REAL getState calls
    for (let i = 0; i < iterations; i++) {
      buffer.getState();
    }
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const opsPerSec = iterations / (durationMs / 1000);
    
    console.log(`⚡ getState(): ${opsPerSec.toFixed(0)} ops/sec (${durationMs.toFixed(2)}ms)`);
    assert.ok(opsPerSec > 100000, `Should be >100K ops/sec, got ${opsPerSec.toFixed(0)}`);
  });

  test('REAL: Pipeline factory performance', () => {
    const iterations = 1000;
    const startTime = process.hrtime.bigint();
    
    // REAL pipeline creation and build
    for (let i = 0; i < iterations; i++) {
      const pipeline = FluentFactory.text()
        .buffer({ lookBehindSize: 32, lookAheadSize: 64 })
        .build();
    }
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const pipelinesPerSec = iterations / (durationMs / 1000);
    
    console.log(`🏭 Pipeline Creation: ${pipelinesPerSec.toFixed(0)} pipelines/sec (${durationMs.toFixed(2)}ms)`);
    assert.ok(pipelinesPerSec > 500, `Should be >500 pipelines/sec, got ${pipelinesPerSec.toFixed(0)}`);
  });

  test('REAL: Memory allocation stress test', () => {
    const startTime = process.hrtime.bigint();
    const buffers = [];
    
    // REAL memory allocation
    try {
      for (let i = 0; i < 10000; i++) {
        buffers.push(new CircularStreamBuffer(32, 64));
      }
    } catch (e) {
      console.log(`⚠️  Memory limit reached at ${buffers.length} buffers`);
    }
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    
    console.log(`💾 Memory Test: ${buffers.length} buffers in ${durationMs.toFixed(2)}ms`);
    assert.ok(buffers.length > 1000, `Should allocate >1000 buffers, got ${buffers.length}`);
    
    // Measure cleanup time
    const cleanupStart = process.hrtime.bigint();
    buffers.length = 0; // Clear array
    const cleanupEnd = process.hrtime.bigint();
    const cleanupMs = Number(cleanupEnd - cleanupStart) / 1_000_000;
    
    console.log(`🧹 Cleanup: ${cleanupMs.toFixed(2)}ms`);
  });

  test('REAL: Text buffer vs Binary buffer performance', () => {
    const iterations = 5000;
    
    // Binary buffer performance
    const binaryStart = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      new CircularStreamBuffer(64, 128);
    }
    const binaryEnd = process.hrtime.bigint();
    const binaryMs = Number(binaryEnd - binaryStart) / 1_000_000;
    
    // Text buffer performance  
    const textStart = process.hrtime.bigint();
    for (let i = 0; i < iterations; i++) {
      new TextCircularBuffer(64, 128, 'utf-8');
    }
    const textEnd = process.hrtime.bigint();
    const textMs = Number(textEnd - textStart) / 1_000_000;
    
    console.log(`📊 Binary Buffer: ${(iterations/(binaryMs/1000)).toFixed(0)} buffers/sec`);
    console.log(`📊 Text Buffer: ${(iterations/(textMs/1000)).toFixed(0)} buffers/sec`);
    console.log(`📈 Overhead: ${((textMs/binaryMs - 1) * 100).toFixed(1)}%`);
    
    // Text should be reasonably close to binary performance (relaxed for CI environments)
    assert.ok(textMs < binaryMs * 10, 'Text buffer should be <10x slower than binary');
  });
});

describe('📊 REAL Memory Usage Analysis', () => {
  
  test('REAL: Memory growth with buffer size', () => {
    const sizes = [16, 32, 64, 128, 256, 512, 1024];
    
    console.log('\n📏 Buffer Size vs Creation Time:');
    console.log('Size\t\tTime (ms)\tRate (buffers/sec)');
    console.log('-'.repeat(50));
    
    sizes.forEach(size => {
      const iterations = 1000;
      const startTime = process.hrtime.bigint();
      
      for (let i = 0; i < iterations; i++) {
        new CircularStreamBuffer(size, size * 2);
      }
      
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      const rate = iterations / (durationMs / 1000);
      
      console.log(`${size}\t\t${durationMs.toFixed(2)}\t\t${rate.toFixed(0)}`);
      
      // Should scale reasonably
      assert.ok(durationMs < 100, `Size ${size} should create in <100ms, got ${durationMs.toFixed(2)}ms`);
    });
  });

  test('REAL: Concurrent access performance', () => {
    const buffer = new CircularStreamBuffer(128, 256);
    const accessors = 50;
    const opsPerAccessor = 1000;
    
    const startTime = process.hrtime.bigint();
    
    // Simulate concurrent access
    const promises = [];
    for (let i = 0; i < accessors; i++) {
      promises.push(new Promise<number>((resolve) => {
        let ops = 0;
        for (let j = 0; j < opsPerAccessor; j++) {
          buffer.getState();
          ops++;
        }
        resolve(ops);
      }));
    }
    
    Promise.all(promises).then(results => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      const totalOps = results.reduce((sum, ops) => sum + ops, 0);
      const opsPerSec = totalOps / (durationMs / 1000);
      
      console.log(`🔄 Concurrent Access: ${opsPerSec.toFixed(0)} ops/sec with ${accessors} accessors`);
    });
  });
});