// Native menu items emit events; this maps them onto workspace actions.
// The menu is also where the shortcuts are displayed (macOS convention).

import { get } from 'svelte/store';
import { EventsOn } from '../../../wailsjs/runtime/runtime';
import { focusSearchSignal } from '../sidebar/treeView';
import {
  closeActiveTab,
  createCollectionViaDialog,
  openCollectionViaDialog,
  toggleShortcutsTab,
} from './collections';
import { newRequest, saveRequest } from './requests';
import { activeRoot } from './state';

export function initMenuHandlers() {
  EventsOn('menu:new-request', () => {
    const root = get(activeRoot);
    if (root) newRequest(root);
  });
  EventsOn('menu:new-collection', createCollectionViaDialog);
  EventsOn('menu:open-collection', openCollectionViaDialog);
  EventsOn('menu:save', saveRequest);
  EventsOn('menu:close-tab', closeActiveTab);
  EventsOn('menu:quick-open', () => focusSearchSignal.update((n) => n + 1));
  EventsOn('menu:shortcuts', toggleShortcutsTab);
}
