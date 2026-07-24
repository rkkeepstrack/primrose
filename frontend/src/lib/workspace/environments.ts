// Per-collection environments: loading, selecting, saving.

import { get } from 'svelte/store';
import type { Environment } from '../shared/types';
import { errMsg } from '../shared/errors';
import { selectedEnvNames } from '../shared/stores';
import {
  DeleteEnvironment,
  DuplicateEnvironment,
  ListEnvironments,
  RenameEnvironment,
  SaveEnvironment,
} from '../../../wailsjs/go/main/App';
import { confirmDialog, promptDialog } from '../ui/dialogs';
import { environments, envEditorDirty, error } from './state';
import { closeTab, envTabRoot, isEnvTab } from './tabs';

// closes an environment tab, asking first if there are unsaved edits;
// returns false if the user chose to stay
export async function closeEnvView(id: string): Promise<boolean> {
  if (!isEnvTab(id)) return false;
  if (get(envEditorDirty) && !(await confirmDialog('Discard unsaved environment changes?'))) {
    return false;
  }
  envEditorDirty.set(false);
  closeTab(id);
  return true;
}

export async function loadEnvironments(root: string) {
  try {
    const list = ((await ListEnvironments(root)) ?? []) as Environment[];
    environments.update((e) => ({ ...e, [root]: list }));
  } catch (e) {
    error.set(errMsg(e));
  }
}

export function pickEnvironment(root: string, name: string) {
  selectedEnvNames.update((s) => ({ ...s, [root]: name }));
}

export async function createEnvironment(root: string, name: string) {
  error.set('');
  try {
    await SaveEnvironment(root, name, {});
    await loadEnvironments(root);
    pickEnvironment(root, name);
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function deleteEnvironment(root: string, name: string) {
  if (!(await confirmDialog(`Delete environment "${name}"?`, true))) return;
  error.set('');
  try {
    await DeleteEnvironment(root, name);
    // drop a stale selection so activeEnvName falls back to the first env
    selectedEnvNames.update(({ [root]: sel, ...rest }) =>
      sel === name ? rest : { ...rest, [root]: sel }
    );
    await loadEnvironments(root);
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function renameEnvironment(root: string, name: string) {
  const newName = await promptDialog('New name:', name);
  if (!newName?.trim() || newName === name) return;
  error.set('');
  try {
    await RenameEnvironment(root, name, newName);
    selectedEnvNames.update((s) =>
      s[root] === name ? { ...s, [root]: newName } : s
    );
    await loadEnvironments(root);
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function duplicateEnvironment(root: string, name: string) {
  error.set('');
  try {
    await DuplicateEnvironment(root, name);
    await loadEnvironments(root);
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function saveEnvVars(root: string, name: string, vars: Record<string, string>) {
  error.set('');
  try {
    await SaveEnvironment(root, name, vars);
    await loadEnvironments(root);
  } catch (e) {
    error.set(errMsg(e));
  }
}
