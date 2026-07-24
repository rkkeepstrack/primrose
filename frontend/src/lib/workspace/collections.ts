// Opening, switching and rescanning collections.

import { get } from 'svelte/store';
import type { Collection } from '../shared/types';
import { errMsg } from '../shared/errors';
import { GetTree, OpenCollectionDialog } from '../../../wailsjs/go/main/App';
import { closeEnvView, loadEnvironments } from './environments';
import { maybeAbandonDraft, stashCurrentEdit } from './drafts';
import { activeIdx, activeRoot, clearSelection, collections, envView, error, shortcutsView } from './state';

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
    await loadEnvironments(col.root);
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function switchCollection(i: number) {
  if (i === get(activeIdx) && !get(envView) && !get(shortcutsView)) return;
  if (!(await maybeAbandonDraft())) return;
  if (get(envView) && !(await closeEnvView())) return;
  shortcutsView.set(false);
  if (i === get(activeIdx)) return;
  stashCurrentEdit();
  activeIdx.set(i);
  clearSelection();
}

export async function refreshTree() {
  const root = get(activeRoot);
  if (!root) return;
  const col = (await GetTree(root)) as Collection;
  const cols = get(collections);
  cols[get(activeIdx)] = col;
  collections.set(cols);
}
