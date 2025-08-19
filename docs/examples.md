# Examples

Comprehensive examples for processors, renderers, and common use cases.

## Processor Examples

### Basic Text Processor

```typescript
import { BaseStreamProcessor, StreamingContext, StreamChunk } from 'streaming-pipeline-core';

class BasicTextProcessor extends BaseStreamProcessor {
  readonly name = 'basic-text';
  readonly priority = 5;

  canProcess(context: StreamingContext): boolean {
    // Process all text content
    return context.buffer instanceof TextCircularBuffer;
  }

  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const char = buffer.peekChar();

    if (!char) {
      return { chunks: [], advance: 1 };
    }

    // Simple character-by-character processing
    return {
      chunks: [{
        type: 'text',
        content: char,
        position: context.position
      }],
      advance: 1
    };
  }
}
```

### Markdown Processor

```typescript
class MarkdownProcessor extends BaseStreamProcessor {
  readonly name = 'markdown';
  readonly priority = 10;
  readonly preferredLookAhead = 512; // Need lookahead for patterns

  canProcess(context: StreamingContext): boolean {
    return context.buffer instanceof TextCircularBuffer;
  }

  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const current = buffer.peekChar();

    if (!current) return { chunks: [], advance: 1 };

    // Check for headers
    if (current === '#' && this.isLineStart(context)) {
      return this.processHeader(context);
    }

    // Check for bold text
    if (current === '*') {
      const ahead = buffer.lookAheadString(2);
      if (ahead.startsWith('*')) {
        return this.processBold(context);
      }
      return this.processItalic(context);
    }

    // Check for inline code
    if (current === '`') {
      return this.processInlineCode(context);
    }

    // Check for lists
    if (current === '-' && this.isLineStart(context)) {
      return this.processList(context);
    }

    // Regular text
    return this.processText(context);
  }

  private isLineStart(context: StreamingContext): boolean {
    const buffer = context.buffer as TextCircularBuffer;
    const behind = buffer.lookBehindString(1);
    return behind === '' || behind === '\n';
  }

  private processHeader(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    
    // Count # characters
    let level = 0;
    const ahead = buffer.lookAheadString(6);
    for (const char of ahead) {
      if (char === '#') level++;
      else break;
    }

    // Must have space after #
    if (level === 0 || ahead[level] !== ' ') {
      return this.processText(context);
    }

    // Find end of line
    const line = buffer.lookAheadString(200);
    const newlineIndex = line.indexOf('\n');
    const headerEnd = newlineIndex >= 0 ? newlineIndex : line.length;
    
    const headerText = line.slice(level + 1, headerEnd).trim();

    return {
      chunks: [{
        type: 'heading',
        content: headerText,
        data: { level },
        position: context.position
      }],
      advance: Math.max(1, level + 1 + headerText.length)
    };
  }

  private processBold(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(100);
    
    // Find closing **
    const endIndex = content.indexOf('**', 2);
    if (endIndex > 0) {
      const boldText = content.slice(2, endIndex);
      return {
        chunks: [{
          type: 'strong',
          content: boldText,
          position: context.position
        }],
        advance: endIndex + 2
      };
    }

    return this.processText(context);
  }

  private processItalic(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(100);
    
    // Find closing *
    const endIndex = content.indexOf('*', 1);
    if (endIndex > 0) {
      const italicText = content.slice(1, endIndex);
      return {
        chunks: [{
          type: 'emphasis',
          content: italicText,
          position: context.position
        }],
        advance: endIndex + 1
      };
    }

    return this.processText(context);
  }

  private processInlineCode(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(100);
    
    // Find closing `
    const endIndex = content.indexOf('`', 1);
    if (endIndex > 0) {
      const codeText = content.slice(1, endIndex);
      return {
        chunks: [{
          type: 'code',
          content: codeText,
          data: { inline: true },
          position: context.position
        }],
        advance: endIndex + 1
      };
    }

    return this.processText(context);
  }

  private processList(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(200);
    
    // Must have space after -
    if (!content.startsWith('- ')) {
      return this.processText(context);
    }

    // Find end of line
    const newlineIndex = content.indexOf('\n');
    const lineEnd = newlineIndex >= 0 ? newlineIndex : content.length;
    const itemText = content.slice(2, lineEnd).trim();

    return {
      chunks: [{
        type: 'listItem',
        content: itemText,
        data: { type: 'unordered' },
        position: context.position
      }],
      advance: Math.max(1, 2 + itemText.length)
    };
  }

  private processText(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const current = buffer.peekChar() || '';

    return {
      chunks: [{
        type: 'text',
        content: current,
        position: context.position
      }],
      advance: 1
    };
  }
}
```

### Binary Processor

```typescript
class BinaryProcessor extends BaseStreamProcessor {
  readonly name = 'binary';
  readonly priority = 10;

  canProcess(context: StreamingContext): boolean {
    return context.buffer instanceof CircularStreamBuffer && 
           !(context.buffer instanceof TextCircularBuffer);
  }

  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as CircularStreamBuffer;
    const byte = buffer.peek();

    if (byte === null) {
      return { chunks: [], advance: 1 };
    }

    // Check for binary patterns
    if (byte === 0xFF && this.isPngHeader(context)) {
      return this.processPngHeader(context);
    }

    if (byte === 0x25 && this.isPdfHeader(context)) {
      return this.processPdfHeader(context);
    }

    // Default: hex representation
    return {
      chunks: [{
        type: 'byte',
        content: byte.toString(16).padStart(2, '0'),
        data: { byte, decimal: byte, binary: byte.toString(2) },
        position: context.position
      }],
      advance: 1
    };
  }

  private isPngHeader(context: StreamingContext): boolean {
    const buffer = context.buffer as CircularStreamBuffer;
    const header = buffer.lookAhead(8);
    
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngSig = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    if (header.length < 8) return false;
    
    for (let i = 0; i < 8; i++) {
      if (header[i] !== pngSig[i]) return false;
    }
    
    return true;
  }

  private processPngHeader(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    return {
      chunks: [{
        type: 'png-header',
        content: 'PNG Image Header',
        data: { format: 'PNG', type: 'image' },
        position: context.position
      }],
      advance: 8
    };
  }

  private isPdfHeader(context: StreamingContext): boolean {
    const buffer = context.buffer as CircularStreamBuffer;
    const header = buffer.lookAhead(4);
    
    // PDF signature: %PDF
    return header.length >= 4 && 
           header[0] === 0x25 && // %
           header[1] === 0x50 && // P
           header[2] === 0x44 && // D
           header[3] === 0x46;   // F
  }

  private processPdfHeader(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    return {
      chunks: [{
        type: 'pdf-header',
        content: 'PDF Document Header',
        data: { format: 'PDF', type: 'document' },
        position: context.position
      }],
      advance: 4
    };
  }
}
```

### JSON Processor

```typescript
class JsonProcessor extends BaseStreamProcessor {
  readonly name = 'json';
  readonly priority = 15;
  readonly preferredLookAhead = 1024; // Need lookahead for complete objects

  canProcess(context: StreamingContext): boolean {
    const buffer = context.buffer as TextCircularBuffer;
    const current = buffer.peekChar();
    return current === '{' || current === '[' || current === '"' || 
           /\d/.test(current || '') || current === 't' || current === 'f' || current === 'n';
  }

  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const current = buffer.peekChar();

    if (!current) return { chunks: [], advance: 1 };

    // Parse different JSON types
    if (current === '{') return this.parseObject(context);
    if (current === '[') return this.parseArray(context);
    if (current === '"') return this.parseString(context);
    if (/\d/.test(current) || current === '-') return this.parseNumber(context);
    if (current === 't' || current === 'f') return this.parseBoolean(context);
    if (current === 'n') return this.parseNull(context);

    return { chunks: [], advance: 1 };
  }

  private parseObject(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(1000);
    
    // Find matching closing brace
    let braceCount = 0;
    let inString = false;
    let escape = false;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\') {
        escape = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') braceCount++;
        if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            const jsonText = content.slice(0, i + 1);
            try {
              const parsed = JSON.parse(jsonText);
              return {
                chunks: [{
                  type: 'json-object',
                  content: jsonText,
                  data: { parsed, keys: Object.keys(parsed) },
                  position: context.position
                }],
                advance: i + 1
              };
            } catch (error) {
              // Invalid JSON, treat as text
              break;
            }
          }
        }
      }
    }

    // Incomplete object, advance by 1
    return { chunks: [], advance: 1 };
  }

  private parseString(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(500);
    
    let escape = false;
    for (let i = 1; i < content.length; i++) {
      const char = content[i];
      
      if (escape) {
        escape = false;
        continue;
      }
      
      if (char === '\\') {
        escape = true;
        continue;
      }
      
      if (char === '"') {
        const stringContent = content.slice(1, i); // Without quotes
        return {
          chunks: [{
            type: 'json-string',
            content: stringContent,
            data: { length: stringContent.length },
            position: context.position
          }],
          advance: i + 1
        };
      }
    }

    return { chunks: [], advance: 1 };
  }

  private parseNumber(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(50);
    
    const numberMatch = content.match(/^-?\d+(\.\d+)?([eE][+-]?\d+)?/);
    if (numberMatch) {
      const numberStr = numberMatch[0];
      const value = parseFloat(numberStr);
      
      return {
        chunks: [{
          type: 'json-number',
          content: numberStr,
          data: { value, isInteger: Number.isInteger(value) },
          position: context.position
        }],
        advance: numberStr.length
      };
    }

    return { chunks: [], advance: 1 };
  }

  private parseBoolean(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(5);
    
    if (content.startsWith('true')) {
      return {
        chunks: [{
          type: 'json-boolean',
          content: 'true',
          data: { value: true },
          position: context.position
        }],
        advance: 4
      };
    }
    
    if (content.startsWith('false')) {
      return {
        chunks: [{
          type: 'json-boolean',
          content: 'false',
          data: { value: false },
          position: context.position
        }],
        advance: 5
      };
    }

    return { chunks: [], advance: 1 };
  }

  private parseNull(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    const buffer = context.buffer as TextCircularBuffer;
    const content = buffer.lookAheadString(4);
    
    if (content.startsWith('null')) {
      return {
        chunks: [{
          type: 'json-null',
          content: 'null',
          data: { value: null },
          position: context.position
        }],
        advance: 4
      };
    }

    return { chunks: [], advance: 1 };
  }
}
```

## Renderer Examples

### HTML Renderer

```typescript
class HTMLRenderer implements IStreamRenderer {
  readonly format = 'html';

  renderChunk(chunk: StreamChunk): string {
    switch (chunk.type) {
      case 'heading':
        const level = chunk.data?.level || 1;
        return `<h${level}>${this.escapeHtml(chunk.content)}</h${level}>\n`;
      
      case 'strong':
        return `<strong>${this.escapeHtml(chunk.content)}</strong>`;
      
      case 'emphasis':
        return `<em>${this.escapeHtml(chunk.content)}</em>`;
      
      case 'code':
        if (chunk.data?.inline) {
          return `<code>${this.escapeHtml(chunk.content)}</code>`;
        } else {
          return `<pre><code>${this.escapeHtml(chunk.content)}</code></pre>\n`;
        }
      
      case 'listItem':
        return `<li>${this.escapeHtml(chunk.content)}</li>\n`;
      
      case 'text':
        return this.escapeHtml(chunk.content);
      
      case 'json-object':
        return `<div class="json-object"><pre>${this.escapeHtml(chunk.content)}</pre></div>\n`;
      
      case 'json-string':
        return `<span class="json-string">"${this.escapeHtml(chunk.content)}"</span>`;
      
      case 'json-number':
        return `<span class="json-number">${chunk.content}</span>`;
      
      case 'png-header':
        return `<div class="binary-header png">📷 ${chunk.content}</div>\n`;
      
      case 'pdf-header':
        return `<div class="binary-header pdf">📄 ${chunk.content}</div>\n`;
      
      case 'byte':
        return `<span class="byte" title="Decimal: ${chunk.data?.decimal}, Binary: ${chunk.data?.binary}">${chunk.content}</span>`;
      
      default:
        return this.escapeHtml(chunk.content);
    }
  }

  renderChunks(chunks: StreamChunk[]): string {
    return chunks.map(chunk => this.renderChunk(chunk)).join('');
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
```

### JSON Renderer

```typescript
class JsonRenderer implements IStreamRenderer {
  readonly format = 'json';

  renderChunk(chunk: StreamChunk): string {
    const output = {
      type: chunk.type,
      content: chunk.content,
      data: chunk.data,
      position: chunk.position,
      timestamp: Date.now()
    };

    return JSON.stringify(output) + '\n';
  }

  renderChunks(chunks: StreamChunk[]): string {
    return JSON.stringify({
      chunks: chunks.map(chunk => ({
        type: chunk.type,
        content: chunk.content,
        data: chunk.data,
        position: chunk.position
      })),
      count: chunks.length,
      timestamp: Date.now()
    }, null, 2);
  }
}
```

### Plain Text Renderer

```typescript
class PlainTextRenderer implements IStreamRenderer {
  readonly format = 'text';

  renderChunk(chunk: StreamChunk): string {
    switch (chunk.type) {
      case 'heading':
        const level = chunk.data?.level || 1;
        const prefix = '#'.repeat(level);
        return `${prefix} ${chunk.content}\n\n`;
      
      case 'strong':
        return `**${chunk.content}**`;
      
      case 'emphasis':
        return `*${chunk.content}*`;
      
      case 'code':
        if (chunk.data?.inline) {
          return `\`${chunk.content}\``;
        } else {
          return `\`\`\`\n${chunk.content}\n\`\`\`\n\n`;
        }
      
      case 'listItem':
        return `- ${chunk.content}\n`;
      
      case 'json-object':
      case 'json-string':
      case 'json-number':
      case 'json-boolean':
      case 'json-null':
        return chunk.content;
      
      case 'png-header':
      case 'pdf-header':
        return `[${chunk.content}]\n`;
      
      case 'byte':
        return chunk.content + ' ';
      
      default:
        return chunk.content;
    }
  }

  renderChunks(chunks: StreamChunk[]): string {
    return chunks.map(chunk => this.renderChunk(chunk)).join('');
  }
}
```

## Complete Usage Examples

### Markdown to HTML Pipeline

```typescript
import { PipelineFactory, MarkdownProcessor, HTMLRenderer } from 'streaming-pipeline-core';

async function markdownToHtml(markdown: string): Promise<string> {
  // Create optimized text pipeline
  const pipeline = PipelineFactory.createTextPipeline({
    lookBehindSize: 128,
    lookAheadSize: 512
  });

  // Register components
  pipeline.registerProcessor(new MarkdownProcessor());
  pipeline.registerRenderer(new HTMLRenderer());

  // Process with streaming
  const results: string[] = [];
  for await (const html of pipeline.processStream(markdown, 'html')) {
    results.push(html);
  }

  return results.join('');
}

// Usage
const markdown = `# My Document
This is **bold** and *italic* text.
- Item 1
- Item 2`;

markdownToHtml(markdown).then(html => {
  console.log(html);
  // Output: <h1>My Document</h1>\nThis is <strong>bold</strong> and <em>italic</em> text.\n<li>Item 1</li>\n<li>Item 2</li>\n
});
```

### Large File Processing

```typescript
import fs from 'fs';

async function processLargeFile(filePath: string) {
  // High-performance pipeline for large files
  const pipeline = PipelineFactory.createHighPerformancePipeline();
  pipeline.registerProcessor(new MarkdownProcessor());
  pipeline.registerRenderer(new HTMLRenderer());

  // Create readable stream
  const fileStream = fs.createReadStream(filePath);
  const readableStream = new ReadableStream({
    start(controller) {
      fileStream.on('data', chunk => {
        controller.enqueue(chunk);
      });
      fileStream.on('end', () => {
        controller.close();
      });
      fileStream.on('error', err => {
        controller.error(err);
      });
    }
  });

  // Process with bounded memory
  let chunkCount = 0;
  const startTime = Date.now();

  for await (const html of pipeline.processStream(readableStream, 'html')) {
    // Process each chunk as it arrives
    process.stdout.write(html);
    chunkCount++;

    // Progress indication
    if (chunkCount % 1000 === 0) {
      const elapsed = Date.now() - startTime;
      console.error(`Processed ${chunkCount} chunks in ${elapsed}ms`);
    }
  }

  console.error(`\nCompleted: ${chunkCount} chunks processed`);
}

// Usage
processLargeFile('huge-document.md');
```

### Binary File Analysis

```typescript
async function analyzeBinaryFile(filePath: string) {
  const pipeline = PipelineFactory.createBinaryPipeline();
  pipeline.registerProcessor(new BinaryProcessor());
  pipeline.registerRenderer(new JsonRenderer());

  const fileBuffer = fs.readFileSync(filePath);
  
  console.log('Binary file analysis:');
  for await (const json of pipeline.processStream(fileBuffer, 'json')) {
    const data = JSON.parse(json);
    if (data.type.includes('header')) {
      console.log(`Found: ${data.content} at position ${data.position.offset}`);
    }
  }
}

// Usage
analyzeBinaryFile('image.png');
// Output: Found: PNG Image Header at position 0
```

### Real-time JSON Processing

```typescript
async function processJsonStream(jsonStream: ReadableStream) {
  const pipeline = PipelineFactory.createTextPipeline({
    lookBehindSize: 256,
    lookAheadSize: 2048  // Larger lookahead for JSON objects
  });

  pipeline.registerProcessor(new JsonProcessor());
  pipeline.registerRenderer(new HTMLRenderer());

  let objectCount = 0;
  
  for await (const html of pipeline.processStream(jsonStream, 'html')) {
    document.getElementById('output').innerHTML += html;
    
    if (html.includes('json-object')) {
      objectCount++;
      console.log(`Processed ${objectCount} JSON objects`);
    }
  }
}

// Usage with WebSocket or Server-Sent Events
const eventSource = new EventSource('/json-stream');
const stream = new ReadableStream({
  start(controller) {
    eventSource.onmessage = (event) => {
      controller.enqueue(new TextEncoder().encode(event.data));
    };
  }
});

processJsonStream(stream);
```

### Multi-format Pipeline

```typescript
class MultiFormatPipeline {
  private pipeline: StreamingPipeline;

  constructor() {
    this.pipeline = PipelineFactory.createTextPipeline();
    
    // Register multiple processors
    this.pipeline.registerProcessor(new MarkdownProcessor());
    this.pipeline.registerProcessor(new JsonProcessor());
    this.pipeline.registerProcessor(new BasicTextProcessor()); // Fallback
    
    // Register multiple renderers
    this.pipeline.registerRenderer(new HTMLRenderer());
    this.pipeline.registerRenderer(new JsonRenderer());
    this.pipeline.registerRenderer(new PlainTextRenderer());
  }

  async process(content: string, outputFormat: string): Promise<string> {
    const results: string[] = [];
    
    for await (const output of this.pipeline.processStream(content, outputFormat)) {
      results.push(output);
    }
    
    return results.join('');
  }
}

// Usage
const multiPipeline = new MultiFormatPipeline();

// Process markdown as HTML
const html = await multiPipeline.process('# Hello **World**', 'html');

// Process JSON as HTML (with syntax highlighting)
const jsonHtml = await multiPipeline.process('{"name": "test"}', 'html');

// Process anything as plain text
const text = await multiPipeline.process('Mixed content', 'text');
```

These examples demonstrate the flexibility and power of the circular buffer streaming system for various content processing scenarios.