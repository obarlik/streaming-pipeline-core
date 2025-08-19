"use strict";
/**
 * Test runner and organization utilities
 * Provides unified way to run different test suites
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestRunner = exports.TEST_SUITES = void 0;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
exports.TEST_SUITES = [
    {
        name: 'unit',
        description: 'Unit tests for individual components',
        pattern: 'tests/unit/**/*.test.ts',
        timeout: 30000
    },
    {
        name: 'integration',
        description: 'Integration tests for complete workflows',
        pattern: 'tests/integration/**/*.test.ts',
        timeout: 60000
    },
    {
        name: 'performance',
        description: 'Performance benchmarks and stress tests',
        pattern: 'tests/performance/**/*.test.ts',
        timeout: 120000
    }
];
class TestRunner {
    /**
     * Run specific test suite
     */
    static async runSuite(suiteName) {
        const suite = exports.TEST_SUITES.find(s => s.name === suiteName);
        if (!suite) {
            console.error(`Unknown test suite: ${suiteName}`);
            return false;
        }
        console.log(`🧪 Running ${suite.name} tests: ${suite.description}`);
        try {
            // Setup if needed
            if (suite.setup) {
                console.log('Setting up test suite...');
                await suite.setup();
            }
            // Run tests
            const success = await this.runJest(suite.pattern, suite.timeout);
            // Teardown if needed
            if (suite.teardown) {
                console.log('Cleaning up test suite...');
                await suite.teardown();
            }
            return success;
        }
        catch (error) {
            console.error(`Test suite ${suiteName} failed:`, error);
            return false;
        }
    }
    /**
     * Run all test suites
     */
    static async runAll() {
        console.log('🚀 Running all test suites...\n');
        const results = {};
        let allPassed = true;
        for (const suite of exports.TEST_SUITES) {
            console.log(`\n${'='.repeat(50)}`);
            const success = await this.runSuite(suite.name);
            results[suite.name] = success;
            if (!success) {
                allPassed = false;
            }
        }
        // Summary
        console.log(`\n${'='.repeat(50)}`);
        console.log('📊 Test Results Summary:');
        Object.entries(results).forEach(([name, success]) => {
            const icon = success ? '✅' : '❌';
            console.log(`  ${icon} ${name}: ${success ? 'PASSED' : 'FAILED'}`);
        });
        console.log(`\n🎯 Overall: ${allPassed ? 'PASSED' : 'FAILED'}`);
        return allPassed;
    }
    /**
     * Run performance benchmarks only
     */
    static async runBenchmarks() {
        console.log('⚡ Running performance benchmarks...');
        await this.runSuite('performance');
        // Generate performance report
        await this.generatePerformanceReport();
    }
    /**
     * Run quick smoke tests
     */
    static async runSmoke() {
        console.log('💨 Running smoke tests...');
        // Run basic unit tests only
        const pattern = 'tests/unit/circular-buffer.test.ts';
        return await this.runJest(pattern, 10000);
    }
    /**
     * Validate test setup
     */
    static async validateSetup() {
        console.log('🔍 Validating test setup...');
        try {
            // Check that all test files exist
            for (const suite of exports.TEST_SUITES) {
                const files = await this.findTestFiles(suite.pattern);
                if (files.length === 0) {
                    console.warn(`⚠️  No test files found for pattern: ${suite.pattern}`);
                }
                else {
                    console.log(`✅ Found ${files.length} test files for ${suite.name}`);
                }
            }
            // Check test dependencies
            const packageJson = await fs_1.promises.readFile('package.json', 'utf-8');
            const pkg = JSON.parse(packageJson);
            const requiredDeps = ['jest', '@types/jest', 'ts-jest'];
            const missing = requiredDeps.filter(dep => !pkg.devDependencies?.[dep] && !pkg.dependencies?.[dep]);
            if (missing.length > 0) {
                console.error(`❌ Missing test dependencies: ${missing.join(', ')}`);
                return false;
            }
            console.log('✅ Test setup validation complete');
            return true;
        }
        catch (error) {
            console.error('❌ Test setup validation failed:', error);
            return false;
        }
    }
    // Private helper methods
    static async runJest(pattern, timeout = 30000) {
        return new Promise((resolve) => {
            const args = [
                '--testPathPattern', pattern,
                '--timeout', timeout.toString(),
                '--verbose'
            ];
            const jest = (0, child_process_1.spawn)('npx', ['jest', ...args], {
                stdio: 'inherit',
                shell: true
            });
            jest.on('close', (code) => {
                resolve(code === 0);
            });
            jest.on('error', (error) => {
                console.error('Jest execution failed:', error);
                resolve(false);
            });
        });
    }
    static async findTestFiles(pattern) {
        // Simple glob implementation - in real use, would use a proper glob library
        const testDir = pattern.split('*')[0];
        try {
            const files = await fs_1.promises.readdir(testDir, { recursive: true });
            return files
                .filter(file => file.toString().endsWith('.test.ts'))
                .map(file => path_1.default.join(testDir, file.toString()));
        }
        catch {
            return [];
        }
    }
    static async generatePerformanceReport() {
        console.log('📈 Generating performance report...');
        // This would analyze test output and generate a report
        // For now, just a placeholder
        const report = {
            timestamp: new Date().toISOString(),
            suites: {
                throughput: 'See console output',
                latency: 'See console output',
                memory: 'See console output',
                scalability: 'See console output'
            }
        };
        await fs_1.promises.writeFile('performance-report.json', JSON.stringify(report, null, 2));
        console.log('📋 Performance report saved to performance-report.json');
    }
}
exports.TestRunner = TestRunner;
// CLI interface
if (require.main === module) {
    const command = process.argv[2];
    (async () => {
        switch (command) {
            case 'all':
                await TestRunner.runAll();
                break;
            case 'unit':
                await TestRunner.runSuite('unit');
                break;
            case 'integration':
                await TestRunner.runSuite('integration');
                break;
            case 'performance':
                await TestRunner.runBenchmarks();
                break;
            case 'smoke':
                await TestRunner.runSmoke();
                break;
            case 'validate':
                await TestRunner.validateSetup();
                break;
            default:
                console.log(`
🧪 Test Runner Usage:

  npm run test:all          # Run all test suites
  npm run test:unit         # Run unit tests only
  npm run test:integration  # Run integration tests only
  npm run test:performance  # Run performance benchmarks
  npm run test:smoke        # Run quick smoke tests
  npm run test:validate     # Validate test setup

Available test suites:
${exports.TEST_SUITES.map(s => `  • ${s.name}: ${s.description}`).join('\n')}
        `);
        }
    })().catch(console.error);
}
