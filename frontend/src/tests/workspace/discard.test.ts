import { beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const ReadRequest = vi.fn();
const CreateRequest = vi.fn();
const SaveRequest = vi.fn().mockResolvedValue(undefined);
let discardAnswer = true;
vi.mock('../../../wailsjs/go/main/App', () => ({
  ReadRequest: (...a: unknown[]) => ReadRequest(...a),
  CreateRequest: (...a: unknown[]) => CreateRequest(...a),
  SaveRequest: (...a: unknown[]) => SaveRequest(...a),
  GetTree: vi.fn(),
}));
vi.mock('../../../wailsjs/runtime/runtime', () => ({ EventsOn: vi.fn() }));
vi.mock('../../lib/ui/dialogs', () => ({ discardDialog: () => Promise.resolve(discardAnswer) }));
vi.mock('../../lib/workspace/refresh', () => ({ refreshTree: vi.fn().mockResolvedValue(undefined) }));

import { discardChanges, newRequest, saveRequest } from '../../lib/workspace/requests';
import { reloadFromDisk } from '../../lib/workspace/sync';
import { editIdentity } from '../../lib/workspace/drafts';
import { edit } from '../../lib/request/requestEdit';
import { canUndo, resetUndo, undo } from '../../lib/request/undo';
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

describe('undo identity and the disk baseline', () => {
  beforeEach(() => {
    discardAnswer = true;
    ReadRequest.mockResolvedValue(req('disk'));
  });

  it('a new draft next to a draft starts with an empty undo stack and a new editor identity', async () => {
    await newRequest('/c');
    const first = get(editIdentity);
    edit((r) => (r.url = 'https://first-draft'));
    await newRequest('/c');
    expect(get(editIdentity)).not.toBe(first);
    expect(get(canUndo)).toBe(false);
  });

  it('saving a draft keeps the editor identity, so nothing rebuilds under the cursor', async () => {
    CreateRequest.mockResolvedValue('/c/new.toml');
    await newRequest('/c');
    draftName.set('new');
    const id = get(editIdentity);
    await saveRequest();
    expect(get(selectedPath)).toBe('/c/new.toml');
    expect(get(editIdentity)).toBe(id);
  });

  it('undo after a save marks the request dirty again, because disk moved on', async () => {
    selectedPath.set('/c/a.toml');
    draftDir.set(null);
    draftName.set(null);
    request.set(req('disk'));
    dirty.set(false);
    resetUndo();
    edit((r) => (r.method = 'POST'));
    await saveRequest();
    expect(get(dirty)).toBe(false);
    undo();
    expect(get(request)?.method).toBe('GET');
    expect(get(dirty)).toBe(true);
  });

  it('undo after reloading from disk marks the request dirty', async () => {
    selectedPath.set('/c/a.toml');
    draftDir.set(null);
    request.set(req('mine'));
    dirty.set(false);
    resetUndo();
    edit((r) => (r.url = 'edited'));
    await reloadFromDisk();
    expect(get(request)?.url).toBe('disk');
    undo();
    expect(get(request)?.url).toBe('mine');
    expect(get(dirty)).toBe(true);
  });
});
