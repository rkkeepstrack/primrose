import { writable } from 'svelte/store';
import type { RunRecord } from './types';

// Session-only run history, keyed by request file path. Never persisted.
export const runHistory = writable<Record<string, RunRecord[]>>({});

export function recordRun(path: string, run: RunRecord) {
  runHistory.update((h) => ({ ...h, [path]: [run, ...(h[path] ?? [])] }));
}

// Selected environment name per collection root. Session-only.
export const selectedEnvNames = writable<Record<string, string>>({});

// Dynamic /:var values per request path. Session-only, never persisted.
export const dynamicVars = writable<Record<string, Record<string, string>>>({});

export function setDynamicVar(path: string, name: string, value: string) {
  dynamicVars.update((d) => ({ ...d, [path]: { ...(d[path] ?? {}), [name]: value } }));
}
