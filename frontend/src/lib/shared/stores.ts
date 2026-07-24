import { writable } from 'svelte/store';
import type { RunRecord, ApiRequest } from './types';

// Session-only run history, keyed by request file path. Never persisted.
export const runHistory = writable<Record<string, RunRecord[]>>({});

export function recordRun(path: string, run: RunRecord) {
  runHistory.update((h) => ({ ...h, [path]: [run, ...(h[path] ?? [])] }));
}

// Selected environment name per collection root. Session-only.
export const selectedEnvNames = writable<Record<string, string>>({});

// Dynamic /:var values per request path. Session-only, never persisted.
export const dynamicVars = writable<Record<string, Record<string, string>>>({});

// Recency heatmap: the last 10 opened requests, most recent first.
// Session-only, never persisted.
export const RECENT_MAX = 10;
export const recentPaths = writable<string[]>([]);

export function touchRecent(path: string) {
  recentPaths.update((list) =>
    [path, ...list.filter((p) => p !== path)].slice(0, RECENT_MAX)
  );
}

export function renameRecent(oldPath: string, newPath: string) {
  recentPaths.update((list) => list.map((p) => (p === oldPath ? newPath : p)));
  unsavedEdits.update((e) => {
    if (!(oldPath in e)) return e;
    const { [oldPath]: moved, ...rest } = e;
    return { ...rest, [newPath]: moved };
  });
}

// Unsaved edits per request path, kept while the request stays within the
// recents window; pruned (silently discarded) once it falls out.
// TODO: window size becomes a global setting later.
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

export function pruneEdits(keep: string[]) {
  const keepSet = new Set(keep);
  unsavedEdits.update((e) =>
    Object.fromEntries(Object.entries(e).filter(([p]) => keepSet.has(p)))
  );
}

export function setDynamicVar(path: string, name: string, value: string) {
  dynamicVars.update((d) => ({ ...d, [path]: { ...(d[path] ?? {}), [name]: value } }));
}

