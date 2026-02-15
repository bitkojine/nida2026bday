import { describe, expect, test, vi } from 'vitest';
import { createRuntimeScope, type Disposable } from '../src/core/runtimeScope';

describe('runtimeScope', () => {
  test('disposes registered function disposers in reverse order', () => {
    const scope = createRuntimeScope();
    const calls: string[] = [];
    scope.add(() => calls.push('a'));
    scope.add(() => calls.push('b'));
    scope.add(() => calls.push('c'));

    scope.disposeAll();
    expect(calls).toEqual(['c', 'b', 'a']);
  });

  test('accepts Disposable objects and ignores null-like resources', () => {
    const scope = createRuntimeScope();
    const dispose = vi.fn();
    const disposable: Disposable = { dispose };
    scope.add(null);
    scope.add(undefined);
    scope.add(disposable);

    scope.disposeAll();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  test('continues disposing even when one disposer throws', () => {
    const scope = createRuntimeScope();
    const safe = vi.fn();
    scope.add(() => {
      throw new Error('boom');
    });
    scope.add(safe);

    expect(() => scope.disposeAll()).not.toThrow();
    expect(safe).toHaveBeenCalledTimes(1);
  });
});
