// ⌘Z / ⌘⇧Z for the request-level undo stack. CodeMirror editors keep their
// own finer-grained history, so the key is left alone while one has focus.

import { get } from 'svelte/store';
import { activeTabId, isSpecialTab } from '../workspace/tabs';
import { redo, undo } from './undo';

export function handleUndoKeydown(e: KeyboardEvent): boolean {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'z') return false;
  const target = e.target instanceof Element ? e.target : null;
  if (target?.closest('.cm-editor, .dialog')) return false;
  const tab = get(activeTabId);
  if (tab && isSpecialTab(tab)) return false;
  e.preventDefault(); // keeps the native Edit ▸ Undo from poking the input
  if (e.shiftKey) redo();
  else undo();
  return true;
}
