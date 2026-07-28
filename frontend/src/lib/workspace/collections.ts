// Opening, switching and rescanning collections.

import { get } from 'svelte/store';
import type { Collection, TreeNode } from '../shared/types';
import { ChooseDirectory, CreateCollection, GetTree, OpenCollectionDialog } from '../../../wailsjs/go/main/App';
import { closeEnvView, confirmDiscardEnvEdits, loadEnvironments } from './environments';
import { maybeAbandonDraft, stashCurrentEdit } from './drafts';
import { activeIdx, activeRoot, clearSelection, collections, envEditorDirty, error, lastRequestByRoot, selectedPath } from './state';
import {
  activateTab,
  activeTabId,
  addCollectionTab,
  closeTab,
  cookiesTabId,
  envTabId,
  isEnvTab,
  isSpecialTab,
  openSpecialTab,
} from './tabs';
import { confirmDialog, promptDialog } from '../ui/dialogs';
import { runOp } from './op';

async function addOpenedCollection(col: Collection) {
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
}

export async function openCollectionViaDialog() {
  await runOp(async () => {
    const col = (await OpenCollectionDialog()) as Collection | null;
    if (!col) return;
    await addOpenedCollection(col);
  });
}

export async function createCollectionViaDialog() {
  await runOp(async () => {
    const parent = await ChooseDirectory('Choose where to create the collection');
    if (!parent) return;
    const name = await promptDialog('Collection name:');
    if (!name?.trim()) return;
    const col = (await CreateCollection(parent, name)) as Collection;
    await addOpenedCollection(col);
  });
}

// ⌘W: closes whatever tab is active (collections confirm first)
export async function closeActiveTab() {
  const id = get(activeTabId);
  if (!id) return;
  if (isEnvTab(id)) {
    const { closeEnvView } = await import('./environments');
    await closeEnvView(id);
  } else if (isSpecialTab(id)) {
    closeTab(id);
  } else {
    await closeCollection(id);
  }
}

// leaving the active environment tab unmounts its editor — unsaved edits
// need a confirmation before any tab switch away from it
async function mayLeaveEnvTab(): Promise<boolean> {
  const id = get(activeTabId);
  if (!id || !isEnvTab(id)) return true;
  return confirmDiscardEnvEdits();
}

export async function switchTab(id: string) {
  if (id === get(activeTabId)) return;
  if (!(await mayLeaveEnvTab())) return;
  if (!(await maybeAbandonDraft())) return;
  const prevRoot = get(activeRoot);
  const prevPath = get(selectedPath);
  activateTab(id);
  // each collection keeps its own open request: remember the one we leave,
  // restore the one this collection had open last
  if (!isSpecialTab(id) && id !== prevRoot) {
    if (prevRoot && prevPath) lastRequestByRoot.update((m) => ({ ...m, [prevRoot]: prevPath }));
    const remembered = get(lastRequestByRoot)[id];
    const node = remembered ? findNodeByPath(get(collections).find((c) => c.root === id)?.tree ?? [], remembered) : null;
    if (node && !node.isFolder) {
      // selectRequest stashes the outgoing edit itself; not clearing first
      // keeps the old view up until the new request is loaded (no flicker)
      const { selectRequest } = await import('./requests'); // lazy: requests.ts imports this module
      await selectRequest(node);
    } else {
      stashCurrentEdit();
      clearSelection();
    }
  }
}

function findNodeByPath(nodes: TreeNode[], path: string): TreeNode | null {
  for (const n of nodes) {
    if (n.path === path) return n;
    const hit = n.children ? findNodeByPath(n.children, path) : null;
    if (hit) return hit;
  }
  return null;
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
  lastRequestByRoot.update(({ [root]: _, ...rest }) => rest);
  const wasActive = removeCollectionTabs(root);
  const remaining = removeFromCollections(root);
  if (wasActive) fallBackToRemaining(remaining);
}

function removeCollectionTabs(root: string): boolean {
  const sel = get(activeTabId);
  closeTab(envTabId(root));
  closeTab(cookiesTabId(root));
  closeTab(root);
  return sel === root || sel === envTabId(root) || sel === cookiesTabId(root);
}

function removeFromCollections(root: string): Collection[] {
  const remaining = get(collections).filter((c) => c.root !== root);
  collections.set(remaining);
  activeIdx.set(Math.max(0, Math.min(get(activeIdx), remaining.length - 1)));
  return remaining;
}

function fallBackToRemaining(remaining: Collection[]) {
  stashCurrentEdit();
  clearSelection();
  if (remaining.length) activateTab(remaining[get(activeIdx)].root);
  else activeTabId.set(null);
}

// closes a collection tab (asks first) plus its environment tab
export async function closeCollection(root: string) {
  const col = get(collections).find((c) => c.root === root);
  if (!col) return;
  if (!(await confirmDialog(`Close collection "${col.name}"?`))) return;
  // its env editor may hold unsaved edits
  if (get(activeTabId) === envTabId(root) && !(await confirmDiscardEnvEdits())) return;
  dropCollection(root);
}

export async function openEnvironmentTab(root: string) {
  if (!(await mayLeaveEnvTab())) return;
  openSpecialTab(envTabId(root));
}

export async function openCookiesTab(root: string) {
  if (!(await mayLeaveEnvTab())) return;
  openSpecialTab(cookiesTabId(root));
}

export async function refreshTree() {
  const root = get(activeRoot);
  if (!root) return;
  const col = (await GetTree(root)) as Collection;
  const cols = get(collections);
  cols[get(activeIdx)] = col;
  collections.set(cols);
}
