<script lang="ts">
  export let tabs: string[];
  export let active: string;
  export let onSelect: (tab: string) => void;
  export let accent = 'var(--green)';
</script>

<nav class="tabs" style="--tab-accent: {accent}">
  {#each tabs as t (t)}
    <button class:active={t === active} on:click={() => onSelect(t)}>
      {t[0].toUpperCase() + t.slice(1)}
    </button>
  {/each}
</nav>

<style>
  .tabs {
    display: flex;
    gap: 18px;
    border-bottom: 1px solid var(--border-faint);
  }
  .tabs button {
    border: none;
    background: none;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 6px 2px;
    color: var(--text-faint);
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .tabs button.active {
    color: var(--text);
    border-bottom-color: var(--tab-accent);
  }
</style>
