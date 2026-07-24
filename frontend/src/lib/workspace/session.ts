// Restoring and persisting which collections are open across restarts.

import { get } from 'svelte/store';
import type { Collection } from '../types';
import { LoadUIState, OpenCollection, SaveUIState } from '../../../wailsjs/go/main/App';
import { appstate } from '../../../wailsjs/go/models';
import { loadEnvironments } from './environments';
import { activeIdx, collections, restored } from './state';

export async function restoreSession() {
  try {
    const state = await LoadUIState();
    const cols: Collection[] = [];
    for (const root of state?.openRoots ?? []) {
      try {
        cols.push((await OpenCollection(root)) as Collection);
        await loadEnvironments(root);
      } catch {
        // folder gone/renamed — skip silently
      }
    }
    collections.set(cols);
    const idx = cols.findIndex((c) => c.root === state?.activeRoot);
    if (idx >= 0) activeIdx.set(idx);
  } finally {
    restored.set(true);
  }
}

let lastSavedState = '';

export function persistSession() {
  if (!get(restored)) return;
  const state = {
    openRoots: get(collections).map((c) => c.root),
    activeRoot: get(collections)[get(activeIdx)]?.root ?? '',
  };
  const enc = JSON.stringify(state);
  if (enc === lastSavedState) return; // avoid rewriting on unrelated updates
  lastSavedState = enc;
  SaveUIState(appstate.State.createFrom(state));
}
