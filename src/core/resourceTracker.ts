export interface ResourceStatsSnapshot {
  activeEventListeners: number;
  activeTimeouts: number;
  activeIntervals: number;
  activeRafs: number;
  activeAbortControllers: number;
  activeResizeObservers: number;
  activeSyntaxTrees: number;
  peakEventListeners: number;
  peakTimeouts: number;
  peakIntervals: number;
  peakRafs: number;
  peakAbortControllers: number;
  peakResizeObservers: number;
  peakSyntaxTrees: number;
}

type MutableResourceStats = ResourceStatsSnapshot;

const stats: MutableResourceStats = {
  activeEventListeners: 0,
  activeTimeouts: 0,
  activeIntervals: 0,
  activeRafs: 0,
  activeAbortControllers: 0,
  activeResizeObservers: 0,
  activeSyntaxTrees: 0,
  peakEventListeners: 0,
  peakTimeouts: 0,
  peakIntervals: 0,
  peakRafs: 0,
  peakAbortControllers: 0,
  peakResizeObservers: 0,
  peakSyntaxTrees: 0,
};

function clampActive(value: number): number {
  return Math.max(0, Math.trunc(value));
}

function setActive<K extends keyof MutableResourceStats, P extends keyof MutableResourceStats>(
  activeKey: K,
  peakKey: P,
  nextActive: number,
): void {
  const normalized = clampActive(nextActive);
  stats[activeKey] = normalized as MutableResourceStats[K];
  const peakValue = Number(stats[peakKey] ?? 0);
  if (normalized > peakValue) {
    stats[peakKey] = normalized as MutableResourceStats[P];
  }
}

function bump(
  activeKey: keyof Pick<
    MutableResourceStats,
    | 'activeEventListeners'
    | 'activeTimeouts'
    | 'activeIntervals'
    | 'activeRafs'
    | 'activeAbortControllers'
    | 'activeResizeObservers'
    | 'activeSyntaxTrees'
  >,
  peakKey: keyof Pick<
    MutableResourceStats,
    | 'peakEventListeners'
    | 'peakTimeouts'
    | 'peakIntervals'
    | 'peakRafs'
    | 'peakAbortControllers'
    | 'peakResizeObservers'
    | 'peakSyntaxTrees'
  >,
  delta: number,
): void {
  const current = Number(stats[activeKey] ?? 0);
  setActive(activeKey, peakKey, current + delta);
}

export function trackEventListenerAdded(): void {
  bump('activeEventListeners', 'peakEventListeners', 1);
}

export function trackEventListenerRemoved(): void {
  bump('activeEventListeners', 'peakEventListeners', -1);
}

export function trackTimeoutAdded(): void {
  bump('activeTimeouts', 'peakTimeouts', 1);
}

export function trackTimeoutRemoved(): void {
  bump('activeTimeouts', 'peakTimeouts', -1);
}

export function trackIntervalAdded(): void {
  bump('activeIntervals', 'peakIntervals', 1);
}

export function trackIntervalRemoved(): void {
  bump('activeIntervals', 'peakIntervals', -1);
}

export function trackRafAdded(): void {
  bump('activeRafs', 'peakRafs', 1);
}

export function trackRafRemoved(): void {
  bump('activeRafs', 'peakRafs', -1);
}

export function trackAbortControllerAdded(): void {
  bump('activeAbortControllers', 'peakAbortControllers', 1);
}

export function trackAbortControllerRemoved(): void {
  bump('activeAbortControllers', 'peakAbortControllers', -1);
}

export function trackResizeObserverAdded(): void {
  bump('activeResizeObservers', 'peakResizeObservers', 1);
}

export function trackResizeObserverRemoved(): void {
  bump('activeResizeObservers', 'peakResizeObservers', -1);
}

export function trackSyntaxTreeAdded(): void {
  bump('activeSyntaxTrees', 'peakSyntaxTrees', 1);
}

export function trackSyntaxTreeRemoved(): void {
  bump('activeSyntaxTrees', 'peakSyntaxTrees', -1);
}

export function readResourceStatsSnapshot(): ResourceStatsSnapshot {
  return { ...stats };
}

export function resetResourceStatsForTests(): void {
  stats.activeEventListeners = 0;
  stats.activeTimeouts = 0;
  stats.activeIntervals = 0;
  stats.activeRafs = 0;
  stats.activeAbortControllers = 0;
  stats.activeResizeObservers = 0;
  stats.activeSyntaxTrees = 0;
  stats.peakEventListeners = 0;
  stats.peakTimeouts = 0;
  stats.peakIntervals = 0;
  stats.peakRafs = 0;
  stats.peakAbortControllers = 0;
  stats.peakResizeObservers = 0;
  stats.peakSyntaxTrees = 0;
}
