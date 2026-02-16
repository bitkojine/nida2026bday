import { describe, expect, it } from 'vitest';
import {
  clearPersistedEditorSource,
  EDITOR_SOURCE_STORAGE_KEY,
  readPersistedEditorSource,
  writePersistedEditorSource,
} from '../src/core/editorSourceStorage';

class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) ?? null) : null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('editorSourceStorage', () => {
  it('returns fallback source when no persisted value exists', () => {
    const storage = new MemoryStorage();
    expect(readPersistedEditorSource(storage, 'fallback')).toBe('fallback');
  });

  it('returns persisted source when available', () => {
    const storage = new MemoryStorage();
    storage.setItem(EDITOR_SOURCE_STORAGE_KEY, 'persisted code');
    expect(readPersistedEditorSource(storage, 'fallback')).toBe('persisted code');
  });

  it('writes and clears persisted source key', () => {
    const storage = new MemoryStorage();
    writePersistedEditorSource(storage, 'hello');
    expect(storage.getItem(EDITOR_SOURCE_STORAGE_KEY)).toBe('hello');
    clearPersistedEditorSource(storage);
    expect(storage.getItem(EDITOR_SOURCE_STORAGE_KEY)).toBeNull();
  });
});
