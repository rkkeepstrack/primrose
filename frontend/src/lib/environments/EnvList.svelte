<script lang="ts">
  // Rendering-only list pane of the environment editor; all state and
  // confirmation flows live in EnvironmentEditor.
  import type { Environment } from '../shared/types';
  import ContextMenu from '../ui/ContextMenu.svelte';

  export let environments: Environment[];
  export let activeName: string | null;
  export let onPick: (name: string) => void;
  export let onCreate: () => void;
  export let onRename: (name: string) => void;
  export let onDuplicate: (name: string) => void;
  export let onDelete: (name: string) => void;
</script>

<aside class="env-list">
  {#each environments as e (e.name)}
    <div class="env-row" class:active={e.name === activeName}>
      <button class="env-name" on:click={() => onPick(e.name)}>
        {e.name}
      </button>
      <ContextMenu onRename={() => onRename(e.name)} onDuplicate={() => onDuplicate(e.name)} onDelete={() => onDelete(e.name)} />
    </div>
  {:else}
    <p class="empty">No environments yet.</p>
  {/each}
  <button class="new-env" on:click={onCreate}>+ New environment</button>
</aside>

<style>
  .env-list {
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .env-row {
    display: flex;
    align-items: center;
  }
  .env-row:hover:not(.active) {
    background: var(--bg-hover);
  }
  .env-row.active {
    background: var(--purple-bg);
    box-shadow: inset 3px 0 0 var(--purple);
  }
  .env-row.active .env-name {
    font-weight: 600;
    color: var(--text-strong);
  }
  .env-row.active :global(.hover-btn),
  .env-row:hover :global(.hover-btn) {
    color: var(--text-soft);
  }
  .env-name {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    text-align: left;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-muted);
    padding: 6px 10px;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .new-env {
    margin-top: 6px;
    border: none;
    background: none;
    text-align: left;
    font-family: inherit;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 6px;
    color: var(--text-placeholder);
    font-size: 12px;
  }
  .new-env:hover {
    color: var(--purple-text);
    background: var(--purple-bg);
  }
  .empty {
    color: var(--text-disabled);
    font-size: 13px;
  }
</style>
