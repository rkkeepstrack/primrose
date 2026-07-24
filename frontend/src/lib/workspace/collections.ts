// Opening, switching and rescanning collections.

import { get } from 'svelte/store';
import type { Collection } from '../shared/types';
import { errMsg } from '../shared/errors';
import { GetTree, OpenCollectionDialog } from '../../../wailsjs/go/main/App';
import { closeEnvView, loadEnvironments } from './environments';
import { maybeAbandonDraft, stashCurrentEdit } from './drafts';
import { activeIdx, activeRoot, clearSelection, collections, envEditorDirty, error } from './state';
import { activateTab, activeTabId, addCollectionTab, closeTab, envTabId, isEnvTab, isSpecialTab, openSpecialTab } from './tabs';
import { confirmDialog } from '../ui/dialogs';


export async function openCollectionViaDialog() {
  error.set('');
  try {
    const col = (await OpenCollectionDialog()) as Collection | null;
    if (!col) return;
    const cols = get(collections);
    const existing = cols.findIndex((c) => c.root === col.root);
    if (existing >= 0) {
      cols[existing] = col;
      collections.set(cols);
      activeIdx.set(existing);
    } else {
      collections.set([...cols, col]);
      activeIdx.set(cols.length);
    }
    addCollectionTab(col.root);
    activateTab(col.root);
    await loadEnvironments(col.root);
  } catch (e) {
    error.set(errMsg(e));
  }
}

// leaving the active environment tab unmounts its editor — unsaved edits
// need a confirmation before any tab switch away from it
async function mayLeaveEnvTab(): Promise<boolean> {
  const id = get(activeTabId);
  if (!id || !isEnvTab(id) || !get(envEditorDirty)) return true;
  if (!(await confirmDialog('Discard unsaved environment changes?'))) return false;
  envEditorDirty.set(false);
  return true;
}

export async function switchTab(id: string) {
  if (id === get(activeTabId)) return;
  if (!(await mayLeaveEnvTab())) return;
  if (!(await maybeAbandonDraft())) return;
  const prevRoot = get(activeRoot);
  activateTab(id);
  // switching to a different collection resets the open request
  if (!isSpecialTab(id) && id !== prevRoot) {
    stashCurrentEdit();
    clearSelection();
  }
}

export async function toggleShortcutsTab() {
  if (get(activeTabId) === 'shortcuts') {
    closeTab('shortcuts');
    return;
  }
  if (!(await mayLeaveEnvTab())) return;
  openSpecialTab('shortcuts');
}

// removes a collection from the workspace (tabs, stores, selection); the
// folder on disk is untouched
export function dropCollection(root: string) {
  const sel = get(activeTabId);
  closeTab(envTabId(root));
  closeTab(root);
  const remaining = get(collections).filter((c) => c.root !== root);
  collections.set(remaining);
  const idx = Math.max(0, Math.min(get(activeIdx), remaining.length - 1));
  activeIdx.set(idx);
  if (sel === root || sel === envTabId(root)) {
    stashCurrentEdit();
    clearSelection();
    activateTab(remaining[idx]?.root ?? '');
    if (!remaining.length) activeTabId.set(null);
  }
}

// closes a collection tab (asks first) plus its environment tab
export async function closeCollection(root: string) {
  const col = get(collections).find((c) => c.root === root);
  if (!col) return;
  if (!(await confirmDialog(`Close collection "${col.name}"?`))) return;
  // its env editor may hold unsaved edits
  if (get(activeTabId) === envTabId(root) && get(envEditorDirty)) {
    if (!(await confirmDialog('Discard unsaved environment changes?'))) return;
    envEditorDirty.set(false);
  }
  dropCollection(root);
}

export async function openEnvironmentTab(root: string) {
  if (!(await mayLeaveEnvTab())) return;
  openSpecialTab(envTabId(root));
}

export async function refreshTree() {
  const root = get(activeRoot);
  if (!root) return;
  const col = (await GetTree(root)) as Collection;
  const cols = get(collections);
  cols[get(activeIdx)] = col;
  collections.set(cols);
}
