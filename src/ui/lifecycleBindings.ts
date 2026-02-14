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

  win.addEventListener('pointerdown', tryUnlock, { passive: true });
  win.addEventListener('keydown', tryUnlock);
  win.addEventListener('touchstart', tryUnlock, { passive: true });
  win.addEventListener('mousedown', tryUnlock);
  win.addEventListener('wheel', tryUnlock, { passive: true });
  doc.addEventListener('visibilitychange', onVisibilityChange);

  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    win.removeEventListener('pointerdown', tryUnlock);
    win.removeEventListener('keydown', tryUnlock);
    win.removeEventListener('touchstart', tryUnlock);
    win.removeEventListener('mousedown', tryUnlock);
    win.removeEventListener('wheel', tryUnlock);
    doc.removeEventListener('visibilitychange', onVisibilityChange);
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
  win.addEventListener('resize', syncLines, { passive: true });

  const observer = ResizeObserverCtor ? new ResizeObserverCtor(syncLines) : null;
  observer?.observe(fallback);

  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    win.removeEventListener('resize', syncLines);
    observer?.disconnect();
  };
}

export function bindWindowResize(
  win: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  onResize: () => void,
): () => void {
  win.addEventListener('resize', onResize, { passive: true });
  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    win.removeEventListener('resize', onResize);
  };
}

export function bindElementClick(
  element: Pick<HTMLElement, 'addEventListener' | 'removeEventListener'>,
  onClick: () => void,
): () => void {
  element.addEventListener('click', onClick);
  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    element.removeEventListener('click', onClick);
  };
}

export function bindWindowLifecycle(
  win: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  onPageHide: (event: PageTransitionEvent) => void,
  onBeforeUnload: () => void,
): () => void {
  win.addEventListener('pagehide', onPageHide);
  win.addEventListener('beforeunload', onBeforeUnload);
  let cleaned = false;
  return (): void => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    win.removeEventListener('pagehide', onPageHide);
    win.removeEventListener('beforeunload', onBeforeUnload);
  };
}
