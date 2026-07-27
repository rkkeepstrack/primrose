import { describe, expect, it, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { historyKey, newDraftKey, runs, stashCurrentEdit } from '../../lib/workspace/drafts';
import { dirty, draftDir, request, selectedPath } from '../../lib/workspace/state';
import { runHistory, unsavedEdits, recordRun } from '../../lib/shared/stores';
import type { ApiRequest, RunRecord } from '../../lib/shared/types';

const req = { method: 'GET', url: 'u', query: {}, headers: {}, body: { type: 'json', content: '' } } as ApiRequest;
const run = { at: new Date(), response: null, error: 'x' } as RunRecord;

beforeEach(() => {
  selectedPath.set(null);
  draftDir.set(null);
  request.set(null);
  dirty.set(false);
  runHistory.set({});
  unsavedEdits.set({});
});

describe('historyKey', () => {
  it('uses the selected path when a request is open', () => {
    selectedPath.set('/c/r.toml');
    expect(historyKey()).toBe('/c/r.toml');
  });

  it('gives each draft its own bucket', () => {
    newDraftKey();
    const first = historyKey();
    newDraftKey();
    const second = historyKey();
    expect(first).not.toBe(second);
  });
});

describe('runs', () => {
  it('separates draft histories so runs never leak between drafts', () => {
    newDraftKey();
    recordRun(historyKey(), run);
    expect(get(runs)).toHaveLength(1);
    newDraftKey();
    draftDir.set('/c'); // triggers the derived store to re-evaluate
    expect(get(runs)).toHaveLength(0);
  });
});

describe('stashCurrentEdit', () => {
  it('stashes only when dirty and a path is selected', () => {
    request.set(req);
    selectedPath.set('/c/r.toml');
    dirty.set(false);
    stashCurrentEdit();
    expect(get(unsavedEdits)).toEqual({});

    dirty.set(true);
    stashCurrentEdit();
    expect(get(unsavedEdits)['/c/r.toml']).toBe(req);
  });
});
