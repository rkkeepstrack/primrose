// File operations on tree items: create folder, move, rename, duplicate,
// delete — each followed by a tree rescan.

import { get } from 'svelte/store';
import type { TreeNode } from '../shared/types';
import { confirmDialog, promptDialog } from '../ui/dialogs';
import { runOp } from './op';
import { dropEdit, renameRecent } from '../shared/stores';
import {
  CreateFolder,
  DeleteItem,
  DuplicateItem,
  MoveItem,
  RenameItem,
} from '../../../wailsjs/go/main/App';
import { refreshTree } from './collections';
import { dirty, error, request, selectedPath } from './state';

export async function newFolder(dir: string) {
  const name = await promptDialog('Folder name:');
  if (!name?.trim()) return;
  await runOp(async () => {
    await CreateFolder(dir, name);
    await refreshTree();
  });
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
  await runOp(async () => {
    const newPath = await MoveItem(src, destDir);
    followPath(src, newPath);
    await refreshTree();
  });
}

export async function renameItem(node: TreeNode) {
  const name = await promptDialog('New name:', node.name);
  if (!name?.trim() || name === node.name) return;
  await runOp(async () => {
    const newPath = await RenameItem(node.path, name);
    followPath(node.path, newPath);
    renameRecent(node.path, newPath);
    await refreshTree();
  });
}

export async function duplicateItem(node: TreeNode) {
  await runOp(async () => {
    await DuplicateItem(node.path);
    await refreshTree();
  });
}

export async function deleteItem(node: TreeNode) {
  const what = node.isFolder
    ? `folder "${node.name}" and everything in it`
    : `request "${node.name}"`;
  if (!(await confirmDialog(`Delete ${what}?`, true))) return;
  await runOp(async () => {
    await DeleteItem(node.path);
    dropEdit(node.path);
    const sel = get(selectedPath);
    if (sel === node.path || sel?.startsWith(node.path + '/')) {
    selectedPath.set(null);
    request.set(null);
    dirty.set(false);
    }
    await refreshTree();
  });
}
