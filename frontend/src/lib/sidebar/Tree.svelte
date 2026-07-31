<script lang="ts">
  // Recursive tree: expansion state and the folder/request row contents.
  // Row chrome (selection, heat, dnd, ⋮ menu) lives in TreeRow.
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import CirclePlus from '@lucide/svelte/icons/circle-plus';
  import FolderPlus from '@lucide/svelte/icons/folder-plus';
  import { abbrevMethod, type TreeNode } from '../shared/types';
  import Tree from './Tree.svelte';
  import TreeRow from './TreeRow.svelte';
  import RenameInput from './RenameInput.svelte';
  import { acceptPathDrag, carriesPath, readPathDrag } from './dnd';
  import { dirtyPaths, expanded, expandFolder, forceOpen, heat, heatStyle, renamingPath, toggleFolder } from './treeView';
  import { newRequest, selectRequest } from '../workspace/requests';
  import { selectedPath } from '../workspace/state';
  import { deleteItem, duplicateItem, moveItem, newFolder, renameItem } from '../workspace/treeOps';

  export let nodes: TreeNode[];
  export let root = true; // false for nested (recursive) levels

  let dropTarget: string | null = null;

  function folderDragOver(e: DragEvent, node: TreeNode) {
    if (!carriesPath(e)) return;
    acceptPathDrag(e);
    dropTarget = node.path;
  }

  function folderDrop(e: DragEvent, node: TreeNode) {
    e.preventDefault();
    e.stopPropagation();
    dropTarget = null;
    const src = readPathDrag(e);
    if (src && src !== node.path) {
      expandFolder(node.path);
      moveItem(src, node.path);
    }
  }

  function rowProps(node: TreeNode) {
    return {
      node,
      onRename: () => renamingPath.set(node.path),
      onDuplicate: () => duplicateItem(node),
      onDelete: () => deleteItem(node),
    };
  }

  function commitRename(node: TreeNode, name: string) {
    renamingPath.set(null);
    renameItem(node, name);
  }
</script>

<ul class="tree" role={root ? 'tree' : 'group'}>
  {#each nodes as node (node.path)}
    <li>
      {#if node.isFolder}
        <TreeRow
          {...rowProps(node)}
          renaming={$renamingPath === node.path}
          droppable={dropTarget === node.path}
          onDragOver={(e) => folderDragOver(e, node)}
          onDragLeave={() => (dropTarget = null)}
          onDrop={(e) => folderDrop(e, node)}>
          {#if $renamingPath === node.path}
            <div class="row folder">
              <ChevronRight class="caret {$forceOpen || $expanded[node.path] ? 'open' : ''}" size={14} strokeWidth={2} />
              <RenameInput name={node.name} onCommit={(name) => commitRename(node, name)} onCancel={() => renamingPath.set(null)} />
            </div>
          {:else}
            <button class="row folder" on:click={() => toggleFolder(node.path)}>
              <ChevronRight class="caret {$forceOpen || $expanded[node.path] ? 'open' : ''}" size={14} strokeWidth={2} />
              <span class="name">{node.name}</span>
            </button>
          {/if}
          <button class="hover-btn" title="New request in {node.name}" on:click={() => (expandFolder(node.path), newRequest(node.path))}>
            <CirclePlus size={13} strokeWidth={2} />
          </button>
          <button class="hover-btn" title="New folder in {node.name}" on:click={() => (expandFolder(node.path), newFolder(node.path))}>
            <FolderPlus size={13} strokeWidth={2} />
          </button>
        </TreeRow>
        {#if ($forceOpen || $expanded[node.path]) && node.children?.length}
          <div class="children">
            <Tree nodes={node.children} root={false} />
          </div>
        {/if}
      {:else}
        <TreeRow
          {...rowProps(node)}
          renaming={$renamingPath === node.path}
          selected={node.path === $selectedPath}
          heatBg={heatStyle($heat[node.path])}>
          {#if $renamingPath === node.path}
            <div class="row request">
              <span class="method method-{node.method}" title={node.method}>{abbrevMethod(node.method)}</span>
              <RenameInput name={node.name} onCommit={(name) => commitRename(node, name)} onCancel={() => renamingPath.set(null)} />
            </div>
          {:else}
            <button class="row request" on:click={() => selectRequest(node)}>
              <span class="method method-{node.method}" title={node.method}>{abbrevMethod(node.method)}</span>
              <span class="name">{node.name}</span>
              {#if $dirtyPaths.has(node.path)}
                <span class="dirty-dot" title="Unsaved changes"></span>
              {/if}
            </button>
          {/if}
        </TreeRow>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .tree {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .children {
    /* guide line sits under the parent folder's caret center (8px row
       padding + half the 14px caret); border + margin keep the 16px indent */
    margin: 5px 0 5px 15px;
    border-left: 1px solid var(--border);
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 5px 8px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-soft);
    text-align: left;
  }

  .row.request {
    margin-left: 5px;
  }

  .hover-btn {
    display: flex;
    align-items: center;
    border: none;
    background: none;
    color: transparent;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 5px;
    flex-shrink: 0;
  }
  .hover-btn:hover {
    color: var(--green) !important;
    background: var(--green-bg);
  }
  .row :global(.caret) {
    flex-shrink: 0;
    color: #a0a0a0;
    transition: transform 0.12s ease;
  }
  .row :global(.caret.open) {
    transform: rotate(90deg);
  }
  .method {
    font-weight: 600;
    font-size: 11px;
    min-width: 30px;
    letter-spacing: 0.02em;
  }
  .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dirty-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--orange-strong);
    flex-shrink: 0;
    margin-left: auto;
  }
</style>
