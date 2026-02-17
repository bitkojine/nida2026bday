export const EDITOR_SOURCE_STORAGE_KEY = 'nida2026bday:editorSource:v1';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function readPersistedEditorSource(storage: StorageLike, fallbackSource: string): string {
  try {
    const persisted = storage.getItem(EDITOR_SOURCE_STORAGE_KEY);
    if (persisted === null) {
      return fallbackSource;
    }
    return persisted;
  } catch {
    return fallbackSource;
  }
}

export function writePersistedEditorSource(storage: StorageLike, source: string): void {
  try {
    storage.setItem(EDITOR_SOURCE_STORAGE_KEY, source);
  } catch {
    // Ignore storage failures; editor still works for current session.
  }
}

export function clearPersistedEditorSource(storage: StorageLike): void {
  try {
    storage.removeItem(EDITOR_SOURCE_STORAGE_KEY);
  } catch {
    // Ignore storage failures; editor still resets in-memory.
  }
}
