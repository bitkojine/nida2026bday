export type Disposer = () => void;

export interface Disposable {
  dispose(): void;
}

export interface RuntimeScope {
  add(resource: Disposer | Disposable | null | undefined): void;
  disposeAll(): void;
}

export function createRuntimeScope(): RuntimeScope {
  const disposers: Disposer[] = [];

  return {
    add(resource): void {
      if (!resource) {
        return;
      }
      if (typeof resource === 'function') {
        disposers.push(resource);
        return;
      }
      disposers.push(() => {
        resource.dispose();
      });
    },
    disposeAll(): void {
      while (disposers.length > 0) {
        const disposer = disposers.pop();
        if (!disposer) {
          continue;
        }
        try {
          disposer();
        } catch {
          // Best effort: continue disposing remaining resources.
        }
      }
    },
  };
}
