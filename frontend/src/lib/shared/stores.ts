import { writable } from 'svelte/store';
import type { RunRecord, ApiRequest } from './types';

// Session-only run history, keyed by request file path. Never persisted.
export const runHistory = writable<Record<string, RunRecord[]>>({});

export function recordRun(path: string, run: RunRecord) {
  runHistory.update((h) => ({ ...h, [path]: [run, ...(h[path] ?? [])] }));
}

// Selected environment name per collection root. Session-only.
export const selectedEnvNames = writable<Record<string, string>>({});

// Recency heatmap: the last 10 opened requests per collection root, most
// recent first. Session-only, never persisted.
export const RECENT_MAX = 10;
export const recentPaths = writable<Record<string, string[]>>({});

export function touchRecent(root: string, path: string) {
  recentPaths.update((m) => {
    const next = [path, ...(m[root] ?? []).filter((p) => p !== path)].slice(0, RECENT_MAX);
    pruneEdits(root, next);
    return { ...m, [root]: next };
  });
}

export function dropRecents(root: string) {
  recentPaths.update(({ [root]: _, ...rest }) => rest);
}

export function renameRecent(oldPath: string, newPath: string) {
  recentPaths.update((m) =>
    Object.fromEntries(Object.entries(m).map(([root, list]) => [root, list.map((p) => (p === oldPath ? newPath : p))])),
  );
  unsavedEdits.update((e) => {
    if (!(oldPath in e)) return e;
    const { [oldPath]: moved, ...rest } = e;
    return { ...rest, [newPath]: moved };
  });
}

// Unsaved edits per request path, kept while the request stays within the
// recents window; pruned (silently discarded) once it falls out.
export const unsavedEdits = writable<Record<string, ApiRequest>>({});

export function stashEdit(path: string, request: ApiRequest) {
  unsavedEdits.update((e) => ({ ...e, [path]: request }));
}

export function dropEdit(path: string) {
  unsavedEdits.update((e) => {
    const { [path]: _, ...rest } = e;
    return rest;
  });
}

// drops stashed edits of `root`'s requests that fell out of its recents
// window; other collections' edits are untouched
function pruneEdits(root: string, keep: string[]) {
  const keepSet = new Set(keep);
  const sep = root.endsWith('/') ? root : root + '/';
  unsavedEdits.update((e) => Object.fromEntries(Object.entries(e).filter(([p]) => !p.startsWith(sep) || keepSet.has(p))));
}
