// Selecting, drafting and saving requests.

import { get } from 'svelte/store';
import type { ApiRequest, TreeNode } from '../shared/types';
import { errMsg } from '../shared/errors';
import { normalizeUrlAndQuery } from '../shared/urlQuery';
import { dropEdit, touchRecent, unsavedEdits } from '../shared/stores';
import { CreateRequest, ReadRequest, SaveRequest } from '../../../wailsjs/go/main/App';
import { refreshTree } from './collections';
import { maybeAbandonDraft, newDraftKey, stashCurrentEdit } from './drafts';
import {
  dirty,
  diskChanged,
  draftDir,
  draftName,
  error,
  request,
  selectedName,
  selectedPath,
} from './state';

export async function selectRequest(node: TreeNode) {
  if (!(await maybeAbandonDraft())) return;
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
      // URL is the source of truth for query params in the UI
      const norm = normalizeUrlAndQuery(r.url, r.query);
      r.url = norm.url;
      r.query = norm.query;
      request.set(r);
      dirty.set(false);
    }
    selectedPath.set(node.path);
    selectedName.set(node.name);
    touchRecent(node.path);
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function newRequest(dir: string) {
  if (!(await maybeAbandonDraft())) return;
  stashCurrentEdit();
  request.set({
    method: 'GET',
    url: '',
    query: {},
    headers: {},
    body: { type: 'json', content: '' },
  });
  selectedPath.set(null);
  selectedName.set('');
  draftDir.set(dir);
  draftName.set('');
  newDraftKey();
  dirty.set(true);
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
      selectedName.set(name);
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
