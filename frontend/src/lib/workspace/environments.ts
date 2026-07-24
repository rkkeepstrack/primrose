// Per-collection environments: loading, selecting, saving.

import { get } from 'svelte/store';
import type { Environment } from '../shared/types';
import { errMsg } from '../shared/errors';
import { selectedEnvNames } from '../shared/stores';
import { ListEnvironments, SaveEnvironment } from '../../../wailsjs/go/main/App';
import { activeRoot, environments, error } from './state';

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
