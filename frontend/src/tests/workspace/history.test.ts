import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const LoadHistory = vi.fn();
const SaveHistory = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../wailsjs/go/main/App', () => ({
  LoadHistory: (...a: unknown[]) => LoadHistory(...a),
  SaveHistory: (...a: unknown[]) => SaveHistory(...a),
}));

import { loadHistory, SAVE_DEBOUNCE_MS } from '../../lib/workspace/history';
import { historyPaths, touchRecent } from '../../lib/shared/stores';

beforeEach(() => {
  vi.useFakeTimers();
  LoadHistory.mockReset();
  SaveHistory.mockClear();
  historyPaths.set({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe('loadHistory', () => {
  it('puts the backend list (already pruned there) into the store', async () => {
    LoadHistory.mockResolvedValue(['/c/b.toml', '/c/a.toml']);
    await loadHistory('/c');
    expect(LoadHistory).toHaveBeenCalledWith('/c');
    expect(get(historyPaths)['/c']).toEqual(['/c/b.toml', '/c/a.toml']);
  });

  it('falls back to an empty list when the backend errors', async () => {
    LoadHistory.mockRejectedValue(new Error('boom'));
    await loadHistory('/c');
    expect(get(historyPaths)['/c']).toEqual([]);
  });
});

describe('debounced save', () => {
  it('saves once after a burst of touches, with the latest list', async () => {
    LoadHistory.mockResolvedValue([]);
    await loadHistory('/c');
    touchRecent('/c', '/c/a.toml');
    touchRecent('/c', '/c/b.toml');
    touchRecent('/c', '/c/c.toml');
    expect(SaveHistory).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 10);
    expect(SaveHistory).toHaveBeenCalledTimes(1);
    expect(SaveHistory).toHaveBeenCalledWith('/c', ['/c/c.toml', '/c/b.toml', '/c/a.toml']);
  });

  it('does not save a root that was never loaded, and not on load itself', async () => {
    LoadHistory.mockResolvedValue(['/c/a.toml']);
    await loadHistory('/c');
    touchRecent('/never-loaded', '/never-loaded/x.toml');
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 10);
    expect(SaveHistory).not.toHaveBeenCalled();
  });
});
