<script lang="ts">
  // Recursive tree: expansion state and the folder/request row contents.
  // Row chrome (selection, heat, dnd, ⋮ menu) lives in TreeRow.
  import ChevronRight from '@lucide/svelte/icons/chevron-right';
  import FolderPlus from '@lucide/svelte/icons/folder-plus';
  import type { TreeNode } from '../shared/types';
  import Tree from './Tree.svelte';
  import TreeRow from './TreeRow.svelte';
  import { acceptPathDrag, carriesPath, readPathDrag } from './dnd';
  import { dirtyPaths, expanded, expandFolder, forceOpen, heat, heatStyle, toggleFolder } from './treeView';
  import { newRequest, selectRequest } from '../workspace/requests';
  import { selectedPath } from '../workspace/state';
  import { deleteItem, duplicateItem, moveItem, newFolder, renameItem } from '../workspace/treeOps';

  export let nodes: TreeNode[];
  export let root = true; // false for nested (recursive) levels

  let dropTarget: string | null = null;
  let menuFor: string | null = null;

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
      menuOpen: menuFor === node.path,
      onMenuToggle: () => (menuFor = menuFor === node.path ? null : node.path),
      onRename: () => { menuFor = null; renameItem(node); },
      onDuplicate: () => { menuFor = null; duplicateItem(node); },
      onDelete: () => { menuFor = null; deleteItem(node); },
    };
  }
</script>

<svelte:window on:click={() => (menuFor = null)} />

<ul class="tree" role={root ? 'tree' : 'group'}>
  {#each nodes as node (node.path)}
    <li>
      {#if node.isFolder}
        <TreeRow
          {...rowProps(node)}
          droppable={dropTarget === node.path}
          onDragOver={(e) => folderDragOver(e, node)}
          onDragLeave={() => (dropTarget = null)}
          onDrop={(e) => folderDrop(e, node)}
        >
          <button class="row folder" on:click={() => toggleFolder(node.path)}>
            <ChevronRight
              class="caret {$forceOpen || $expanded[node.path] ? 'open' : ''}"
              size={14}
              strokeWidth={2}
            />
            <span class="name">{node.name}</span>
          </button>
          <button
            class="hover-btn"
            title="New folder in {node.name}"
            on:click={() => { expandFolder(node.path); newFolder(node.path); }}
          >
            <FolderPlus size={13} strokeWidth={2} />
          </button>
          <button
            class="hover-btn"
            title="New request in {node.name}"
            on:click={() => { expandFolder(node.path); newRequest(node.path); }}
          >+</button>
        </TreeRow>
        {#if ($forceOpen || $expanded[node.path]) && node.children?.length}
          <div class="children">
            <Tree nodes={node.children} root={false} />
          </div>
        {/if}
      {:else}
        <TreeRow
          {...rowProps(node)}
          selected={node.path === $selectedPath}
          heatBg={heatStyle($heat[node.path])}
        >
          <button class="row request" on:click={() => selectRequest(node)}>
            <span class="method method-{node.method}">{node.method}</span>
            <span class="name">{node.name}</span>
            {#if $dirtyPaths.has(node.path)}
              <span class="dirty-dot" title="Unsaved changes"></span>
            {/if}
          </button>
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
    margin-left: 16px;
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
    min-width: 44px;
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
