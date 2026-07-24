// Unified tab strip: collection tabs and special tabs (environment,
// shortcuts, future config views) live in one ordered, rearrangeable list.
// Special tabs are identified by sentinel ids; collection tabs by their
// root path. Which collection is "current" (activeIdx) is tracked
// independently, so the environment view always knows whose environments
// it edits even while its own tab is active.

import { derived, get, writable } from 'svelte/store';
import { activeIdx, collections } from './state';

// tab ids: a collection's root path, 'shortcuts', or 'env:<root>' for a
// collection-bound environment tab
export function isEnvTab(id: string): boolean {
  return id.startsWith('env:');
}

export function envTabRoot(id: string): string {
  return id.slice('env:'.length);
}

export function envTabId(root: string): string {
  return `env:${root}`;
}

// closable, not-a-collection tabs
export function isSpecialTab(id: string): boolean {
  return id === 'shortcuts' || isEnvTab(id);
}

export const tabOrder = writable<string[]>([]);
export const activeTabId = writable<string | null>(null);

// keeps activeIdx in sync when a collection tab becomes active
export function activateTab(id: string) {
  activeTabId.set(id);
  if (!isSpecialTab(id)) {
    const idx = get(collections).findIndex((c) => c.root === id);
    if (idx >= 0) activeIdx.set(idx);
  }
}

export function addCollectionTab(root: string) {
  tabOrder.update((order) => (order.includes(root) ? order : [...order, root]));
}

export function openSpecialTab(tab: string) {
  tabOrder.update((order) => (order.includes(tab) ? order : [...order, tab]));
  activeTabId.set(tab);
}

// closes a tab; if it was active, falls back to the current collection
export function closeTab(id: string) {
  tabOrder.update((order) => order.filter((t) => t !== id));
  if (get(activeTabId) === id) {
    const root = get(collections)[get(activeIdx)]?.root ?? null;
    activeTabId.set(root);
  }
}

// drag & drop rearranging: move the dragged id next to the drop target
export function moveTab(dragId: string, dropId: string) {
  if (dragId === dropId) return;
  tabOrder.update((order) => {
    const from = order.indexOf(dragId);
    const to = order.indexOf(dropId);
    if (from === -1 || to === -1) return order;
    const next = [...order];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    return next;
  });
}
