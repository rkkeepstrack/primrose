<script lang="ts">
  // The ⋮ button plus its Rename/Duplicate/Delete menu, shared by folder
  // and request rows in the tree and the environment list.
  import Menu from './Menu.svelte';
  import MenuItem from './MenuItem.svelte';

  export let onRename: () => void;
  export let onDuplicate: () => void;
  export let onDelete: () => void;
</script>

<Menu placement="bottom-end">
  <button slot="trigger" class="hover-btn" title="More…">⋮</button>
  <MenuItem onSelect={onRename}>Rename</MenuItem>
  <MenuItem onSelect={onDuplicate}>Duplicate</MenuItem>
  <MenuItem danger onSelect={onDelete}>Delete</MenuItem>
</Menu>

<style>
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
</style>
