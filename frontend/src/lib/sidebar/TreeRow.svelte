<script lang="ts">
  // Row chrome shared by folder and request rows: the wrapper with hover/
  // selection/heat states, drag & drop wiring, and the ⋮ context menu.
  import type { TreeNode } from '../shared/types';
  import ContextMenu from '../ui/ContextMenu.svelte';
  import { startPathDrag } from './dnd';

  export let node: TreeNode;
  export let selected = false;
  export let heatBg = ''; // inline background style from the recency heatmap
  export let droppable = false; // highlighted as a drop target (folders)
  export let menuOpen: boolean;
  export let onMenuToggle: () => void;
  export let onRename: () => void;
  export let onDuplicate: () => void;
  export let onDelete: () => void;
  // folders accept drops; requests leave these unset
  export let onDragOver: ((e: DragEvent) => void) | undefined = undefined;
  export let onDragLeave: (() => void) | undefined = undefined;
  export let onDrop: ((e: DragEvent) => void) | undefined = undefined;
</script>

<div
  class="row-wrap"
  class:selected
  class:droppable
  role="treeitem"
  aria-selected={selected}
  tabindex="-1"
  style={selected ? '' : heatBg}
  draggable="true"
  on:dragstart={(e) => startPathDrag(e, node.path)}
  on:dragover={onDragOver}
  on:dragleave={onDragLeave}
  on:drop={onDrop}
>
  <slot />
  <ContextMenu
    open={menuOpen}
    onToggle={onMenuToggle}
    {onRename}
    {onDuplicate}
    {onDelete}
  />
</div>

<style>
  .row-wrap {
    display: flex;
    align-items: center;
  }
  .row-wrap:hover:not(.selected) {
    background: var(--bg-hover);
  }
  .row-wrap.selected {
    background: var(--yellow-bg);
    box-shadow: inset 3px 0 0 var(--orange-strong);
  }
  .row-wrap.selected :global(.hover-btn),
  .row-wrap:hover :global(.hover-btn) {
    color: var(--text-soft);
  }
  .row-wrap.selected :global(.name) {
    font-weight: 600;
    color: var(--text-strong);
  }
  .row-wrap.droppable {
    background: var(--green-bg);
    outline: 1px dashed var(--green);
  }
  .row-wrap :global(.row) {
    flex: 1;
    min-width: 0;
  }
</style>
