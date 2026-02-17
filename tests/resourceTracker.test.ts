import { describe, expect, it } from 'vitest';
import {
  readResourceStatsSnapshot,
  resetResourceStatsForTests,
  trackAbortControllerAdded,
  trackAbortControllerRemoved,
  trackEventListenerAdded,
  trackEventListenerRemoved,
  trackIntervalAdded,
  trackIntervalRemoved,
  trackRafAdded,
  trackRafRemoved,
  trackResizeObserverAdded,
  trackResizeObserverRemoved,
  trackSyntaxTreeAdded,
  trackSyntaxTreeRemoved,
  trackTimeoutAdded,
  trackTimeoutRemoved,
} from '../src/core/resourceTracker';

describe('resourceTracker', () => {
  it('tracks active and peak counters without dropping below zero', () => {
    resetResourceStatsForTests();
    trackEventListenerAdded();
    trackEventListenerAdded();
    trackEventListenerRemoved();
    trackTimeoutAdded();
    trackTimeoutRemoved();
    trackTimeoutRemoved();
    trackIntervalAdded();
    trackIntervalRemoved();
    trackRafAdded();
    trackRafRemoved();
    trackAbortControllerAdded();
    trackAbortControllerRemoved();
    trackResizeObserverAdded();
    trackResizeObserverRemoved();
    trackSyntaxTreeAdded();
    trackSyntaxTreeRemoved();

    const snapshot = readResourceStatsSnapshot();
    expect(snapshot.activeEventListeners).toBe(1);
    expect(snapshot.peakEventListeners).toBe(2);
    expect(snapshot.activeTimeouts).toBe(0);
    expect(snapshot.peakTimeouts).toBe(1);
    expect(snapshot.activeIntervals).toBe(0);
    expect(snapshot.activeRafs).toBe(0);
    expect(snapshot.activeAbortControllers).toBe(0);
    expect(snapshot.activeResizeObservers).toBe(0);
    expect(snapshot.activeSyntaxTrees).toBe(0);
  });
});
