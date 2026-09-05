import { test, expect, describe } from 'bun:test';
import {
  jsonCodec, onOffCodec, onUnlessOffCodec, stringCodec, numberCodec,
} from '../../hooks/persistCodecs';

describe('onOffCodec', () => {
  test("serializes bool to 'on'/'off'", () => {
    expect(onOffCodec.serialize(true)).toBe('on');
    expect(onOffCodec.serialize(false)).toBe('off');
  });
  test("parses 'on' as true, everything else false", () => {
    expect(onOffCodec.parse('on')).toBe(true);
    expect(onOffCodec.parse('off')).toBe(false);
    expect(onOffCodec.parse('garbage')).toBe(false);
  });
});

describe('onUnlessOffCodec (on-by-default idiom)', () => {
  test("only the literal 'off' is false", () => {
    expect(onUnlessOffCodec.parse('off')).toBe(false);
    expect(onUnlessOffCodec.parse('on')).toBe(true);
    expect(onUnlessOffCodec.parse('anything')).toBe(true);
  });
});

describe('stringCodec', () => {
  test('round-trips verbatim', () => {
    expect(stringCodec.parse('comfortable')).toBe('comfortable');
    expect(stringCodec.serialize('compact')).toBe('compact');
  });
});

describe('numberCodec', () => {
  test('float parse', () => {
    expect(numberCodec().parse('1.5')).toBe(1.5);
  });
  test('int parse', () => {
    expect(numberCodec({ int: true }).parse('30')).toBe(30);
    expect(numberCodec({ int: true }).parse('30.9')).toBe(30);
  });
  test('returns undefined for non-finite (falls back to default)', () => {
    expect(numberCodec().parse('not-a-number')).toBeUndefined();
  });
  test('returns undefined when the validity predicate fails', () => {
    const codec = numberCodec({ valid: (n) => n > 0 });
    expect(codec.parse('5')).toBe(5);
    expect(codec.parse('-1')).toBeUndefined();
    expect(codec.parse('0')).toBeUndefined();
  });
  test('range predicate (e.g. banner opacity 20..100)', () => {
    const codec = numberCodec({ int: true, valid: (n) => n >= 20 && n <= 100 });
    expect(codec.parse('55')).toBe(55);
    expect(codec.parse('10')).toBeUndefined();
    expect(codec.parse('200')).toBeUndefined();
  });
});

describe('jsonCodec', () => {
  test('round-trips objects', () => {
    const obj = { zones: true, heatmap: false };
    expect(jsonCodec.parse(jsonCodec.serialize(obj))).toEqual(obj);
  });
});
