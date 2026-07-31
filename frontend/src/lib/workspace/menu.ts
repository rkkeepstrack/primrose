// Native menu items emit events; this maps them onto workspace actions.
// The menu is also where the shortcuts are displayed (macOS convention).

import { get } from 'svelte/store';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { focusSearchSignal } from '../sidebar/treeView';
import { closeActiveTab, createCollectionViaDialog, openCollectionViaDialog, toggleShortcutsTab } from './collections';
import { newRequest, saveRequest } from './requests';
import { activeRoot, envSaveSignal } from './state';
import { activeTabId, isEnvTab } from './tabs';
import { persistSession } from './session';
import { applyTheme } from './theme';

export function initMenuHandlers() {
  EventsOn('menu:new-request', () => {
    const root = get(activeRoot);
    if (root) newRequest(root);
  });
  EventsOn('menu:new-collection', createCollectionViaDialog);
  EventsOn('menu:open-collection', openCollectionViaDialog);
  // ⌘S saves what the active tab shows: environment drafts on an env tab,
  // the open request otherwise
  EventsOn('menu:save', () => {
    const tab = get(activeTabId);
    if (tab && isEnvTab(tab)) envSaveSignal.update((n) => n + 1);
    else saveRequest();
  });
  EventsOn('menu:close-tab', closeActiveTab);
  EventsOn('menu:quick-open', () => focusSearchSignal.update((n) => n + 1));
  EventsOn('menu:shortcuts', toggleShortcutsTab);
  // the native menu already moved its own checkmark; apply and persist here
  EventsOn('menu:set-theme', (id: string) => {
    applyTheme(id);
    persistSession();
  });
}
