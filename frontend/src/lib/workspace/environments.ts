// Per-collection environments: loading, selecting, saving.

import { get } from 'svelte/store';
import type { Environment } from '../shared/types';
import { errMsg } from '../shared/errors';
import { selectedEnvNames } from '../shared/stores';
import { ListEnvironments, SaveEnvironment } from '../../../wailsjs/go/main/App';
import { confirmDialog } from '../ui/dialogs';
import { activeRoot, environments, envEditorDirty, envView, error } from './state';

// closes the environment view, asking first if there are unsaved edits;
// returns false if the user chose to stay
export async function closeEnvView(): Promise<boolean> {
  if (get(envEditorDirty) && !(await confirmDialog('Discard unsaved environment changes?'))) {
    return false;
  }
  envEditorDirty.set(false);
  envView.set(false);
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

export function pickEnvironment(name: string) {
  const root = get(activeRoot);
  if (!root) return;
  selectedEnvNames.update((s) => ({ ...s, [root]: name }));
}

export async function saveEnvVars(name: string, vars: Record<string, string>) {
  const root = get(activeRoot);
  if (!root) return;
  error.set('');
  try {
    await SaveEnvironment(root, name, vars);
    await loadEnvironments(root);
  } catch (e) {
    error.set(errMsg(e));
  }
}
