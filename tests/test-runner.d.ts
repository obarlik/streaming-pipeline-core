/**
 * Test runner and organization utilities
 * Provides unified way to run different test suites
 */
export interface TestSuite {
    name: string;
    description: string;
    pattern: string;
    timeout?: number;
    setup?: () => Promise<void>;
    teardown?: () => Promise<void>;
}
export declare const TEST_SUITES: TestSuite[];
export declare class TestRunner {
    /**
     * Run specific test suite
     */
    static runSuite(suiteName: string): Promise<boolean>;
    /**
     * Run all test suites
     */
    static runAll(): Promise<boolean>;
    /**
     * Run performance benchmarks only
     */
    static runBenchmarks(): Promise<void>;
    /**
     * Run quick smoke tests
     */
    static runSmoke(): Promise<boolean>;
    /**
     * Validate test setup
     */
    static validateSetup(): Promise<boolean>;
    private static runJest;
    private static findTestFiles;
    private static generatePerformanceReport;
}
