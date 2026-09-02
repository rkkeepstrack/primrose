<script lang="ts">
  export let tabs: string[];
  export let active: string;
  export let onSelect: (tab: string) => void;
  export let accent = 'var(--green)';
  // optional per-tab count badge, e.g. tests "3/3" (green) or "1/3" (red)
  export let badges: Record<string, { text: string; ok: boolean }> = {};
</script>

<nav class="tabs" style="--tab-accent: {accent}">
  {#each tabs as t (t)}
    <button class:active={t === active} on:click={() => onSelect(t)}>
      {t[0].toUpperCase() + t.slice(1)}
      {#if badges[t]}
        <span class="badge" class:fail={!badges[t].ok}>{badges[t].text}</span>
      {/if}
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
    transition:
      color 0.12s ease,
      border-bottom-color 0.12s ease;
  }
  .tabs button:hover:not(.active) {
    color: var(--text-soft);
    border-bottom-color: var(--border);
  }
  .tabs button.active {
    color: var(--text);
    border-bottom-color: var(--tab-accent);
  }
  .badge {
    font-family: var(--mono);
    font-size: 10.5px;
    padding: 1px 6px;
    border-radius: 8px;
    margin-left: 4px;
    background: var(--green-bg);
    color: var(--green-text);
  }
  .badge.fail {
    background: var(--red-bg);
    color: var(--red-text);
  }
</style>
