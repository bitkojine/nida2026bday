import {
  trackAbortControllerAdded,
  trackAbortControllerRemoved,
  trackIntervalAdded,
  trackIntervalRemoved,
  trackRafAdded,
  trackRafRemoved,
  trackTimeoutAdded,
  trackTimeoutRemoved,
} from './resourceTracker';

const activeTimeoutIds = new Set<number>();
const activeIntervalIds = new Set<number>();
const activeRafIds = new Set<number>();
const activeAbortControllers = new WeakSet<AbortController>();

export function createTrackedAbortController(): AbortController {
  const controller = new AbortController();
  trackAbortControllerAdded();
  activeAbortControllers.add(controller);
  const clear = (): void => {
    if (!activeAbortControllers.has(controller)) {
      return;
    }
    activeAbortControllers.delete(controller);
    trackAbortControllerRemoved();
  };
  if (controller.signal.aborted) {
    clear();
  } else {
    controller.signal.addEventListener('abort', clear, { once: true });
  }
  return controller;
}

export function setTrackedTimeout(
  win: Pick<Window, 'setTimeout' | 'clearTimeout'>,
  callback: () => void,
  delayMs: number,
): number {
  let timeoutId = 0;
  const wrapped = (): void => {
    if (activeTimeoutIds.delete(timeoutId)) {
      trackTimeoutRemoved();
    }
    callback();
  };
  timeoutId = win.setTimeout(wrapped, delayMs);
  activeTimeoutIds.add(timeoutId);
  trackTimeoutAdded();
  return timeoutId;
}

export function clearTrackedTimeout(
  win: Pick<Window, 'clearTimeout'>,
  timeoutId: number | null,
): void {
  if (timeoutId === null) {
    return;
  }
  if (activeTimeoutIds.delete(timeoutId)) {
    trackTimeoutRemoved();
  }
  win.clearTimeout(timeoutId);
}

export function setTrackedInterval(
  win: Pick<Window, 'setInterval' | 'clearInterval'>,
  callback: () => void,
  delayMs: number,
): number {
  const intervalId = win.setInterval(callback, delayMs);
  activeIntervalIds.add(intervalId);
  trackIntervalAdded();
  return intervalId;
}

export function clearTrackedInterval(
  win: Pick<Window, 'clearInterval'>,
  intervalId: number | null,
): void {
  if (intervalId === null) {
    return;
  }
  if (activeIntervalIds.delete(intervalId)) {
    trackIntervalRemoved();
  }
  win.clearInterval(intervalId);
}

export function requestTrackedAnimationFrame(
  win: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame'>,
  callback: FrameRequestCallback,
): number {
  let rafId = 0;
  const wrapped: FrameRequestCallback = (timeMs) => {
    if (activeRafIds.delete(rafId)) {
      trackRafRemoved();
    }
    callback(timeMs);
  };
  rafId = win.requestAnimationFrame(wrapped);
  activeRafIds.add(rafId);
  trackRafAdded();
  return rafId;
}

export function cancelTrackedAnimationFrame(
  win: Pick<Window, 'cancelAnimationFrame'>,
  rafId: number | null,
): void {
  if (rafId === null) {
    return;
  }
  if (activeRafIds.delete(rafId)) {
    trackRafRemoved();
  }
  win.cancelAnimationFrame(rafId);
}
