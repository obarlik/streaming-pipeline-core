/**
 * Common test data and fixtures for all tests
 */

export const TestMarkdown = {
  simple: `# Hello World
This is a simple test.`,

  complex: `# Main Title

This is **bold text** and *italic text*.

## Subheading

- First list item
- Second list item

Here's some \`inline code\` in a sentence.

\`\`\`javascript
function hello() {
  console.log("Hello world!");
}
\`\`\`

Regular paragraph text.`,

  edge_cases: `### Header with ### multiple hashes

**Unclosed bold text

\`Unclosed code

\`\`\`
Unclosed code block`,

  large: 'A'.repeat(10000) + '\n# Header\n' + 'B'.repeat(10000),

  unicode: `# Título 🎉

Texto en **español** con acentos.

- Ítem uno
- Ítem dos 🚀

\`código\` con unicode.`,

  empty: '',
  whitespace: '   \n\n   \t   \n   '
};

export const TestBinary = {
  simple: new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]), // "Hello"
  withNulls: new Uint8Array([0x41, 0x00, 0x42, 0x00, 0x43]), // "A\0B\0C"
  large: new Uint8Array(50000).fill(0x41), // 50KB of 'A'
  empty: new Uint8Array(0)
};

export const ExpectedResults = {
  simpleMarkdown: [
    { type: 'heading', content: 'Hello World', level: 1 },
    { type: 'text', content: 'This is a simple test.' }
  ],

  complexMarkdown: [
    { type: 'heading', content: 'Main Title', level: 1 },
    { type: 'text', content: 'This is ' },
    { type: 'strong', content: 'bold text' },
    { type: 'text', content: ' and ' },
    { type: 'emphasis', content: 'italic text' },
    { type: 'heading', content: 'Subheading', level: 2 },
    { type: 'listItem', content: 'First list item' },
    { type: 'listItem', content: 'Second list item' }
  ]
};

export const BufferConfigs = {
  tiny: { lookBehindSize: 8, lookAheadSize: 16 },
  small: { lookBehindSize: 64, lookAheadSize: 128 },
  medium: { lookBehindSize: 256, lookAheadSize: 512 },
  large: { lookBehindSize: 1024, lookAheadSize: 2048 },
  huge: { lookBehindSize: 4096, lookAheadSize: 8192 }
};

export const PerformanceTargets = {
  // Characters per second processing targets
  minCharsPerSec: 100000,
  targetCharsPerSec: 500000,
  
  // Memory usage targets (bytes)
  maxMemoryPerChar: 10,
  maxTotalMemory: 10 * 1024 * 1024, // 10MB
  
  // Latency targets (ms)
  maxFirstChunkLatency: 10,
  maxAvgChunkLatency: 1
};