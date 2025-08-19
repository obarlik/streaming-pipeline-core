"use strict";
/**
 * Integration tests for StreamingPipeline
 * Focus: End-to-end processing, processor coordination, real streaming scenarios
 */
Object.defineProperty(exports, "__esModule", { value: true });
const StreamingPipeline_1 = require("../../src/orchestrator/StreamingPipeline");
const MarkdownProcessor_1 = require("../../src/examples/MarkdownProcessor");
const test_data_1 = require("../fixtures/test-data");
describe('StreamingPipeline Integration', () => {
    describe('Basic Pipeline Operations', () => {
        let pipeline;
        let processor;
        let renderer;
        beforeEach(() => {
            pipeline = new StreamingPipeline_1.StreamingPipeline();
            processor = new MarkdownProcessor_1.MarkdownProcessor();
            renderer = new MarkdownProcessor_1.HTMLRenderer();
            pipeline.registerProcessor(processor);
            pipeline.registerRenderer(renderer);
        });
        test('should process simple markdown correctly', async () => {
            const results = [];
            for await (const output of pipeline.processStream(test_data_1.TestMarkdown.simple, 'html')) {
                results.push(output);
            }
            const combined = results.join('');
            expect(combined).toContain('<h1>Hello World</h1>');
            expect(combined).toContain('This is a simple test.');
        });
        test('should handle complex markdown features', async () => {
            const results = [];
            for await (const output of pipeline.processStream(test_data_1.TestMarkdown.complex, 'html')) {
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
            const results = [];
            const timestamps = [];
            for await (const output of pipeline.processStream(test_data_1.TestMarkdown.complex, 'html')) {
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
            const results = [];
            for await (const output of pipeline.processStream('', 'html')) {
                results.push(output);
            }
            expect(results.length).toBe(0); // No output for empty input
        });
    });
    describe('Buffer Configuration Impact', () => {
        test('should work with different buffer sizes', async () => {
            for (const [name, config] of Object.entries(test_data_1.BufferConfigs)) {
                const pipeline = StreamingPipeline_1.PipelineFactory.createTextPipeline(config);
                pipeline.registerProcessor(new MarkdownProcessor_1.MarkdownProcessor());
                pipeline.registerRenderer(new MarkdownProcessor_1.HTMLRenderer());
                const results = [];
                for await (const output of pipeline.processStream(test_data_1.TestMarkdown.complex, 'html')) {
                    results.push(output);
                }
                const combined = results.join('');
                expect(combined).toContain('<h1>Main Title</h1>');
                expect(combined.length).toBeGreaterThan(0);
            }
        });
        test('should handle large content with small buffers', async () => {
            const pipeline = StreamingPipeline_1.PipelineFactory.createTextPipeline(test_data_1.BufferConfigs.tiny);
            pipeline.registerProcessor(new MarkdownProcessor_1.MarkdownProcessor());
            pipeline.registerRenderer(new MarkdownProcessor_1.HTMLRenderer());
            const results = [];
            for await (const output of pipeline.processStream(test_data_1.TestMarkdown.large, 'html')) {
                results.push(output);
            }
            expect(results.length).toBeGreaterThan(0);
            // Should handle large content without crashing
        });
    });
    describe('Error Handling', () => {
        test('should handle missing renderer gracefully', async () => {
            const pipeline = new StreamingPipeline_1.StreamingPipeline();
            pipeline.registerProcessor(new MarkdownProcessor_1.MarkdownProcessor());
            // No renderer registered
            await expect(async () => {
                for await (const output of pipeline.processStream(test_data_1.TestMarkdown.simple, 'html')) {
                    // Should throw error
                }
            }).rejects.toThrow('No renderer found for format: html');
        });
        test('should continue processing after processor errors', async () => {
            class ErrorProcessor extends MarkdownProcessor_1.MarkdownProcessor {
                process(context) {
                    if (context.buffer.peekChar() === 'T') {
                        throw new Error('Test error');
                    }
                    return super.process(context);
                }
            }
            const pipeline = new StreamingPipeline_1.StreamingPipeline();
            pipeline.registerProcessor(new ErrorProcessor());
            pipeline.registerRenderer(new MarkdownProcessor_1.HTMLRenderer());
            const results = [];
            // Should not crash, should continue processing
            for await (const output of pipeline.processStream(test_data_1.TestMarkdown.simple, 'html')) {
                results.push(output);
            }
            expect(results.length).toBeGreaterThan(0); // Should produce some output
        });
    });
    describe('Multiple Processors', () => {
        test('should respect processor priority', async () => {
            class HighPriorityProcessor extends MarkdownProcessor_1.MarkdownProcessor {
                constructor() {
                    super(...arguments);
                    this.priority = 20; // Higher than default 10
                }
                process(context) {
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
            const pipeline = new StreamingPipeline_1.StreamingPipeline();
            pipeline.registerProcessor(new MarkdownProcessor_1.MarkdownProcessor()); // Priority 10
            pipeline.registerProcessor(new HighPriorityProcessor()); // Priority 20
            pipeline.registerRenderer(new MarkdownProcessor_1.HTMLRenderer());
            const results = [];
            for await (const output of pipeline.processStream('# Test', 'html')) {
                results.push(output);
            }
            const combined = results.join('');
            expect(combined).toContain('priority-heading'); // High priority should win
        });
    });
    describe('State Management', () => {
        test('should reset pipeline state correctly', async () => {
            const pipeline = new StreamingPipeline_1.StreamingPipeline();
            pipeline.registerProcessor(new MarkdownProcessor_1.MarkdownProcessor());
            pipeline.registerRenderer(new MarkdownProcessor_1.HTMLRenderer());
            // Process some content
            const results1 = [];
            for await (const output of pipeline.processStream(test_data_1.TestMarkdown.simple, 'html')) {
                results1.push(output);
            }
            // Reset and process again
            pipeline.reset();
            const results2 = [];
            for await (const output of pipeline.processStream(test_data_1.TestMarkdown.simple, 'html')) {
                results2.push(output);
            }
            expect(results1.join('')).toBe(results2.join('')); // Should be identical
        });
    });
    describe('Real-world Scenarios', () => {
        test('should handle streaming from ReadableStream', async () => {
            const pipeline = StreamingPipeline_1.PipelineFactory.createTextPipeline();
            pipeline.registerProcessor(new MarkdownProcessor_1.MarkdownProcessor());
            pipeline.registerRenderer(new MarkdownProcessor_1.HTMLRenderer());
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
            const results = [];
            for await (const output of pipeline.processStream(stream, 'html')) {
                results.push(output);
            }
            const combined = results.join('');
            expect(combined).toContain('<h1>Streaming Test</h1>');
            expect(combined).toContain('<strong>Bold</strong>');
        });
        test('should handle binary data input', async () => {
            const pipeline = StreamingPipeline_1.PipelineFactory.createBinaryPipeline();
            // Simple binary processor that converts to hex
            class HexProcessor {
                constructor() {
                    this.name = 'hex';
                    this.priority = 10;
                }
                canProcess() { return true; }
                process(context) {
                    const byte = context.buffer.peek();
                    if (byte === null)
                        return { chunks: [], advance: 0 };
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
                constructor() {
                    this.format = 'hex';
                }
                renderChunk(chunk) {
                    return chunk.content + ' ';
                }
                renderChunks(chunks) {
                    return chunks.map(c => this.renderChunk(c)).join('');
                }
            }
            pipeline.registerProcessor(new HexProcessor());
            pipeline.registerRenderer(new HexRenderer());
            const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
            const results = [];
            for await (const output of pipeline.processStream(testData, 'hex')) {
                results.push(output);
            }
            const combined = results.join('');
            expect(combined).toBe('48 65 6c 6c 6f ');
        });
    });
});
