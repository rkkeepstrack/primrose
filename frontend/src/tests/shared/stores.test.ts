import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { RECENT_MAX, recentPaths, touchRecent, renameRecent, unsavedEdits, stashEdit, dropEdit, pruneEdits } from '../../lib/shared/stores';
import type { ApiRequest } from '../../lib/shared/types';

const fakeReq = { method: 'GET', url: '' } as ApiRequest;

beforeEach(() => {
  recentPaths.set([]);
  unsavedEdits.set({});
});

describe('recentPaths', () => {
  it('keeps most recent first and dedupes', () => {
    touchRecent('/a');
    touchRecent('/b');
    touchRecent('/a');
    expect(get(recentPaths)).toEqual(['/a', '/b']);
  });

  it('caps at RECENT_MAX', () => {
    for (let i = 0; i < RECENT_MAX + 5; i++) touchRecent(`/r${i}`);
    expect(get(recentPaths)).toHaveLength(RECENT_MAX);
    expect(get(recentPaths)[0]).toBe(`/r${RECENT_MAX + 4}`);
  });
});

describe('unsavedEdits', () => {
  it('stash, rename and drop', () => {
    stashEdit('/a', fakeReq);
    renameRecent('/a', '/b');
    expect(get(unsavedEdits)['/b']).toBe(fakeReq);
    expect(get(unsavedEdits)['/a']).toBeUndefined();
    dropEdit('/b');
    expect(get(unsavedEdits)).toEqual({});
  });

  it('prunes edits outside the keep list', () => {
    stashEdit('/keep', fakeReq);
    stashEdit('/discard', fakeReq);
    pruneEdits(['/keep']);
    expect(Object.keys(get(unsavedEdits))).toEqual(['/keep']);
  });
});
