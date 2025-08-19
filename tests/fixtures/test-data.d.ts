/**
 * Common test data and fixtures for all tests
 */
export declare const TestMarkdown: {
    simple: string;
    complex: string;
    edge_cases: string;
    large: string;
    unicode: string;
    empty: string;
    whitespace: string;
};
export declare const TestBinary: {
    simple: Uint8Array<ArrayBuffer>;
    withNulls: Uint8Array<ArrayBuffer>;
    large: Uint8Array<ArrayBuffer>;
    empty: Uint8Array<ArrayBuffer>;
};
export declare const ExpectedResults: {
    simpleMarkdown: ({
        type: string;
        content: string;
        level: number;
    } | {
        type: string;
        content: string;
        level?: undefined;
    })[];
    complexMarkdown: ({
        type: string;
        content: string;
        level: number;
    } | {
        type: string;
        content: string;
        level?: undefined;
    })[];
};
export declare const BufferConfigs: {
    tiny: {
        lookBehindSize: number;
        lookAheadSize: number;
    };
    small: {
        lookBehindSize: number;
        lookAheadSize: number;
    };
    medium: {
        lookBehindSize: number;
        lookAheadSize: number;
    };
    large: {
        lookBehindSize: number;
        lookAheadSize: number;
    };
    huge: {
        lookBehindSize: number;
        lookAheadSize: number;
    };
};
export declare const PerformanceTargets: {
    minCharsPerSec: number;
    targetCharsPerSec: number;
    maxMemoryPerChar: number;
    maxTotalMemory: number;
    maxFirstChunkLatency: number;
    maxAvgChunkLatency: number;
};
