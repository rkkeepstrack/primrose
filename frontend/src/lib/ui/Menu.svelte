<script lang="ts">
  // Dropdown menu = Popover mechanics + a vertical item list. Compose with
  // MenuItem / MenuSep in the default slot.
  import Popover from './Popover.svelte';

  export let placement: 'bottom-start' | 'bottom-end' = 'bottom-end';
</script>

<Popover trigger="click" {placement}>
  <slot name="trigger" slot="trigger" />
  <div class="menu">
    <slot />
  </div>
</Popover>

<style>
  .menu {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-width: 120px;
    padding: 4px;
  }
</style>
