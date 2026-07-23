<script lang="ts">
  import type { TreeNode } from './types';
  import Tree from './Tree.svelte';

  export let nodes: TreeNode[];
  export let selectedPath: string | null = null;
  export let onSelect: (node: TreeNode) => void;

  let open: Record<string, boolean> = {};

  function toggle(node: TreeNode) {
    open[node.path] = !open[node.path];
  }
</script>

<ul class="tree">
  {#each nodes as node (node.path)}
    <li>
      {#if node.isFolder}
        <button class="row folder" on:click={() => toggle(node)}>
          <svg
            class="caret"
            class:open={open[node.path]}
            width="10"
            height="10"
            viewBox="0 0 10 10"
          >
            <path d="M3 1.5 L7.5 5 L3 8.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="name">{node.name}</span>
        </button>
        {#if open[node.path] && node.children?.length}
          <div class="children">
            <Tree nodes={node.children} {selectedPath} {onSelect} />
          </div>
        {/if}
      {:else}
        <button
          class="row request"
          class:selected={node.path === selectedPath}
          on:click={() => onSelect(node)}
        >
          <span class="method method-{node.method}">{node.method}</span>
          <span class="name">{node.name}</span>
        </button>
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
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    color: #444;
    text-align: left;
  }
  .row:hover {
    background: #f5f5f5;
  }
  .row.selected {
    background: #fdf7dc;
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
  .method-GET { color: #4caf7d; }
  .method-POST { color: #6b9fdb; }
  .method-PUT { color: #e0a869; }
  .method-DELETE { color: #d98282; }
  .name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
