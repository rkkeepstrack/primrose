// File operations on tree items: create folder, move, rename, duplicate,
// delete — each followed by a tree rescan.

import { get } from 'svelte/store';
import type { TreeNode } from '../shared/types';
import { errMsg } from '../shared/errors';
import { confirmDialog, promptDialog } from '../ui/dialogs';
import { dropEdit, renameRecent } from '../shared/stores';
import {
  CreateFolder,
  DeleteItem,
  DuplicateItem,
  MoveItem,
  RenameItem,
} from '../../../wailsjs/go/main/App';
import { refreshTree } from './collections';
import { dirty, error, request, selectedName, selectedPath } from './state';

export async function newFolder(dir: string) {
  const name = await promptDialog('Folder name:');
  if (!name?.trim()) return;
  error.set('');
  try {
    await CreateFolder(dir, name);
    await refreshTree();
  } catch (e) {
    error.set(errMsg(e));
  }
}

// updates the selection when the item at `oldPath` moved to `newPath`
function followPath(oldPath: string, newPath: string) {
  const sel = get(selectedPath);
  if (sel === oldPath) {
    selectedPath.set(newPath);
  } else if (sel?.startsWith(oldPath + '/')) {
    selectedPath.set(newPath + sel.slice(oldPath.length));
  }
}

export async function moveItem(src: string, destDir: string) {
  error.set('');
  try {
    const newPath = await MoveItem(src, destDir);
    followPath(src, newPath);
    await refreshTree();
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function renameItem(node: TreeNode) {
  const name = await promptDialog('New name:', node.name);
  if (!name?.trim() || name === node.name) return;
  error.set('');
  try {
    const newPath = await RenameItem(node.path, name);
    followPath(node.path, newPath);
    if (get(selectedPath) === newPath) selectedName.set(name);
    renameRecent(node.path, newPath);
    await refreshTree();
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function duplicateItem(node: TreeNode) {
  error.set('');
  try {
    await DuplicateItem(node.path);
    await refreshTree();
  } catch (e) {
    error.set(errMsg(e));
  }
}

export async function deleteItem(node: TreeNode) {
  const what = node.isFolder
    ? `folder "${node.name}" and everything in it`
    : `request "${node.name}"`;
  if (!(await confirmDialog(`Delete ${what}?`, true))) return;
  error.set('');
  try {
    await DeleteItem(node.path);
    dropEdit(node.path);
    const sel = get(selectedPath);
    if (sel === node.path || sel?.startsWith(node.path + '/')) {
      selectedPath.set(null);
      request.set(null);
      dirty.set(false);
    }
    await refreshTree();
  } catch (e) {
    error.set(errMsg(e));
  }
}
