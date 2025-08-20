import { test, describe } from 'node:test';
import assert from 'node:assert';
import { platform, arch, cpus, totalmem, freemem, release } from 'node:os';

describe('🖥️ System Environment & Hardware', () => {
  
  test('Hardware & Environment Info', () => {
    const systemInfo = {
      platform: platform(),
      architecture: arch(),
      nodeVersion: process.version,
      osRelease: release(),
      cpuCount: cpus().length,
      cpuModel: cpus()[0]?.model || 'Unknown',
      totalMemory: Math.round(totalmem() / (1024 * 1024 * 1024)),
      freeMemory: Math.round(freemem() / (1024 * 1024 * 1024)),
      v8Version: process.versions.v8,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    console.log('\n' + '='.repeat(70));
    console.log('🖥️  SYSTEM ENVIRONMENT & HARDWARE SPECIFICATIONS');
    console.log('='.repeat(70));
    
    console.log(`💻 Platform: ${systemInfo.platform} ${systemInfo.architecture}`);
    console.log(`🏷️  OS Release: ${systemInfo.osRelease}`);
    console.log(`⚙️  Node.js: ${systemInfo.nodeVersion}`);
    console.log(`🚀 V8 Engine: ${systemInfo.v8Version}`);
    console.log(`🔧 CPU Model: ${systemInfo.cpuModel}`);
    console.log(`⚡ CPU Cores: ${systemInfo.cpuCount}`);
    console.log(`💾 Total RAM: ${systemInfo.totalMemory} GB`);
    console.log(`🆓 Free RAM: ${systemInfo.freeMemory} GB`);
    console.log(`🌍 Timezone: ${systemInfo.timezone}`);
    console.log(`📅 Test Date: ${new Date().toISOString()}`);
    
    console.log('\n🎯 PERFORMANCE CONTEXT:');
    console.log('All benchmarks run on the above hardware configuration.');
    console.log('Results may vary on different systems.');
    console.log('=' .repeat(70));

    // Validate system meets minimum requirements
    assert.ok(systemInfo.cpuCount >= 1, 'Should have at least 1 CPU core');
    assert.ok(systemInfo.totalMemory >= 1, 'Should have at least 1GB RAM');
    assert.ok(systemInfo.nodeVersion.startsWith('v'), 'Should have valid Node.js version');
  });

  test('Performance Baseline Calibration', () => {
    const iterations = 1000000;
    const startTime = process.hrtime.bigint();
    
    // CPU baseline test
    let sum = 0;
    for (let i = 0; i < iterations; i++) {
      sum += Math.sqrt(i);
    }
    
    const endTime = process.hrtime.bigint();
    const durationMs = Number(endTime - startTime) / 1_000_000;
    const opsPerSec = iterations / (durationMs / 1000);
    
    console.log(`\n🏃 CPU Baseline: ${opsPerSec.toFixed(0)} math ops/sec`);
    console.log(`⏱️  Duration: ${durationMs.toFixed(2)}ms`);
    
    // Memory allocation baseline
    const memStart = process.hrtime.bigint();
    const arrays = [];
    for (let i = 0; i < 10000; i++) {
      arrays.push(new Array(100).fill(i));
    }
    const memEnd = process.hrtime.bigint();
    const memDuration = Number(memEnd - memStart) / 1_000_000;
    
    console.log(`💾 Memory Baseline: ${(10000 / (memDuration / 1000)).toFixed(0)} allocations/sec`);
    
    // Our library should perform well relative to these baselines
    assert.ok(opsPerSec > 100000, 'CPU should be reasonably fast');
    assert.ok(memDuration < 1000, 'Memory allocation should be fast');
  });
});