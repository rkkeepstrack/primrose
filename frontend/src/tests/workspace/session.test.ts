// Regression test for the restoreSession / loadHistory gap:
// restoreSession must call LoadHistory for every root it opens, so history
// is available immediately after app restart.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const LoadHistory = vi.fn();
const SaveHistory = vi.fn().mockResolvedValue(undefined);
const LoadUIState = vi.fn();
const OpenCollection = vi.fn();
const SaveUIState = vi.fn().mockResolvedValue(undefined);

vi.mock('../../../wailsjs/go/main/App', () => ({
  LoadHistory: (...a: unknown[]) => LoadHistory(...a),
  SaveHistory: (...a: unknown[]) => SaveHistory(...a),
  LoadUIState: (...a: unknown[]) => LoadUIState(...a),
  OpenCollection: (...a: unknown[]) => OpenCollection(...a),
  SaveUIState: (...a: unknown[]) => SaveUIState(...a),
}));

// Stub out other wails modules this module chain imports
vi.mock('../../../wailsjs/go/models', () => ({
  appstate: { State: { createFrom: (v: unknown) => v } },
}));

vi.mock('../../lib/workspace/theme', () => ({
  applyTheme: vi.fn(),
  currentTheme: () => 'default',
}));
vi.mock('../../lib/workspace/environments', () => ({
  loadEnvironments: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../lib/workspace/tabs', () => ({
  addCollectionTab: vi.fn(),
  activateTab: vi.fn(),
  isSpecialTab: () => false,
  tabOrder: {
    subscribe: (cb: (v: string[]) => void) => {
      cb([]);
      return () => {};
    },
  },
}));

import { historyPaths } from '../../lib/shared/stores';

beforeEach(() => {
  LoadHistory.mockReset();
  LoadHistory.mockResolvedValue([]);
  historyPaths.set({});
});

describe('restoreSession', () => {
  it('calls LoadHistory for each restored root', async () => {
    const roots = ['/col/a', '/col/b'];
    LoadUIState.mockResolvedValue({ openRoots: roots, activeRoot: roots[0], theme: 'default' });
    OpenCollection.mockImplementation((root: string) => Promise.resolve({ root, name: root, headers: {}, tree: [] }));

    // Dynamic import so mocks are in place before the module loads
    const { restoreSession } = await import('../../lib/workspace/session');
    await restoreSession();

    expect(LoadHistory).toHaveBeenCalledTimes(2);
    expect(LoadHistory).toHaveBeenCalledWith('/col/a');
    expect(LoadHistory).toHaveBeenCalledWith('/col/b');
  });
});
