<script lang="ts">
  // The ⋮ button plus its Rename/Duplicate/Delete popup, shared by folder
  // and request rows in the tree.
  export let open: boolean;
  export let onToggle: () => void;
  export let onRename: () => void;
  export let onDuplicate: () => void;
  export let onDelete: () => void;
</script>

<div class="menu-wrap">
  <button class="hover-btn" title="More…" on:click|stopPropagation={onToggle}>⋮</button>
  {#if open}
    <div class="menu">
      <button on:click={onRename}>Rename</button>
      <button on:click={onDuplicate}>Duplicate</button>
      <button class="danger" on:click={onDelete}>Delete</button>
    </div>
  {/if}
</div>

<style>
  .menu-wrap {
    position: relative;
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
  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 2px);
    background: #fff;
    border: 1px solid var(--border);
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
    color: var(--text-soft);
    padding: 6px 10px;
    border-radius: 5px;
    cursor: pointer;
  }
  .menu button:hover {
    background: var(--bg-hover);
  }
  .menu button.danger {
    color: var(--red);
  }
  .menu button.danger:hover {
    background: var(--red-bg);
  }
</style>
