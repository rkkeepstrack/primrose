// Selecting, drafting and saving requests.

import { get } from 'svelte/store';
import type { ApiRequest, TreeNode } from '../shared/types';
import { errMsg } from '../shared/errors';
import { normalizeUrlAndQuery } from '../shared/urlQuery';
import { dropEdit, touchRecent, unsavedEdits } from '../shared/stores';
import { CreateRequest, ReadRequest, SaveRequest } from '../../../wailsjs/go/main/App';
import { refreshTree } from './refresh';
import { newDraftKey, stashCurrentEdit } from './drafts';
import { activeRoot, clearSelection, dirty, diskChanged, draftDir, draftName, error, request, selectedPath } from './state';

// URL is the source of truth for query params in the UI: requests loaded
// from disk get their query folded into the URL before entering the store
export function normalizeAndSetRequest(r: ApiRequest) {
  const norm = normalizeUrlAndQuery(r.url, r.query);
  r.url = norm.url;
  r.query = norm.query;
  request.set(r);
}

export async function selectRequest(node: TreeNode) {
  error.set('');
  diskChanged.set(false);
  stashCurrentEdit();
  draftDir.set(null);
  draftName.set(null);
  try {
    const stashed = get(unsavedEdits)[node.path];
    if (stashed) {
      request.set(stashed);
      dirty.set(true);
    } else {
      const r = (await ReadRequest(node.path)) as ApiRequest;
      r.vars = r.vars ?? {}; // absent in files from before request vars existed
      normalizeAndSetRequest(r);
      dirty.set(false);
    }
    selectedPath.set(node.path);
    const root = get(activeRoot);
    if (root) touchRecent(root, node.path);
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function newRequest(dir: string) {
  stashCurrentEdit();
  request.set({
    method: 'GET',
    url: '',
    query: {},
    headers: {},
    body: { type: 'json', content: '' },
    vars: {},
  });
  selectedPath.set(null);
  draftDir.set(dir);
  draftName.set('');
  newDraftKey();
  dirty.set(true);
}

// Esc: close the open request; unsaved edits are stashed (orange dot),
// an unsaved draft is discarded silently — nothing on disk is lost.
export function closeRequest() {
  if (!get(request)) return;
  stashCurrentEdit();
  clearSelection();
}

export async function saveRequest() {
  const req = get(request);
  if (!req) return;
  error.set('');
  try {
    const dDir = get(draftDir);
    if (dDir !== null) {
      const name = get(draftName);
      if (!name?.trim()) {
        error.set('Give the new request a name before saving.');
        return;
      }
      const path = await CreateRequest(dDir, name, req as never);
      selectedPath.set(path);
      draftDir.set(null);
      draftName.set(null);
    } else if (get(selectedPath)) {
      await SaveRequest(get(selectedPath)!, req as never);
    } else {
      return;
    }
    dirty.set(false);
    diskChanged.set(false);
    const path = get(selectedPath);
    if (path) dropEdit(path);
    await refreshTree(); // new file or method badge
  } catch (e) {
    error.set(errMsg(e));
  }
}
