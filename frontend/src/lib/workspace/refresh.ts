// Rescans the active collection's tree (after file creation, rename, move…).
// Lives in its own module so requests.ts and collections.ts can both use it
// without importing each other.

import { get } from 'svelte/store';
import type { Collection } from '../shared/types';
import { GetTree } from '../../../wailsjs/go/main/App';
import { activeIdx, activeRoot, collections } from './state';

export async function refreshTree() {
  const root = get(activeRoot);
  if (!root) return;
  const col = (await GetTree(root)) as Collection;
  const cols = get(collections);
  cols[get(activeIdx)] = col;
  collections.set(cols);
}
