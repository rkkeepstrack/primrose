// ⌘Z / ⌘⇧Z for the request-level undo stack. CodeMirror editors keep their
// own finer-grained history, and text fields outside the request editor
// (sidebar search, rename, draft name) keep native undo; both are left alone.

import { get } from 'svelte/store';
import { activeTabId, isSpecialTab } from '../workspace/tabs';
import { redo, undo } from './undo';

// marks the parts of the UI whose fields edit the open request
const REQUEST_UNDO_SCOPE = 'data-request-undo';

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

export function handleUndoKeydown(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'z') return false;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest('.cm-editor, .dialog')) return false;
  // the nearest scope decides; data-request-undo="off" hands a nested region
  // (fields editing something else, like the environment) back to native undo
  const scope = target?.closest(`[${REQUEST_UNDO_SCOPE}]`);
  if (target?.matches(EDITABLE) && (!scope || scope.getAttribute(REQUEST_UNDO_SCOPE) === 'off')) return false;
  const tab = get(activeTabId);
  if (tab && isSpecialTab(tab)) return false;
  const done = e.shiftKey ? redo() : undo();
  if (done) e.preventDefault(); // keeps the native Edit ▸ Undo from poking the input
  return done;
}
