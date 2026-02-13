import { describe, expect, it } from 'vitest';
import { normalizeLaneFromKey, normalizeLaneFromX } from '../src/core/inputController';

describe('InputController', () => {
  it('maps X to lane', () => {
    expect(normalizeLaneFromX(0, 400, 4)).toBe(0);
    expect(normalizeLaneFromX(199, 400, 4)).toBe(1);
    expect(normalizeLaneFromX(399, 400, 4)).toBe(3);
  });

  it('clamps out-of-range X values', () => {
    expect(normalizeLaneFromX(-50, 400, 4)).toBe(0);
    expect(normalizeLaneFromX(500, 400, 4)).toBe(3);
  });

  it('maps keyboard keys to lanes', () => {
    expect(normalizeLaneFromKey('A')).toBe(0);
    expect(normalizeLaneFromKey('s')).toBe(1);
    expect(normalizeLaneFromKey('k')).toBe(2);
    expect(normalizeLaneFromKey('l')).toBe(3);
    expect(normalizeLaneFromKey('ArrowLeft')).toBe(0);
    expect(normalizeLaneFromKey('ArrowDown')).toBe(1);
    expect(normalizeLaneFromKey('ArrowUp')).toBe(2);
    expect(normalizeLaneFromKey('ArrowRight')).toBe(3);
    expect(normalizeLaneFromKey('x')).toBeNull();
  });

  it('handles invalid dimensions defensively', () => {
    expect(normalizeLaneFromX(10, 0, 4)).toBe(0);
    expect(normalizeLaneFromX(10, 400, 1)).toBe(0);
  });
});
