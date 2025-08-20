import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { CircularStreamBuffer, TextCircularBuffer } from '../../src/index.js';

describe('CircularStreamBuffer - Core Tests', () => {
  let buffer: CircularStreamBuffer;
  
  beforeEach(() => {
    buffer = new CircularStreamBuffer(64, 128);
  });

  test('should initialize with correct configuration', () => {
    const state = buffer.getState();
    assert.strictEqual(state.position, 0);
    assert.strictEqual(state.isEOF, false);
  });

  test('should create buffer instance', () => {
    assert.ok(buffer, 'Buffer should be created');
  });

  test('should get buffer state', () => {
    const state = buffer.getState();
    assert.ok(typeof state === 'object', 'State should be object');
    assert.ok(typeof state.position === 'number', 'Position should be number');
  });
});

describe('TextCircularBuffer - Text Tests', () => {
  let buffer: TextCircularBuffer;
  
  beforeEach(() => {
    buffer = new TextCircularBuffer(32, 64);
  });

  test('should create text buffer', () => {
    assert.ok(buffer, 'Text buffer should be created');
  });

  test('should inherit from CircularStreamBuffer', () => {
    assert.ok(buffer instanceof CircularStreamBuffer, 'Should inherit from base class');
  });
});