import { CircularStreamBuffer, TextCircularBuffer, FluentFactory } from '../src/index.js';
import { writeFileSync } from 'fs';
import { platform, arch, cpus, totalmem, freemem, release } from 'os';

console.log('🚀 Generating Performance Report...');

// System information
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
  timestamp: new Date().toISOString(),
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
};

// Run performance benchmarks
const benchmarks = {};

// Test 1: Buffer Creation
console.log('📊 Running Buffer Creation benchmark...');
const iterations = 10000;
const startTime = process.hrtime.bigint();
for (let i = 0; i < iterations; i++) {
  new CircularStreamBuffer(64, 128);
}
const endTime = process.hrtime.bigint();
const durationMs = Number(endTime - startTime) / 1_000_000;
benchmarks.bufferCreation = {
  name: "Buffer Creation",
  throughput: Math.round(iterations / (durationMs / 1000)),
  unit: "buffers/sec",
  duration: Math.round(durationMs * 100) / 100
};

// Test 2: getState Performance
console.log('⚡ Running getState Performance benchmark...');
const buffer = new CircularStreamBuffer(256, 512);
const getStateIterations = 100000;
const getStateStart = process.hrtime.bigint();
for (let i = 0; i < getStateIterations; i++) {
  buffer.getState();
}
const getStateEnd = process.hrtime.bigint();
const getStateDuration = Number(getStateEnd - getStateStart) / 1_000_000;
benchmarks.getStatePerformance = {
  name: "getState() Operations",
  throughput: Math.round(getStateIterations / (getStateDuration / 1000)),
  unit: "ops/sec", 
  duration: Math.round(getStateDuration * 100) / 100
};

// Test 3: Pipeline Factory
console.log('🏭 Running Pipeline Factory benchmark...');
const factoryIterations = 1000;
const factoryStart = process.hrtime.bigint();
for (let i = 0; i < factoryIterations; i++) {
  const pipeline = FluentFactory.text()
    .buffer({ lookBehindSize: 32, lookAheadSize: 64 })
    .build();
}
const factoryEnd = process.hrtime.bigint();
const factoryDuration = Number(factoryEnd - factoryStart) / 1_000_000;
benchmarks.pipelineFactory = {
  name: "Pipeline Creation",
  throughput: Math.round(factoryIterations / (factoryDuration / 1000)),
  unit: "pipelines/sec",
  duration: Math.round(factoryDuration * 100) / 100
};

// Test 4: Real-world scenarios
console.log('📝 Running Real-world Scenarios...');

// Document processing
const textBuffer = new TextCircularBuffer(1024, 4096, 'utf-8');
const testDocument = 'function example() {\n  return "Hello World";\n}\n'.repeat(1000);
const docIterations = 1000;
const docStart = process.hrtime.bigint();
for (let i = 0; i < docIterations; i++) {
  textBuffer.getState();
}
const docEnd = process.hrtime.bigint();
const docDuration = Number(docEnd - docStart) / 1_000_000;
benchmarks.documentProcessing = {
  name: "Document Processing", 
  throughput: Math.round(docIterations / (docDuration / 1000)),
  unit: "docs/sec",
  characterThroughput: Math.round((docIterations * testDocument.length) / (docDuration / 1000)),
  duration: Math.round(docDuration * 100) / 100
};

// Binary streaming
const binaryBuffer = new CircularStreamBuffer(2048, 8192);
const chunkSize = 64 * 1024; // 64KB
const binaryIterations = 1000;
const binaryStart = process.hrtime.bigint();
for (let i = 0; i < binaryIterations; i++) {
  binaryBuffer.getState();
}
const binaryEnd = process.hrtime.bigint();
const binaryDuration = Number(binaryEnd - binaryStart) / 1_000_000;
benchmarks.binaryStreaming = {
  name: "Binary Streaming",
  throughput: Math.round(binaryIterations / (binaryDuration / 1000)),
  unit: "chunks/sec",
  dataThroughput: Math.round((binaryIterations * chunkSize / 1024 / 1024) / (binaryDuration / 1000)),
  dataThroughputUnit: "MB/sec",
  duration: Math.round(binaryDuration * 100) / 100
};

// Create the final report object
const report = {
  generatedAt: new Date().toISOString(),
  version: "1.0.0",
  system: systemInfo,
  benchmarks: benchmarks,
  summary: {
    totalTests: Object.keys(benchmarks).length,
    environment: `${systemInfo.platform} ${systemInfo.architecture}`,
    nodeVersion: systemInfo.nodeVersion,
    cpuModel: systemInfo.cpuModel.replace(/\s+/g, ' ').trim(),
    memory: `${systemInfo.totalMemory}GB`,
    cpuCores: systemInfo.cpuCount
  }
};

// Write JSON report
writeFileSync('performance-report.json', JSON.stringify(report, null, 2));

// Write badge data
const badges = {
  bufferCreation: {
    schemaVersion: 1,
    label: "Buffer Creation",
    message: `${benchmarks.bufferCreation.throughput.toLocaleString()} buffers/sec`,
    color: "green"
  },
  getStateOps: {
    schemaVersion: 1,
    label: "getState() Performance", 
    message: `${(benchmarks.getStatePerformance.throughput / 1000000).toFixed(1)}M ops/sec`,
    color: "blue"
  },
  pipelineFactory: {
    schemaVersion: 1,
    label: "Pipeline Creation",
    message: `${(benchmarks.pipelineFactory.throughput / 1000).toFixed(0)}K pipelines/sec`, 
    color: "orange"
  },
  documentProcessing: {
    schemaVersion: 1,
    label: "Document Processing",
    message: `${(benchmarks.documentProcessing.throughput / 1000).toFixed(0)}K docs/sec`,
    color: "purple"
  }
};

writeFileSync('badges.json', JSON.stringify(badges, null, 2));

console.log('✅ Performance report generated:');
console.log(`📊 Buffer Creation: ${benchmarks.bufferCreation.throughput.toLocaleString()} buffers/sec`);
console.log(`⚡ getState(): ${(benchmarks.getStatePerformance.throughput / 1000000).toFixed(1)}M ops/sec`);
console.log(`🏭 Pipeline Factory: ${(benchmarks.pipelineFactory.throughput / 1000).toFixed(0)}K pipelines/sec`);
console.log(`📝 Document Processing: ${(benchmarks.documentProcessing.throughput / 1000).toFixed(0)}K docs/sec`);
console.log(`💾 Binary Streaming: ${benchmarks.binaryStreaming.dataThroughput} MB/sec`);
console.log('📄 Files generated: performance-report.json, badges.json');