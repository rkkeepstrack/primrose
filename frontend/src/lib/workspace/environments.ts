// Per-collection environments: loading, selecting, saving.

import { get } from 'svelte/store';
import type { Environment } from '../shared/types';
import { selectedEnvNames } from '../shared/stores';
import {
  DeleteEnvironment,
  DuplicateEnvironment,
  ListEnvironments,
  RenameEnvironment,
  SaveEnvironment,
} from '../../../wailsjs/go/main/App';
import { confirmDialog, discardDialog, promptDialog } from '../ui/dialogs';
import { runOp } from './op';
import { environments, envDrafts } from './state';
import { closeTab, envTabRoot, isEnvTab } from './tabs';

// asks to discard the collection's unsaved environment edits (no-op when
// clean); returns false if the user chose to keep editing
export async function confirmDiscardEnvEdits(root: string): Promise<boolean> {
  if (!get(envDrafts)[root]) return true;
  if (!(await discardDialog('Discard unsaved environment changes?'))) return false;
  envDrafts.update(({ [root]: _, ...rest }) => rest);
  return true;
}

// closes an environment tab, asking first if there are unsaved edits;
// returns false if the user chose to stay
export async function closeEnvView(id: string): Promise<boolean> {
  if (!isEnvTab(id)) return false;
  if (!(await confirmDiscardEnvEdits(envTabRoot(id)))) return false;
  closeTab(id);
  return true;
}

export async function loadEnvironments(root: string) {
  await runOp(async () => {
    const list = ((await ListEnvironments(root)) ?? []) as Environment[];
    environments.update((e) => ({ ...e, [root]: list }));
  });
}

export function pickEnvironment(root: string, name: string) {
  selectedEnvNames.update((s) => ({ ...s, [root]: name }));
}

// every mutation re-lists the collection's environments so the stores
// reflect what the files now say
async function operateThenReload(root: string, fn: () => Promise<unknown>) {
  await runOp(async () => {
    await fn();
    await loadEnvironments(root);
  });
}

export async function createEnvironment(root: string, name: string) {
  await operateThenReload(root, async () => {
    await SaveEnvironment(root, name, {}, {});
    pickEnvironment(root, name);
  });
}

export async function deleteEnvironment(root: string, name: string) {
  if (!(await confirmDialog(`Delete environment "${name}"?`, true))) return;
  await operateThenReload(root, async () => {
    await DeleteEnvironment(root, name);
    // drop a stale selection so activeEnvName falls back to the first env
    selectedEnvNames.update((s) => {
      if (s[root] !== name) return s;
      const { [root]: _, ...rest } = s;
      return rest;
    });
  });
}

export async function renameEnvironment(root: string, name: string) {
  const newName = await promptDialog('New name:', name);
  if (!newName?.trim() || newName === name) return;
  await operateThenReload(root, async () => {
    await RenameEnvironment(root, name, newName);
    selectedEnvNames.update((s) => (s[root] === name ? { ...s, [root]: newName } : s));
  });
}

export async function duplicateEnvironment(root: string, name: string) {
  await operateThenReload(root, () => DuplicateEnvironment(root, name));
}

export async function saveEnvironment(root: string, name: string, vars: Record<string, string>, headers: Record<string, string>) {
  await operateThenReload(root, () => SaveEnvironment(root, name, vars, headers));
}
