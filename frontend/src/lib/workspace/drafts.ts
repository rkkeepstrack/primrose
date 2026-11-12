// Draft bookkeeping and unsaved-edit stashing shared by the request and
// collection operations.

import { derived, get, writable } from 'svelte/store';
import { runHistory, stashEdit } from '../shared/stores';
import { dirty, request, selectedPath } from './state';

// each draft gets its own run-history bucket so two unsaved drafts never mix
let draftSeq = 0;
let currentDraftKey = 'draft:0';

export function newDraftKey() {
  currentDraftKey = `draft:${++draftSeq}`;
  editIdentity.set(currentDraftKey);
}

export function historyKey(): string {
  return get(selectedPath) ?? currentDraftKey;
}

// which document the editors are showing; editors and the undo stack start
// fresh when it changes. Set explicitly on open and on new draft, so saving a
// draft (draft key -> file path) doesn't rebuild the editors under the cursor.
export const editIdentity = writable<string>(currentDraftKey);

// run history of the selected request (or the current draft)
export const runs = derived([selectedPath, editIdentity, runHistory], ([$path, $id, $history]) => $history[$path ?? $id] ?? []);

// keep unsaved edits in memory when navigating away from a request
export function stashCurrentEdit() {
  const path = get(selectedPath);
  const req = get(request);
  if (get(dirty) && path && req) stashEdit(path, req);
}
