// Live reload: reacts to "collection:changed" events from the Go file
// watcher when a collection is modified outside the app (git pull, editors).

import { get } from 'svelte/store';
import type { ApiRequest, Collection } from '../shared/types';
import { normalizeUrlAndQuery } from '../shared/urlQuery';
import { dropEdit } from '../shared/stores';
import { GetTree, ReadRequest } from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { loadEnvironments } from './environments';
import {
  clearSelection,
  collections,
  dirty,
  diskChanged,
  request,
  selectedPath,
} from './state';

export function initExternalSync() {
  EventsOn('collection:changed', (root: string) => handleExternalChange(root));
}

async function handleExternalChange(root: string) {
  const cols = get(collections);
  const idx = cols.findIndex((c) => c.root === root);
  if (idx === -1) return;

  try {
    cols[idx] = (await GetTree(root)) as Collection;
    collections.set(cols);
    await loadEnvironments(root);
  } catch {
    return; // collection folder itself may be gone mid-operation
  }

  // reconcile the open request if it lives in this collection
  const path = get(selectedPath);
  if (!path || !path.startsWith(root + '/')) return;
  try {
    const r = (await ReadRequest(path)) as ApiRequest;
    if (get(dirty)) {
      // don't clobber the user's edits — offer the choice instead
      diskChanged.set(true);
      return;
    }
    const norm = normalizeUrlAndQuery(r.url, r.query);
    r.url = norm.url;
    r.query = norm.query;
    request.set(r);
  } catch {
    // the file disappeared
    if (get(dirty)) {
      diskChanged.set(true); // keep the edits; saving would recreate it
    } else {
      clearSelection();
    }
  }
}

// resolve the changed-on-disk notice by taking the disk version
export async function reloadFromDisk() {
  const path = get(selectedPath);
  if (!path) return;
  try {
    const r = (await ReadRequest(path)) as ApiRequest;
    const norm = normalizeUrlAndQuery(r.url, r.query);
    r.url = norm.url;
    r.query = norm.query;
    request.set(r);
    dirty.set(false);
    dropEdit(path);
  } catch {
    clearSelection();
  }
  diskChanged.set(false);
}

// resolve the notice by keeping the in-app edits (saving overwrites disk)
export function keepMyEdits() {
  diskChanged.set(false);
}
