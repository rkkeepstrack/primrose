<script lang="ts">
  import type { TreeNode } from './types';
  import Tree from './Tree.svelte';

  export let nodes: TreeNode[];
  export let selectedPath: string | null = null;
  export let onSelect: (node: TreeNode) => void;
  export let onNewRequest: (dirPath: string) => void;
  export let onNewFolder: (dirPath: string) => void;
  export let onMove: (src: string, destDir: string) => void;
  export let onRename: (node: TreeNode) => void;
  export let onDuplicate: (node: TreeNode) => void;
  export let onDelete: (node: TreeNode) => void;
  export let forceOpen = false; // expand everything while searching
  export let heat: Record<string, number> = {}; // path -> 0..1 recency
  export let dirtyPaths: Set<string> = new Set(); // unsaved edits

  let open: Record<string, boolean> = {};
  let dropTarget: string | null = null;
  let menuFor: string | null = null;

  function toggle(node: TreeNode) {
    open[node.path] = !open[node.path];
  }

  // Recency as a subtle hue journey: most recent is teal, wandering through
  // blue and purple to pink for the oldest touches. Deliberately distinct
  // from the yellow selection highlight.
  function heatStyle(path: string): string {
    const h = heat[path];
    if (!h) return '';
    // widest hue span that stays clear of the yellow selection color:
    // green -> teal -> blue -> purple -> pink, ~23° per recency step so
    // neighbouring entries are clearly distinct
    // true heatmap semantics: warm when fresh, cooling with age.
    // newest = coral (20°, neighbouring the yellow/orange selection),
    // aging through pink/purple/blue to teal (190°)
    const hue = (380 - (1 - h) * 190) % 360;
    // intensity fades linearly with age, ending near zero so the oldest
    // entry melts into the white bg
    const alpha = 0.15 * h;
    return `background: hsla(${hue.toFixed(0)}, 80%, 52%, ${alpha.toFixed(3)})`;
  }

  function dragStart(e: DragEvent, node: TreeNode) {
    e.dataTransfer?.setData('application/x-primrose-path', node.path);
    e.dataTransfer!.effectAllowed = 'move';
  }

  function dragOver(e: DragEvent, node: TreeNode) {
    if (!e.dataTransfer?.types.includes('application/x-primrose-path')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dropTarget = node.path;
  }

  function drop(e: DragEvent, node: TreeNode) {
    e.preventDefault();
    e.stopPropagation();
    dropTarget = null;
    const src = e.dataTransfer?.getData('application/x-primrose-path');
    if (src && src !== node.path) {
      open[node.path] = true;
      onMove(src, node.path);
    }
  }

  function menuAction(action: (n: TreeNode) => void, node: TreeNode) {
    menuFor = null;
    action(node);
  }
</script>

<svelte:window on:click={() => (menuFor = null)} />

<ul class="tree">
  {#each nodes as node (node.path)}
    <li>
      {#if node.isFolder}
        <div
          class="row-wrap"
          class:droppable={dropTarget === node.path}
          role="treeitem"
          aria-selected="false"
          draggable="true"
          on:dragstart={(e) => dragStart(e, node)}
          on:dragover={(e) => dragOver(e, node)}
          on:dragleave={() => (dropTarget = null)}
          on:drop={(e) => drop(e, node)}
        >
          <button class="row folder" on:click={() => toggle(node)}>
            <svg
              class="caret"
              class:open={forceOpen || open[node.path]}
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
            on:click={() => { open[node.path] = true; onNewFolder(node.path); }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
              <path d="M1.5 4.5 a1 1 0 0 1 1-1 h3.5 l1.5 1.8 h6 a1 1 0 0 1 1 1 v6.2 a1 1 0 0 1 -1 1 h-11 a1 1 0 0 1 -1-1 z" />
              <path d="M8 7.6 v4 M6 9.6 h4" stroke-linecap="round" />
            </svg>
          </button>
          <button
            class="hover-btn"
            title="New request in {node.name}"
            on:click={() => { open[node.path] = true; onNewRequest(node.path); }}
          >+</button>
          <div class="menu-wrap">
            <button
              class="hover-btn"
              title="More…"
              on:click|stopPropagation={() => (menuFor = menuFor === node.path ? null : node.path)}
            >⋮</button>
            {#if menuFor === node.path}
              <div class="menu">
                <button on:click={() => menuAction(onRename, node)}>Rename</button>
                <button on:click={() => menuAction(onDuplicate, node)}>Duplicate</button>
                <button class="danger" on:click={() => menuAction(onDelete, node)}>Delete</button>
              </div>
            {/if}
          </div>
        </div>
        {#if (forceOpen || open[node.path]) && node.children?.length}
          <div class="children">
            <Tree
              nodes={node.children}
              {selectedPath}
              {onSelect}
              {onNewRequest}
              {onNewFolder}
              {onMove}
              {onRename}
              {onDuplicate}
              {onDelete}
              {forceOpen}
              {heat}
              {dirtyPaths}
            />
          </div>
        {/if}
      {:else}
        <div
          class="row-wrap"
          class:selected={node.path === selectedPath}
          style={node.path === selectedPath ? '' : heatStyle(node.path)}
        >
          <button
            class="row request"
            draggable="true"
            on:dragstart={(e) => dragStart(e, node)}
            on:click={() => onSelect(node)}
          >
            <span class="method method-{node.method}">{node.method}</span>
            <span class="name">{node.name}</span>
            {#if dirtyPaths.has(node.path)}
              <span class="dirty-dot" title="Unsaved changes"></span>
            {/if}
          </button>
          <div class="menu-wrap">
            <button
              class="hover-btn"
              title="More…"
              on:click|stopPropagation={() => (menuFor = menuFor === node.path ? null : node.path)}
            >⋮</button>
            {#if menuFor === node.path}
              <div class="menu">
                <button on:click={() => menuAction(onRename, node)}>Rename</button>
                <button on:click={() => menuAction(onDuplicate, node)}>Duplicate</button>
                <button class="danger" on:click={() => menuAction(onDelete, node)}>Delete</button>
              </div>
            {/if}
          </div>
        </div>
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
    color: #444;
    text-align: left;
  }
  .row-wrap {
    display: flex;
    align-items: center;
  }
  .row-wrap:hover:not(.selected) {
    background: #f5f5f5;
  }
  .row-wrap.selected {
    background: #fdf7dc;
    box-shadow: inset 3px 0 0 #e8a94c;
  }
  .row-wrap.selected .hover-btn {
    color: #444;
  }
  .row-wrap.selected .name {
    font-weight: 600;
    color: #1d1d1d;
  }
  .row-wrap.droppable {
    background: #f4faf6;
    outline: 1px dashed #4caf7d;
  }
  .row-wrap .row { flex: 1; min-width: 0; }
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
  .row-wrap:hover .hover-btn { color: #444; }
  .hover-btn:hover { color: #4caf7d !important; background: #f4faf6; }
  .menu-wrap { position: relative; }
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 2px);
    background: #fff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    padding: 4px;
    z-index: 20;
    display: flex;
    flex-direction: column;
    min-width: 120px;
  }
  .menu button {
    border: none;
    background: none;
    text-align: left;
    font-size: 13px;
    font-family: inherit;
    color: #444;
    padding: 6px 10px;
    border-radius: 5px;
    cursor: pointer;
  }
  .menu button:hover { background: #f5f5f5; }
  .menu button.danger { color: #d98282; }
  .menu button.danger:hover { background: #fdf0f0; }
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
  .method-GET { color: #4caf7d; }
  .method-POST { color: #6b9fdb; }
  .method-PUT { color: #e0a869; }
  .method-DELETE { color: #d98282; }
  .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dirty-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #e8a94c;
    flex-shrink: 0;
    margin-left: auto;
  }
</style>
