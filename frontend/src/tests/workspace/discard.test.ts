import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const ReadRequest = vi.fn();
let discardAnswer = true;
vi.mock('../../../wailsjs/go/main/App', () => ({
  ReadRequest: (...a: unknown[]) => ReadRequest(...a),
  CreateRequest: vi.fn(),
  SaveRequest: vi.fn(),
  GetTree: vi.fn(),
}));
vi.mock('../../../wailsjs/runtime/runtime', () => ({ EventsOn: vi.fn() }));
vi.mock('../../lib/ui/dialogs', () => ({ discardDialog: () => Promise.resolve(discardAnswer) }));
vi.mock('../../lib/workspace/refresh', () => ({ refreshTree: vi.fn().mockResolvedValue(undefined) }));

import { discardChanges } from '../../lib/workspace/requests';
import { edit } from '../../lib/request/requestEdit';
import { canUndo } from '../../lib/request/undo';
import { stashEdit, unsavedEdits } from '../../lib/shared/stores';
import { dirty, draftDir, draftName, request, selectedPath } from '../../lib/workspace/state';
import type { ApiRequest } from '../../lib/shared/types';

function req(url: string): ApiRequest {
  return {
    method: 'GET',
    url,
    query: {},
    disabledQuery: [],
    headers: {},
    body: { type: 'json', content: '' },
    vars: {},
    tests: { script: '' },
  };
}

describe('discardChanges', () => {
  beforeEach(() => {
    discardAnswer = true;
    ReadRequest.mockResolvedValue(req('disk'));
    selectedPath.set('/c/a.toml');
    draftDir.set(null);
    draftName.set(null);
    request.set(req('disk'));
    dirty.set(false);
  });

  it('reloads the saved request from disk and clears the stash and undo stack', async () => {
    edit((r) => (r.url = 'edited'));
    stashEdit('/c/a.toml', get(request)!);
    await discardChanges();
    expect(get(request)?.url).toBe('disk');
    expect(get(dirty)).toBe(false);
    expect(get(unsavedEdits)['/c/a.toml']).toBeUndefined();
    expect(get(canUndo)).toBe(false);
  });

  it('keeps everything when the dialog is declined', async () => {
    discardAnswer = false;
    edit((r) => (r.url = 'edited'));
    await discardChanges();
    expect(get(request)?.url).toBe('edited');
    expect(get(dirty)).toBe(true);
  });

  it('closes an unsaved draft', async () => {
    selectedPath.set(null);
    draftDir.set('/c');
    draftName.set('new');
    dirty.set(true);
    await discardChanges();
    expect(get(request)).toBeNull();
    expect(get(draftDir)).toBeNull();
  });

  it('does nothing when the request is clean', async () => {
    ReadRequest.mockClear();
    await discardChanges();
    expect(ReadRequest).not.toHaveBeenCalled();
  });
});
