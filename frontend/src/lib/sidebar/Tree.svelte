<script lang="ts">
  // Recursive tree: expansion state and the folder/request row contents.
  // Row chrome (selection, heat, dnd, ⋮ menu) lives in TreeRow.
  import type { TreeNode } from '../shared/types';
  import Tree from './Tree.svelte';
  import TreeRow from './TreeRow.svelte';
  import { acceptPathDrag, carriesPath, readPathDrag } from './dnd';
  import { dirtyPaths, forceOpen, heat, heatStyle } from './treeView';
  import { newRequest, selectRequest } from '../workspace/requests';
  import { selectedPath } from '../workspace/state';
  import { deleteItem, duplicateItem, moveItem, newFolder, renameItem } from '../workspace/treeOps';

  export let nodes: TreeNode[];
  export let root = true; // false for nested (recursive) levels

  let open: Record<string, boolean> = {};
  let dropTarget: string | null = null;
  let menuFor: string | null = null;

  function toggle(node: TreeNode) {
    open[node.path] = !open[node.path];
  }

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
      open[node.path] = true;
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
          <button class="row folder" on:click={() => toggle(node)}>
            <svg
              class="caret"
              class:open={$forceOpen || open[node.path]}
              width="10"
              height="10"
              viewBox="0 0 10 10"
            >
              <path d="M3 1.5 L7.5 5 L3 8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <span class="name">{node.name}</span>
          </button>
          <button
            class="hover-btn"
            title="New folder in {node.name}"
            on:click={() => { open[node.path] = true; newFolder(node.path); }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
              <path d="M1.5 4.5 a1 1 0 0 1 1-1 h3.5 l1.5 1.8 h6 a1 1 0 0 1 1 1 v6.2 a1 1 0 0 1 -1 1 h-11 a1 1 0 0 1 -1-1 z" />
              <path d="M8 7.6 v4 M6 9.6 h4" stroke-linecap="round" />
            </svg>
          </button>
          <button
            class="hover-btn"
            title="New request in {node.name}"
            on:click={() => { open[node.path] = true; newRequest(node.path); }}
          >+</button>
        </TreeRow>
        {#if ($forceOpen || open[node.path]) && node.children?.length}
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
  .caret {
    flex-shrink: 0;
    color: #a0a0a0;
    transition: transform 0.12s ease;
  }
  .caret.open {
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
