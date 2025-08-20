import { test, describe } from 'node:test';
import assert from 'node:assert';
import { CircularStreamBuffer, FluentFactory } from '../../src/index.js';

describe('Streaming Pipeline Core - Basic Tests', () => {
  test('should create CircularStreamBuffer', () => {
    const buffer = new CircularStreamBuffer(64, 128);
    assert.ok(buffer, 'Buffer should be created');
  });

  test('should create fluent text pipeline', () => {
    const pipeline = FluentFactory.text();
    assert.ok(pipeline, 'Text pipeline should be created');
  });

  test('should create fluent binary pipeline', () => {
    const pipeline = FluentFactory.binary();
    assert.ok(pipeline, 'Binary pipeline should be created');
  });

  test('should create performance pipeline', () => {
    const pipeline = FluentFactory.performance();
    assert.ok(pipeline, 'Performance pipeline should be created');
  });

  test('should create minimal pipeline', () => {
    const pipeline = FluentFactory.minimal();
    assert.ok(pipeline, 'Minimal pipeline should be created');
  });

  test('should build pipeline successfully', () => {
    const pipeline = FluentFactory.text().build();
    assert.ok(pipeline, 'Pipeline should build successfully');
  });

  test('should configure buffer options', () => {
    const pipeline = FluentFactory.text()
      .buffer({ lookBehindSize: 32, lookAheadSize: 64 });
    assert.ok(pipeline, 'Pipeline with custom buffer should be created');
  });
});