// Draft bookkeeping and unsaved-edit stashing shared by the request and
// collection operations.

import { derived, get } from 'svelte/store';
import { discardDialog } from '../ui/dialogs';
import { runHistory, stashEdit } from '../shared/stores';
import { dirty, draftDir, request, selectedPath } from './state';

// each draft gets its own run-history bucket so two unsaved drafts never mix
let draftSeq = 0;
let currentDraftKey = 'draft:0';

export function newDraftKey() {
  currentDraftKey = `draft:${++draftSeq}`;
}

export function historyKey(): string {
  return get(selectedPath) ?? currentDraftKey;
}

// run history of the selected request (or the current draft)
export const runs = derived([selectedPath, draftDir, runHistory], ([$path, _draft, $history]) => $history[$path ?? currentDraftKey] ?? []);

// keep unsaved edits in memory when navigating away from a request
export function stashCurrentEdit() {
  const path = get(selectedPath);
  const req = get(request);
  if (get(dirty) && path && req) stashEdit(path, req);
}

// drafts have no file to return to, so leaving one needs confirmation
export async function maybeAbandonDraft(): Promise<boolean> {
  if (get(draftDir) !== null && get(dirty)) {
    return discardDialog('Discard the unsaved new request?');
  }
  return true;
}
