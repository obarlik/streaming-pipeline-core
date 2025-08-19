# 🔄 Streaming Pipeline Core

![Streaming Pipeline Core Banner](banner.png)

🌊 **Memory-Efficient Circular Buffer System**  
*A production-ready TypeScript library by [🚀 Codechu](https://codechu.com)*

[![NPM Package](https://img.shields.io/npm/v/@codechu/streaming-pipeline-core.svg?style=for-the-badge&logo=npm&color=2563eb)](https://www.npmjs.com/package/@codechu/streaming-pipeline-core)
[![License](https://img.shields.io/github/license/codechu/streaming-pipeline-core.svg?style=for-the-badge&color=1e40af)](https://github.com/codechu/streaming-pipeline-core/blob/main/LICENSE)
[![Built by Codechu](https://img.shields.io/badge/Built%20by-Codechu-1d4ed8?style=for-the-badge)](https://codechu.com)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-1e40af?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Memory Bounded](https://img.shields.io/badge/Memory-Bounded-2563eb?style=flat-square&logo=memory&logoColor=white)](#circular-buffer)
[![Real-time Processing](https://img.shields.io/badge/Processing-Real--time-3b82f6?style=flat-square)](#streaming)
[![Tests](https://img.shields.io/badge/Tests-Modular-1d4ed8?style=flat-square&logo=checkmarx&logoColor=white)](#testing)


## ✨ Features

### 🔄 **Circular Buffer System**
- **Bounded memory usage** - never grows, automatically compacts old data
- **O(1) operations** - peek, advance, lookahead/lookbehind all constant time
- **Configurable limits** - set your own lookBehind/lookAhead buffer sizes
- **Auto-refill streaming** - continuous data flow without blocking

### 🎯 **Universal Processing**
- **Single interface** - one `process()` method handles everything
- **Text & Binary** - supports both string and Uint8Array inputs
- **Pattern matching** - lookahead/lookbehind for complex parsing
- **Real-time streaming** - immediate chunk output as content processes

### 🧪 **Production Ready**
- **TypeScript** - full type safety and IntelliSense support
- **Modular tests** - organized unit, integration, and performance tests
- **Zero dependencies** - completely self-contained
- **Memory efficient** - bounded memory usage for infinite streams

## 🚀 Quick Start

```bash
npm install @codechu/streaming-pipeline-core
```

### Basic Usage

```typescript
import { PipelineFactory, MarkdownProcessor, HTMLRenderer } from '@codechu/streaming-pipeline-core';

// Create pipeline with circular buffer
const pipeline = PipelineFactory.createTextPipeline({
  lookBehindSize: 256,    // 256 chars of history
  lookAheadSize: 1024     // 1KB lookahead for pattern matching
});

// Register processor and renderer
pipeline.registerProcessor(new MarkdownProcessor());
pipeline.registerRenderer(new HTMLRenderer());

// Stream processing
const markdown = \`# Hello World
This is **bold** and *italic* text.\`;

for await (const html of pipeline.processStream(markdown, 'html')) {
  console.log(html); // Real-time HTML chunks
}
```

### Streaming from Large Sources

```typescript
// Create high-performance pipeline
const pipeline = PipelineFactory.createHighPerformancePipeline();
pipeline.registerProcessor(new MarkdownProcessor());
pipeline.registerRenderer(new HTMLRenderer());

// Stream from ReadableStream (files, network, etc.)
const fileStream = fs.createReadStream('large-document.md');
const readableStream = new ReadableStream({
  start(controller) {
    fileStream.on('data', chunk => controller.enqueue(chunk));
    fileStream.on('end', () => controller.close());
  }
});

// Process as stream arrives - bounded memory usage
for await (const output of pipeline.processStream(readableStream, 'html')) {
  // Real-time processing without loading entire file
  console.log(output);
}
```

## 🔄 Circular Buffer Architecture

### Memory-Efficient Design

```
Circular Buffer: [lookBehind] [current] [lookAhead]
                      ↑         ↑         ↑
                   History   Position   Future
                   
Auto-compact: Old history automatically dropped when limit reached
Auto-refill:  New data automatically loaded as needed
Bounded:      Total memory = lookBehind + 1 + lookAhead (constant)
```

### Configuration Options

```typescript
// Small buffer for simple processing
const pipeline = PipelineFactory.createTextPipeline({
  lookBehindSize: 64,     // Minimal history
  lookAheadSize: 128      // Basic lookahead
});

// Large buffer for complex parsing
const pipeline = PipelineFactory.createTextPipeline({
  lookBehindSize: 1024,   // More context
  lookAheadSize: 4096     // Complex pattern matching
});

// Binary processing
const pipeline = PipelineFactory.createBinaryPipeline({
  lookBehindSize: 256,
  lookAheadSize: 512
});
```

## 🛠️ Creating Processors

### Basic Processor

```typescript
import { BaseStreamProcessor } from '@codechu/streaming-pipeline-core';

class MyProcessor extends BaseStreamProcessor {
  readonly name = 'my-processor';
  readonly priority = 10;
  
  canProcess(context: StreamingContext): boolean {
    // Check if this processor should handle current position
    const current = context.buffer.peekChar();
    return current === '#'; // Process headers
  }
  
  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    
    // Look ahead to find complete pattern
    const line = buffer.lookAheadString(100);
    const match = line.match(/^(#{1,6})\\s+(.+)/);
    
    if (match) {
      const level = match[1].length;
      const text = match[2];
      
      return {
        chunks: [{
          type: 'heading',
          content: text,
          data: { level }
        }],
        advance: match[0].length  // Move past entire header
      };
    }
    
    // Fallback: advance at least 1 to prevent infinite loops
    return { chunks: [], advance: 1 };
  }
}
```

### Advanced Pattern Matching

```typescript
class AdvancedProcessor extends BaseStreamProcessor {
  readonly name = 'advanced';
  readonly priority = 15;
  readonly preferredLookBehind = 64;   // Need context
  readonly preferredLookAhead = 256;   // Complex patterns
  
  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    
    // Use lookbehind for context
    const before = buffer.lookBehindString(10);
    const current = buffer.peekChar();
    const ahead = buffer.lookAheadString(50);
    
    // Smart pattern matching with context
    if (current === '*' && ahead.startsWith('*') && !before.endsWith('\\\\')) {
      // Bold text: **text**
      const endIndex = ahead.indexOf('**', 2);
      if (endIndex > 0) {
        const boldText = ahead.slice(2, endIndex);
        return {
          chunks: [{ type: 'bold', content: boldText }],
          advance: endIndex + 2  // Past closing **
        };
      }
    }
    
    return { chunks: [], advance: 1 };
  }
}
```

## 📊 Performance

### Benchmarks

- **Throughput**: 500K+ chars/sec with complex markdown processing
- **Memory**: Constant usage regardless of input size
- **Latency**: First chunk < 10ms, average chunk latency < 1ms
- **Scalability**: Handles GB+ files with MB memory usage

### Memory Efficiency

```typescript
// Process 100MB file with only ~8KB memory usage
const pipeline = PipelineFactory.createTextPipeline({
  lookBehindSize: 2048,   // 2KB history
  lookAheadSize: 4096     // 4KB lookahead
});
// Total buffer: ~6KB + overhead = ~8KB constant memory

// Even for infinite streams!
const infiniteStream = createInfiniteMarkdownStream();
for await (const output of pipeline.processStream(infiniteStream, 'html')) {
  // Bounded memory forever
}
```

## 🧪 Testing

### Organized Test Structure

```bash
# Run all test categories
npm test

# Specific test categories  
npm run test:unit         # Component isolation tests
npm run test:integration  # End-to-end workflow tests
npm run test:performance  # Benchmarks and stress tests
npm run test:smoke        # Quick validation tests
```

### Test Categories

- **Unit Tests**: CircularStreamBuffer, processor patterns, interface compliance
- **Integration Tests**: Complete pipeline workflows, error handling, real streams
- **Performance Tests**: Throughput, latency, memory usage, scalability benchmarks

## 📚 Documentation

- **[API Reference](docs/api.md)** - Complete interface documentation
- **[Architecture Guide](docs/architecture.md)** - Circular buffer system design
- **[Examples](docs/examples.md)** - Processor and renderer examples
- **[Performance Guide](docs/performance.md)** - Optimization and benchmarks

## 🔧 Factory Patterns

### Pre-configured Pipelines

```typescript
// Text processing optimized
const textPipeline = PipelineFactory.createTextPipeline();

// Binary data processing
const binaryPipeline = PipelineFactory.createBinaryPipeline();

// High-performance for large content
const perfPipeline = PipelineFactory.createHighPerformancePipeline();
```

### Custom Configuration

```typescript
const pipeline = new StreamingPipeline();

pipeline.configureBuffer({
  lookBehindSize: 512,
  lookAheadSize: 2048,
  encoding: 'utf-8',
  autoCompact: true
});
```

## 🎯 Use Cases

### Perfect For

- **📝 Markdown parsers** - Real-time preview with bounded memory
- **🔍 Log analyzers** - Process GB+ logs with constant memory
- **📄 Document processors** - Streaming conversion with pattern matching
- **🌐 Web scrapers** - Parse HTML/XML as it streams
- **📊 Data transformers** - CSV/JSON processing with lookahead/lookbehind
- **🔄 Protocol parsers** - Binary protocol parsing with context

### Production Examples

```typescript
// Real-time markdown editor
const editor = PipelineFactory.createTextPipeline({
  lookBehindSize: 128,   // Fast context for UI
  lookAheadSize: 256     // Pattern completion
});

// Large file processor  
const processor = PipelineFactory.createHighPerformancePipeline({
  lookBehindSize: 1024,  // Rich context
  lookAheadSize: 4096    // Complex patterns
});

// Memory-constrained environment
const minimal = PipelineFactory.createTextPipeline({
  lookBehindSize: 32,    // Minimal memory
  lookAheadSize: 64
});
```

## 🌟 Why Circular Buffer?

### ✅ **Memory Efficient**
- Constant memory usage regardless of input size
- Automatic cleanup of old data
- No memory leaks or accumulation

### ⚡ **Performance Optimized**  
- O(1) operations for all buffer access
- No data copying or shifting
- Optimized for streaming workloads

### 🎯 **Developer Friendly**
- Simple single-method processor interface
- Configurable buffer sizes for different use cases
- Built-in patterns for common scenarios

### 🔒 **Production Ready**
- Comprehensive test coverage
- TypeScript support with full type safety
- Battle-tested circular buffer implementation

---

---

**🔄 Stream efficiently with bounded memory!** 🚀

**Built with ❤️ by [Codechu](https://codechu.com)**

[![Learn More](https://img.shields.io/badge/Learn%20More-codechu.com-2563eb?style=for-the-badge)](https://codechu.com)