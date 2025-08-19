# Test Organization

This directory contains modular, organized tests for the streaming pipeline system.

## Structure

```
tests/
├── fixtures/           # Common test data and utilities
│   └── test-data.ts    # Shared test content and configurations
├── unit/              # Unit tests for individual components
│   ├── circular-buffer.test.ts     # CircularStreamBuffer tests
│   └── processor-patterns.test.ts  # Generic processor testing patterns
├── integration/       # End-to-end integration tests
│   └── streaming-pipeline.test.ts  # Full pipeline workflows
├── performance/       # Performance benchmarks and stress tests
│   └── benchmark.test.ts           # Throughput, latency, memory tests
├── setup.ts          # Jest setup and global configuration
├── test-runner.ts    # Test runner with organized suites
└── README.md         # This file
```

## Test Categories

### Unit Tests (`tests/unit/`)
- **Purpose**: Test individual components in isolation
- **Focus**: CircularStreamBuffer, processor contracts, interface compliance
- **Speed**: Fast (< 1s per test)
- **Coverage**: High code coverage for core components

### Integration Tests (`tests/integration/`)
- **Purpose**: Test complete workflows and component interaction
- **Focus**: StreamingPipeline with real processors and renderers
- **Speed**: Medium (1-10s per test)
- **Coverage**: End-to-end scenarios, error handling, edge cases

### Performance Tests (`tests/performance/`)
- **Purpose**: Benchmarks and stress tests
- **Focus**: Throughput, latency, memory usage, scalability
- **Speed**: Slow (10s+ per test)
- **Coverage**: Performance regressions, bottleneck identification

## Running Tests

```bash
# Run all test suites
npm test

# Run specific test categories
npm run test:unit         # Quick unit tests
npm run test:integration  # End-to-end tests  
npm run test:performance  # Performance benchmarks

# Development workflows
npm run test:smoke        # Quick smoke tests
npm run test:validate     # Validate test setup
```

## Test Utilities

### Fixtures (`tests/fixtures/test-data.ts`)
Common test data shared across all test suites:
- **TestMarkdown**: Various markdown content patterns
- **TestBinary**: Binary data for buffer testing
- **ExpectedResults**: Expected outputs for validation
- **BufferConfigs**: Different buffer size configurations
- **PerformanceTargets**: Performance benchmarks

### Processor Testing (`tests/unit/processor-patterns.test.ts`)
Reusable patterns for testing any processor:
- **ProcessorTestUtils.createTestContext()**: Create test contexts
- **ProcessorTestUtils.testAdvanceContract()**: Verify advance behavior
- **ProcessorTestUtils.testBoundaryConditions()**: Edge case testing
- **ProcessorTestUtils.testPerformance()**: Performance validation

## Writing New Tests

### Unit Tests
```typescript
import { ProcessorTestUtils } from '../fixtures/test-data';

describe('MyProcessor', () => {
  test('should respect advance contract', () => {
    ProcessorTestUtils.testAdvanceContract(processor, content);
  });
});
```

### Integration Tests
```typescript
import { StreamingPipeline } from '../../src/orchestrator/StreamingPipeline';
import { TestMarkdown } from '../fixtures/test-data';

describe('MyWorkflow', () => {
  test('should process end-to-end', async () => {
    for await (const output of pipeline.processStream(TestMarkdown.complex, 'html')) {
      // Validate streaming output
    }
  });
});
```

### Performance Tests
```typescript
import { PerformanceTargets } from '../fixtures/test-data';

describe('MyPerformance', () => {
  test('should meet throughput targets', () => {
    const charsPerSec = measureThroughput();
    expect(charsPerSec).toBeGreaterThan(PerformanceTargets.minCharsPerSec);
  });
});
```

## Guidelines

### Test Organization
- **One purpose per test file**: Unit tests test one component, integration tests test one workflow
- **Shared fixtures**: Use `test-data.ts` for common test content
- **Descriptive names**: Test names should explain the behavior being tested
- **Logical grouping**: Group related tests with `describe()` blocks

### Test Quality
- **Fast feedback**: Unit tests should be fast, integration tests moderate
- **Deterministic**: Tests should pass/fail consistently
- **Independent**: Tests should not depend on each other
- **Realistic**: Use realistic test data and scenarios

### Performance Testing
- **Baseline targets**: All performance tests should have clear targets
- **Measurement consistency**: Use consistent measurement approaches
- **Environment awareness**: Account for CI/local environment differences
- **Regression detection**: Tests should detect performance regressions

## Coverage Goals

- **Unit Tests**: 90%+ coverage of core components
- **Integration Tests**: 80%+ coverage of main workflows  
- **Performance Tests**: Cover all performance-critical paths

## CI Integration

Tests are organized to support different CI stages:
1. **Smoke tests**: Quick validation on every commit
2. **Unit tests**: Full unit test suite on PRs
3. **Integration tests**: Complete workflow validation before merge
4. **Performance tests**: Nightly benchmarks and regression detection