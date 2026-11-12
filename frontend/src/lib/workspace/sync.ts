// Live reload: reacts to "collection:changed" events from the Go file
// watcher when a collection is modified outside the app (git pull, editors).

import { get } from 'svelte/store';
import type { Collection } from '../shared/types';
import { dropEdit } from '../shared/stores';
import { GetTree } from '../../../wailsjs/go/main/App';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { dropCollection } from './collections';
import { loadEnvironments } from './environments';
import { normalizeAndSetRequest, readRequestFile } from './requests';
import { diskBaselineMoved } from '../request/undo';
import { clearSelection, collections, dirty, diskChanged, selectedPath } from './state';

export function initExternalSync() {
  EventsOn('collection:changed', (root: string) => handleExternalChange(root));
}

async function handleExternalChange(root: string) {
  if (!(await refreshChangedCollection(root))) return;
  await reconcileOpenRequest(root);
}

// rescans the collection; returns false when its folder vanished (the
// collection is dropped — the user can simply reopen it under its new name)
async function refreshChangedCollection(root: string): Promise<boolean> {
  const cols = get(collections);
  const idx = cols.findIndex((c) => c.root === root);
  if (idx === -1) return false;
  try {
    cols[idx] = (await GetTree(root)) as Collection;
    collections.set(cols);
    await loadEnvironments(root);
    return true;
  } catch (e) {
    console.warn('collection vanished, dropping', root, e);
    dropCollection(root);
    return false;
  }
}

// re-reads the open request if it lives in the changed collection; unsaved
// edits are never clobbered — the disk-change notice offers the choice
async function reconcileOpenRequest(root: string) {
  const path = get(selectedPath);
  if (!path || !path.startsWith(root + '/')) return;
  try {
    const r = await readRequestFile(path);
    if (get(dirty)) {
      diskChanged.set(true);
      return;
    }
    normalizeAndSetRequest(r);
    diskBaselineMoved();
  } catch (e) {
    console.warn('open request no longer readable', path, e);
    if (get(dirty)) {
      diskChanged.set(true); // keep the edits; saving would recreate the file
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
    const r = await readRequestFile(path);
    normalizeAndSetRequest(r);
    dirty.set(false);
    dropEdit(path);
    diskBaselineMoved();
  } catch {
    clearSelection();
  }
  diskChanged.set(false);
}

// resolve the notice by keeping the in-app edits (saving overwrites disk)
export function keepMyEdits() {
  diskChanged.set(false);
}
