import { writable } from 'svelte/store';
import type { RunRecord } from './types';

// Session-only run history, keyed by request file path. Never persisted.
export const runHistory = writable<Record<string, RunRecord[]>>({});

export function recordRun(path: string, run: RunRecord) {
  runHistory.update((h) => ({ ...h, [path]: [run, ...(h[path] ?? [])] }));
}
