import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import {
  RECENT_MAX,
  recentPaths,
  touchRecent,
  dropRecents,
  renameRecent,
  unsavedEdits,
  stashEdit,
  dropEdit,
  HISTORY_MAX,
  historyPaths,
  setHistory,
} from '../../lib/shared/stores';
import type { ApiRequest } from '../../lib/shared/types';

const fakeReq = { method: 'GET', url: '' } as ApiRequest;

beforeEach(() => {
  recentPaths.set({});
  unsavedEdits.set({});
  historyPaths.set({});
});

describe('recentPaths', () => {
  it('keeps most recent first and dedupes', () => {
    touchRecent('/c', '/c/a');
    touchRecent('/c', '/c/b');
    touchRecent('/c', '/c/a');
    expect(get(recentPaths)['/c']).toEqual(['/c/a', '/c/b']);
  });

  it('caps at RECENT_MAX', () => {
    for (let i = 0; i < RECENT_MAX + 5; i++) touchRecent('/c', `/c/r${i}`);
    expect(get(recentPaths)['/c']).toHaveLength(RECENT_MAX);
    expect(get(recentPaths)['/c'][0]).toBe(`/c/r${RECENT_MAX + 4}`);
  });

  it('keeps a separate window per collection root', () => {
    touchRecent('/c', '/c/a');
    touchRecent('/d', '/d/x');
    expect(get(recentPaths)['/c']).toEqual(['/c/a']);
    expect(get(recentPaths)['/d']).toEqual(['/d/x']);
    dropRecents('/c');
    expect(get(recentPaths)['/c']).toBeUndefined();
    expect(get(recentPaths)['/d']).toEqual(['/d/x']);
  });
});

describe('historyPaths', () => {
  it('touchRecent also feeds the history list, deduped by recency', () => {
    touchRecent('/c', '/c/a');
    touchRecent('/c', '/c/b');
    touchRecent('/c', '/c/a');
    expect(get(historyPaths)['/c']).toEqual(['/c/a', '/c/b']);
  });

  it('caps at HISTORY_MAX while recentPaths keeps its own smaller cap', () => {
    for (let i = 0; i < HISTORY_MAX + 5; i++) touchRecent('/c', `/c/r${i}`);
    expect(get(historyPaths)['/c']).toHaveLength(HISTORY_MAX);
    expect(get(historyPaths)['/c'][0]).toBe(`/c/r${HISTORY_MAX + 4}`);
    expect(get(recentPaths)['/c']).toHaveLength(RECENT_MAX);
  });

  it('keeps a separate list per collection root', () => {
    touchRecent('/c', '/c/a');
    touchRecent('/d', '/d/x');
    expect(get(historyPaths)['/c']).toEqual(['/c/a']);
    expect(get(historyPaths)['/d']).toEqual(['/d/x']);
  });

  it('setHistory replaces a root list and enforces the cap', () => {
    setHistory('/c', Array.from({ length: HISTORY_MAX + 3 }, (_, i) => `/c/r${i}`));
    expect(get(historyPaths)['/c']).toHaveLength(HISTORY_MAX);
    expect(get(historyPaths)['/c'][0]).toBe('/c/r0');
  });

  it('dropRecents clears the session recents but not the history', () => {
    touchRecent('/c', '/c/a');
    dropRecents('/c');
    expect(get(recentPaths)['/c']).toBeUndefined();
    expect(get(historyPaths)['/c']).toEqual(['/c/a']);
  });

  it('renameRecent renames history entries too', () => {
    touchRecent('/c', '/c/a');
    renameRecent('/c/a', '/c/b');
    expect(get(historyPaths)['/c']).toEqual(['/c/b']);
  });
});

describe('unsavedEdits', () => {
  it('stash, rename and drop', () => {
    stashEdit('/c/a', fakeReq);
    renameRecent('/c/a', '/c/b');
    expect(get(unsavedEdits)['/c/b']).toBe(fakeReq);
    expect(get(unsavedEdits)['/c/a']).toBeUndefined();
    dropEdit('/c/b');
    expect(get(unsavedEdits)).toEqual({});
  });

  it('discards stashed edits once the request leaves the recents window', () => {
    touchRecent('/c', '/c/old');
    stashEdit('/c/old', fakeReq);
    touchRecent('/c', '/c/still-recent');
    stashEdit('/c/still-recent', fakeReq);
    for (let i = 0; i < RECENT_MAX - 1; i++) touchRecent('/c', `/c/r${i}`);
    expect(get(unsavedEdits)['/c/still-recent']).toBe(fakeReq);
    expect(get(unsavedEdits)['/c/old']).toBeUndefined();
  });

  it('pruning one collection leaves other collections’ edits alone', () => {
    touchRecent('/d', '/d/kept');
    stashEdit('/d/kept', fakeReq);
    for (let i = 0; i < RECENT_MAX + 1; i++) touchRecent('/c', `/c/r${i}`);
    expect(get(unsavedEdits)['/d/kept']).toBe(fakeReq);
  });
});
