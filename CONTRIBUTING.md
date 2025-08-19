# Contributing to Streaming Pipeline Core

Thank you for your interest in contributing to **@codechu/streaming-pipeline-core**! This document provides guidelines for contributing to this project.

## 🚀 Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- TypeScript knowledge
- Git

### Setup

```bash
# Clone the repository
git clone https://github.com/codechu/streaming-pipeline-core.git
cd streaming-pipeline-core

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

## 📋 Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

- Follow the existing code style and patterns
- Add tests for new functionality
- Update documentation if needed
- Ensure TypeScript types are properly defined

### 3. Test Your Changes

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:performance

# Build and check for type errors
npm run build
```

### 4. Submit a Pull Request

- Ensure all tests pass
- Include a clear description of the changes
- Reference any related issues
- Follow the pull request template

## 🧪 Testing Guidelines

### Test Organization

- **Unit Tests** (`tests/unit/`): Test individual components in isolation
- **Integration Tests** (`tests/integration/`): Test component interactions and workflows  
- **Performance Tests** (`tests/performance/`): Benchmarks and performance regression tests

### Writing Tests

```typescript
// Use the provided test utilities
import { ProcessorTestUtils } from '../fixtures/test-data';

describe('MyProcessor', () => {
  test('should respect advance contract', () => {
    ProcessorTestUtils.testAdvanceContract(processor, content);
  });
  
  test('should handle boundary conditions', () => {
    ProcessorTestUtils.testBoundaryConditions(processor, content);
  });
});
```

## 🏗️ Architecture Guidelines

### Core Principles

1. **Bounded Memory**: All components must respect circular buffer constraints
2. **Universal Interface**: Use the single `process()` method pattern
3. **Performance First**: Optimize for O(1) operations and minimal allocations
4. **Type Safety**: Full TypeScript coverage with strict types

### Adding New Processors

```typescript
import { BaseStreamProcessor, StreamingContext, StreamChunk } from '../framework';

export class YourProcessor extends BaseStreamProcessor {
  readonly name = 'your-processor';
  readonly priority = 10; // Higher = checked first
  
  canProcess(context: StreamingContext): boolean {
    // Fast check - return true if this processor can handle current position
    return context.buffer.peekChar() === '#';
  }
  
  process(context: StreamingContext): { chunks: StreamChunk[]; advance: number } {
    // Process the pattern and return chunks + advance distance
    // MUST advance at least 1 to prevent infinite loops
    return {
      chunks: [{ type: 'heading', content: 'processed' }],
      advance: 5
    };
  }
}
```

### Adding New Renderers

```typescript
import { IStreamRenderer, StreamChunk } from '../framework';

export class YourRenderer implements IStreamRenderer {
  readonly format = 'your-format';
  
  renderChunk(chunk: StreamChunk): string {
    switch (chunk.type) {
      case 'heading':
        return `<h1>${chunk.content}</h1>`;
      default:
        return chunk.content;
    }
  }
  
  renderChunks(chunks: StreamChunk[]): string {
    return chunks.map(chunk => this.renderChunk(chunk)).join('');
  }
}
```

## 📝 Documentation

### Code Documentation

- Use JSDoc comments for public APIs
- Include examples in complex functions
- Document performance characteristics
- Explain memory usage implications

### README Updates

- Update examples if you add new features
- Keep performance benchmarks current
- Add new use cases and patterns

## 🎯 Performance Guidelines

### Memory Efficiency

- Respect circular buffer boundaries
- Avoid unnecessary string allocations
- Use TypedArrays for binary data
- Pool objects when possible

### Processing Efficiency

- Minimize lookahead/lookbehind distances
- Use early returns in processors
- Optimize common code paths
- Profile performance-critical sections

## 🐛 Bug Reports

### Before Reporting

1. Check existing issues
2. Verify with latest version
3. Create minimal reproduction case
4. Test with different buffer sizes

### Bug Report Template

```markdown
**Bug Description**
Clear description of the issue

**Reproduction Steps**
1. Step one
2. Step two
3. Step three

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- Node.js version:
- Package version:
- Operating System:
- Buffer configuration:

**Code Example**
Minimal code that reproduces the issue
```

## 💡 Feature Requests

### Before Requesting

1. Check if it fits the library's scope
2. Consider performance implications
3. Think about backward compatibility
4. Provide use cases and examples

### Feature Request Template

```markdown
**Feature Description**
Clear description of the proposed feature

**Use Case**
Why is this feature needed?

**Proposed API**
How would developers use this feature?

**Performance Impact**
Memory and processing considerations

**Alternative Solutions**
Other ways to achieve the same goal
```

## 📄 Code Style

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer interfaces over types for public APIs
- Use readonly for immutable properties
- Provide proper generic constraints

### Naming Conventions

- Classes: PascalCase (`StreamProcessor`)
- Functions/Variables: camelCase (`processChunk`)
- Constants: UPPER_SNAKE_CASE (`MAX_BUFFER_SIZE`)
- Files: kebab-case (`stream-processor.ts`)

### Code Organization

- Group related functionality
- Keep files focused and cohesive
- Use barrel exports (`index.ts`)
- Separate interfaces from implementations

## 🎖️ Recognition

Contributors will be recognized in:

- README.md contributors section
- Release notes for significant contributions
- Special mentions for architectural improvements

## 📞 Getting Help

- **Issues**: Open a GitHub issue
- **Discussions**: Use GitHub Discussions
- **Email**: contact@codechu.com

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for helping make Streaming Pipeline Core better!** 🚀

*Built with ❤️ by [Codechu](https://codechu.com)*