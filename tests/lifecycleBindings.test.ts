import { describe, expect, test, vi } from 'vitest';
import {
  bindAudioBootstrapBindings,
  bindElementClick,
  bindSimpleEditorResizeBindings,
  bindWindowLifecycle,
  bindWindowResize,
} from '../src/ui/lifecycleBindings';

class FakeEventHub {
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback =
      typeof listener === 'function' ? listener : listener.handleEvent.bind(listener);
    const bucket = this.listeners.get(type) ?? new Set<EventListener>();
    bucket.add(callback);
    this.listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback =
      typeof listener === 'function' ? listener : listener.handleEvent.bind(listener);
    const bucket = this.listeners.get(type);
    if (!bucket) {
      return;
    }
    bucket.forEach((entry) => {
      if (entry === callback) {
        bucket.delete(entry);
      }
    });
  }

  dispatch(type: string): void {
    const event = new Event(type);
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  dispatchEventObject(type: string, event: Event): void {
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

describe('lifecycle bindings', () => {
  test('audio bootstrap bindings can be fully disposed', () => {
    const win = new FakeEventHub();
    const doc = Object.assign(new FakeEventHub(), {
      visibilityState: 'visible' as DocumentVisibilityState,
    });
    const tryUnlock = vi.fn();
    const onHidden = vi.fn();
    const onVisible = vi.fn();

    const cleanup = bindAudioBootstrapBindings({
      win: win as unknown as Window,
      doc: doc as unknown as Document,
      tryUnlock,
      onHidden,
      onVisible,
    });

    expect(win.count('pointerdown')).toBe(1);
    expect(win.count('keydown')).toBe(1);
    expect(win.count('touchstart')).toBe(1);
    expect(win.count('mousedown')).toBe(1);
    expect(win.count('wheel')).toBe(1);
    expect(doc.count('visibilitychange')).toBe(1);

    win.dispatch('pointerdown');
    expect(tryUnlock).toHaveBeenCalledTimes(1);

    doc.visibilityState = 'hidden';
    doc.dispatch('visibilitychange');
    expect(onHidden).toHaveBeenCalledTimes(1);

    doc.visibilityState = 'visible';
    doc.dispatch('visibilitychange');
    expect(onVisible).toHaveBeenCalledTimes(1);

    cleanup();
    expect(win.count('pointerdown')).toBe(0);
    expect(win.count('keydown')).toBe(0);
    expect(win.count('touchstart')).toBe(0);
    expect(win.count('mousedown')).toBe(0);
    expect(win.count('wheel')).toBe(0);
    expect(doc.count('visibilitychange')).toBe(0);
  });

  test('simple editor resize bindings remove resize listener and disconnect observer', () => {
    const win = new FakeEventHub();
    const syncLines = vi.fn();
    const fallback = document.createElement('textarea');
    let disconnected = false;
    const observedTargets: Element[] = [];

    class FakeResizeObserver {
      constructor(private readonly callback: () => void) {}

      observe(target: Element): void {
        observedTargets.push(target);
      }

      disconnect(): void {
        disconnected = true;
      }

      trigger(): void {
        this.callback();
      }
    }

    const cleanup = bindSimpleEditorResizeBindings({
      win: win as unknown as Window,
      fallback,
      syncLines,
      ResizeObserverCtor: FakeResizeObserver as unknown as new (
        callback: () => void,
      ) => ResizeObserver,
    });

    expect(win.count('resize')).toBe(1);
    expect(observedTargets).toEqual([fallback]);

    win.dispatch('resize');
    expect(syncLines).toHaveBeenCalledTimes(1);

    cleanup();
    expect(win.count('resize')).toBe(0);
    expect(disconnected).toBe(true);
  });

  test('window resize binding is removed by cleanup', () => {
    const win = new FakeEventHub();
    const onResize = vi.fn();
    const cleanup = bindWindowResize(win as unknown as Window, onResize);

    expect(win.count('resize')).toBe(1);
    win.dispatch('resize');
    expect(onResize).toHaveBeenCalledTimes(1);

    cleanup();
    expect(win.count('resize')).toBe(0);
    cleanup();
    expect(win.count('resize')).toBe(0);
  });

  test('element click binding is removed by cleanup', () => {
    const button = document.createElement('button');
    const onClick = vi.fn();
    const cleanup = bindElementClick(button, onClick);

    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);

    cleanup();
    button.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('window lifecycle binding attaches and detaches pagehide/beforeunload', () => {
    const win = new FakeEventHub();
    const onPageHide = vi.fn();
    const onBeforeUnload = vi.fn();
    const cleanup = bindWindowLifecycle(win as unknown as Window, onPageHide, onBeforeUnload);

    expect(win.count('pagehide')).toBe(1);
    expect(win.count('beforeunload')).toBe(1);

    const pageHideEvent = new Event('pagehide');
    Object.defineProperty(pageHideEvent, 'persisted', { value: false });
    win.dispatchEventObject('pagehide', pageHideEvent);
    win.dispatch('beforeunload');
    expect(onPageHide).toHaveBeenCalledTimes(1);
    expect(onBeforeUnload).toHaveBeenCalledTimes(1);

    cleanup();
    expect(win.count('pagehide')).toBe(0);
    expect(win.count('beforeunload')).toBe(0);
  });
});
