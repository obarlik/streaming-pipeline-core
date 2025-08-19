/**
 * Jest test setup and global configuration
 */

// Extend Jest matchers if needed
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Global test configuration
global.console = {
  ...console,
  // Suppress debug logs during tests unless DEBUG=true
  debug: process.env.DEBUG === 'true' ? console.debug : () => {},
};

// Performance testing helpers
global.performance = global.performance || {
  now: () => Date.now()
};

// Mock implementations for testing
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
  }
}));

// Test timeout configuration
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});