import {
  trackEventListenerAdded,
  trackEventListenerRemoved,
  trackResizeObserverAdded,
  trackResizeObserverRemoved,
} from '../core/resourceTracker';

interface EventTargetLike {
  addEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => void;
  removeEventListener: (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => void;
}

export function bindTrackedEventListener(
  target: EventTargetLike,
  type: string,
  listener: EventListenerOrEventListenerObject,
  options?: boolean | AddEventListenerOptions,
): () => void {
  target.addEventListener(type, listener, options);
  trackEventListenerAdded();

  let cleaned = false;
  const signal = typeof options === 'object' && options !== null ? options.signal : undefined;
  const onSignalAbort = (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    trackEventListenerRemoved();
  };
  if (signal) {
    if (signal.aborted) {
      onSignalAbort();
    } else {
      signal.addEventListener('abort', onSignalAbort, { once: true });
    }
  }

  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    if (signal) {
      signal.removeEventListener('abort', onSignalAbort);
    }
    target.removeEventListener(type, listener, options);
    trackEventListenerRemoved();
  };
}

export interface AudioBootstrapBindingsOptions {
  win: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  doc: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  tryUnlock: () => void;
  onHidden: () => void;
  onVisible: () => void;
}

export function bindAudioBootstrapBindings(options: AudioBootstrapBindingsOptions): () => void {
  const { win, doc, tryUnlock, onHidden, onVisible } = options;

  const onVisibilityChange = (): void => {
    if (doc.visibilityState === 'hidden') {
      onHidden();
      return;
    }
    if (doc.visibilityState === 'visible') {
      onVisible();
    }
  };

  const unbindPointerDown = bindTrackedEventListener(win, 'pointerdown', tryUnlock, {
    passive: true,
  });
  const unbindKeyDown = bindTrackedEventListener(win, 'keydown', tryUnlock);
  const unbindTouchStart = bindTrackedEventListener(win, 'touchstart', tryUnlock, {
    passive: true,
  });
  const unbindMouseDown = bindTrackedEventListener(win, 'mousedown', tryUnlock);
  const unbindWheel = bindTrackedEventListener(win, 'wheel', tryUnlock, {
    passive: true,
  });
  const unbindVisibility = bindTrackedEventListener(doc, 'visibilitychange', onVisibilityChange);

  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    unbindPointerDown();
    unbindKeyDown();
    unbindTouchStart();
    unbindMouseDown();
    unbindWheel();
    unbindVisibility();
  };
}

interface ResizeObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

interface ResizeObserverLikeCtor {
  new (callback: () => void): ResizeObserverLike;
}

export interface SimpleEditorResizeBindingsOptions {
  win: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  fallback: Element;
  syncLines: () => void;
  ResizeObserverCtor?: ResizeObserverLikeCtor;
}

export function bindSimpleEditorResizeBindings(
  options: SimpleEditorResizeBindingsOptions,
): () => void {
  const { win, fallback, syncLines, ResizeObserverCtor } = options;
  const unbindResize = bindTrackedEventListener(win, 'resize', syncLines, { passive: true });

  const observer = ResizeObserverCtor ? new ResizeObserverCtor(syncLines) : null;
  if (observer) {
    trackResizeObserverAdded();
  }
  observer?.observe(fallback);

  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    unbindResize();
    observer?.disconnect();
    if (observer) {
      trackResizeObserverRemoved();
    }
  };
}

export function bindWindowResize(
  win: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  onResize: () => void,
): () => void {
  const unbind = bindTrackedEventListener(win, 'resize', onResize, { passive: true });
  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    unbind();
  };
}

export function bindElementClick(
  element: Pick<HTMLElement, 'addEventListener' | 'removeEventListener'>,
  onClick: () => void,
): () => void {
  return bindTrackedEventListener(element, 'click', onClick);
}

export function bindWindowLifecycle(
  win: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  onPageHide: (event: PageTransitionEvent) => void,
  onBeforeUnload: () => void,
): () => void {
  const unbindPageHide = bindTrackedEventListener(win, 'pagehide', onPageHide as EventListener);
  const unbindBeforeUnload = bindTrackedEventListener(win, 'beforeunload', onBeforeUnload);
  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    unbindPageHide();
    unbindBeforeUnload();
  };
}
