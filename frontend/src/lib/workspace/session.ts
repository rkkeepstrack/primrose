// Restoring and persisting which collections are open across restarts.

import { get } from 'svelte/store';
import type { Collection } from '../shared/types';
import { LoadUIState, OpenCollection, SaveUIState } from '../../../wailsjs/go/main/App';
import { appstate } from '../../../wailsjs/go/models';
import { loadEnvironments } from './environments';
import { activeIdx, collections, restored } from './state';
import { activateTab, addCollectionTab, isSpecialTab, tabOrder } from './tabs';
import { applyTheme, currentTheme } from './theme';

export async function restoreSession() {
  try {
    const state = await LoadUIState();
    applyTheme(state?.theme, { syncMenu: true });
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
    for (const c of cols) addCollectionTab(c.root);
    const idx = cols.findIndex((c) => c.root === state?.activeRoot);
    if (idx >= 0) {
      activeIdx.set(idx);
      activateTab(cols[idx].root);
    } else if (cols.length > 0) {
      activateTab(cols[0].root);
    }
  } finally {
    restored.set(true);
  }
}

let lastSavedState = '';

export function persistSession() {
  if (!get(restored)) return;
  const roots = new Set(get(collections).map((c) => c.root));
  const state = {
    // tab order is the user-visible order; special tabs are session-only
    openRoots: get(tabOrder).filter((id) => !isSpecialTab(id) && roots.has(id)),
    activeRoot: get(collections)[get(activeIdx)]?.root ?? '',
    theme: currentTheme(),
  };
  const enc = JSON.stringify(state);
  if (enc === lastSavedState) return; // avoid rewriting on unrelated updates
  lastSavedState = enc;
  SaveUIState(appstate.State.createFrom(state));
}
