// Workspace state: the shared stores every panel reads. Operations that
// mutate them live in the sibling modules (collections, requests, send, …).

import { derived, writable } from 'svelte/store';
import type { ApiRequest, Collection, Environment } from '../shared/types';
import { selectedEnvNames } from '../shared/stores';

export const collections = writable<Collection[]>([]);
export const activeIdx = writable(0);
export const selectedPath = writable<string | null>(null);
export const request = writable<ApiRequest | null>(null);
export const dirty = writable(false);
export const sending = writable(false);
export const error = writable('');
export const environments = writable<Record<string, Environment[]>>({});
export const restored = writable(false);
// the open request was modified on disk while it had unsaved edits here
export const diskChanged = writable(false);
// unsaved environment-editor drafts per collection root; they survive tab
// switches and are only confirmed away when the env tab itself closes
export const envDrafts = writable<Record<string, { name: string; vars: Record<string, string>; headers: Record<string, string> }>>({});
// bumped by the ⌘S menu handler while an environment tab is active
export const envSaveSignal = writable(0);
// last opened request per collection root, restored when switching back
export const lastRequestByRoot = writable<Record<string, string>>({});

// draft state for a new, not-yet-saved request
export const draftDir = writable<string | null>(null);
export const draftName = writable<string | null>(null);

export const activeRoot = derived([collections, activeIdx], ([$c, $i]) => $c[$i]?.root ?? null);

export const envs = derived([environments, activeRoot], ([$envs, $root]) => ($root ? ($envs[$root] ?? []) : []));

export const activeEnvName = derived([selectedEnvNames, envs, activeRoot], ([$sel, $envs, $root]) =>
  $root ? ($sel[$root] ?? $envs[0]?.name ?? null) : null,
);

export const activeEnvVars = derived([envs, activeEnvName], ([$envs, $name]) => $envs.find((e) => e.name === $name)?.vars ?? {});

// headers of the active environment, inherited by every request
// (auth lives here: staging and prod carry their own keys)
export const inheritedHeaders = derived([envs, activeEnvName], ([$envs, $name]) => $envs.find((e) => e.name === $name)?.headers ?? {});

export const activeEnv = derived([envs, activeEnvName], ([$envs, $name]) => $envs.find((e) => e.name === $name) ?? null);

export function clearSelection() {
  selectedPath.set(null);
  request.set(null);
  dirty.set(false);
  draftDir.set(null);
  draftName.set(null);
}
