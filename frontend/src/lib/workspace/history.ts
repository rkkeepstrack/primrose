// Loading and debounced saving of the persisted 100-request history.
// The backend prunes paths whose files no longer exist on load; here we
// only mirror the store into the config-dir file, per collection root.

import { LoadHistory, SaveHistory } from '../../../wailsjs/go/main/App';
import { HISTORY_MAX, historyPaths, setHistory } from '../shared/stores';

export const SAVE_DEBOUNCE_MS = 500;

// only roots that finished loading are saved — otherwise opening a
// collection could overwrite its file with a not-yet-loaded empty list
const loaded = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const lastSeen = new Map<string, string[]>();
let subscribed = false;

export async function loadHistory(root: string) {
  let paths: string[] = [];
  try {
    paths = (await LoadHistory(root)) ?? [];
  } catch {
    // an unreadable history file is not worth an error dialog; start empty
  }
  const capped = paths.slice(0, HISTORY_MAX);
  lastSeen.set(root, capped);
  loaded.add(root);
  setHistory(root, capped);
  if (!subscribed) {
    subscribed = true;
    historyPaths.subscribe(scheduleSaves);
  }
}

function scheduleSaves(m: Record<string, string[]>) {
  for (const [root, paths] of Object.entries(m)) {
    if (!loaded.has(root)) continue;
    const prev = lastSeen.get(root);
    if (prev && prev.length === paths.length && prev.every((p, i) => p === paths[i])) continue;
    lastSeen.set(root, paths);
    clearTimeout(timers.get(root));
    timers.set(
      root,
      setTimeout(() => {
        SaveHistory(root, paths).catch(() => {}); // history loss is tolerable
      }, SAVE_DEBOUNCE_MS),
    );
  }
}
