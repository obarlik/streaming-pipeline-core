/**
 * Common processor testing patterns and utilities
 * Focus: Reusable test patterns for any processor implementation
 */
import { StreamingContext, StreamChunk, BaseStreamProcessor } from '../../src/framework/streaming-interfaces';
/**
 * Generic processor test utilities
 */
export declare class ProcessorTestUtils {
    /**
     * Create a test context with given content
     */
    static createTestContext(content: string, position?: number): StreamingContext;
    /**
     * Test that processor respects advance contract
     */
    static testAdvanceContract(processor: BaseStreamProcessor, content: string): {
        chunks: StreamChunk[];
        advance: number;
    };
    /**
     * Test processor with various boundary conditions
     */
    static testBoundaryConditions(processor: BaseStreamProcessor): Record<string, any>;
    /**
     * Test processor performance with large content
     */
    static testPerformance(processor: BaseStreamProcessor, content: string, iterations?: number): {
        iterations: number;
        duration: number;
        avgTimePerCall: number;
        callsPerSecond: number;
    };
}
