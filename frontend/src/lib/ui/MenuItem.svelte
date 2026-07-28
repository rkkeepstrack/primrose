<script lang="ts">
  // One row of a Menu. `current` colors are themable per menu via the
  // --menu-current-color/-bg custom properties (default: green).
  export let onSelect: () => void;
  export let danger = false;
  export let current = false;
  let klass = '';
  export { klass as class };
</script>

<button class="item {klass}" class:danger class:current on:click={onSelect}>
  <slot />
</button>

<style>
  .item {
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
  .item:hover {
    background: var(--bg-hover);
  }
  .item.current {
    color: var(--menu-current-color, var(--green-text));
    background: var(--menu-current-bg, var(--green-bg));
    font-weight: 600;
  }
  .item.danger {
    color: var(--red);
  }
  .item.danger:hover {
    background: var(--red-bg);
  }
</style>
