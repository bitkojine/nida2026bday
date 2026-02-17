import { describe, expect, it } from 'vitest';
import {
  cancelTrackedAnimationFrame,
  clearTrackedInterval,
  clearTrackedTimeout,
  createTrackedAbortController,
  requestTrackedAnimationFrame,
  setTrackedInterval,
  setTrackedTimeout,
} from '../src/core/trackedAsync';
import { readResourceStatsSnapshot, resetResourceStatsForTests } from '../src/core/resourceTracker';

interface FakeWindowTimers {
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(timeoutId: number): void;
  setInterval(callback: () => void, delayMs: number): number;
  clearInterval(intervalId: number): void;
  requestAnimationFrame(callback: FrameRequestCallback): number;
  cancelAnimationFrame(rafId: number): void;
}

function createFakeWindowTimers(): {
  windowLike: FakeWindowTimers;
  runTimeout(timeoutId: number): void;
  runRaf(rafId: number, timeMs?: number): void;
} {
  let nextId = 1;
  const timeouts = new Map<number, () => void>();
  const intervals = new Map<number, () => void>();
  const rafs = new Map<number, FrameRequestCallback>();

  return {
    windowLike: {
      setTimeout(callback: () => void): number {
        const id = nextId++;
        timeouts.set(id, callback);
        return id;
      },
      clearTimeout(timeoutId: number): void {
        timeouts.delete(timeoutId);
      },
      setInterval(callback: () => void): number {
        const id = nextId++;
        intervals.set(id, callback);
        return id;
      },
      clearInterval(intervalId: number): void {
        intervals.delete(intervalId);
      },
      requestAnimationFrame(callback: FrameRequestCallback): number {
        const id = nextId++;
        rafs.set(id, callback);
        return id;
      },
      cancelAnimationFrame(rafId: number): void {
        rafs.delete(rafId);
      },
    },
    runTimeout(timeoutId: number): void {
      const callback = timeouts.get(timeoutId);
      if (!callback) {
        return;
      }
      timeouts.delete(timeoutId);
      callback();
    },
    runRaf(rafId: number, timeMs = 16.7): void {
      const callback = rafs.get(rafId);
      if (!callback) {
        return;
      }
      rafs.delete(rafId);
      callback(timeMs);
    },
  };
}

describe('trackedAsync', () => {
  it('tracks timeout lifecycle for fire and manual clear paths', () => {
    resetResourceStatsForTests();
    const fake = createFakeWindowTimers();
    const timeoutId = setTrackedTimeout(
      fake.windowLike as unknown as Pick<Window, 'setTimeout' | 'clearTimeout'>,
      () => {},
      10,
    );
    expect(readResourceStatsSnapshot().activeTimeouts).toBe(1);
    fake.runTimeout(timeoutId);
    expect(readResourceStatsSnapshot().activeTimeouts).toBe(0);

    const timeoutId2 = setTrackedTimeout(
      fake.windowLike as unknown as Pick<Window, 'setTimeout' | 'clearTimeout'>,
      () => {},
      10,
    );
    clearTrackedTimeout(fake.windowLike as unknown as Pick<Window, 'clearTimeout'>, timeoutId2);
    expect(readResourceStatsSnapshot().activeTimeouts).toBe(0);
  });

  it('tracks interval, raf and abort controller lifecycle', () => {
    resetResourceStatsForTests();
    const fake = createFakeWindowTimers();

    const intervalId = setTrackedInterval(
      fake.windowLike as unknown as Pick<Window, 'setInterval' | 'clearInterval'>,
      () => {},
      50,
    );
    expect(readResourceStatsSnapshot().activeIntervals).toBe(1);
    clearTrackedInterval(fake.windowLike as unknown as Pick<Window, 'clearInterval'>, intervalId);
    expect(readResourceStatsSnapshot().activeIntervals).toBe(0);

    const rafId = requestTrackedAnimationFrame(
      fake.windowLike as unknown as Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>,
      () => {},
    );
    expect(readResourceStatsSnapshot().activeRafs).toBe(1);
    fake.runRaf(rafId);
    expect(readResourceStatsSnapshot().activeRafs).toBe(0);

    const rafId2 = requestTrackedAnimationFrame(
      fake.windowLike as unknown as Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>,
      () => {},
    );
    cancelTrackedAnimationFrame(
      fake.windowLike as unknown as Pick<Window, 'cancelAnimationFrame'>,
      rafId2,
    );
    expect(readResourceStatsSnapshot().activeRafs).toBe(0);

    const controller = createTrackedAbortController();
    expect(readResourceStatsSnapshot().activeAbortControllers).toBe(1);
    controller.abort();
    expect(readResourceStatsSnapshot().activeAbortControllers).toBe(0);
  });
});
