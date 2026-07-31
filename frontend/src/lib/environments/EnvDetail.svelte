<script lang="ts">
  // Rendering-only detail pane of the environment editor: search, variable
  // and header tables, save button. Draft state lives in EnvironmentEditor.
  import KeyValueEditor from '../ui/KeyValueEditor.svelte';

  export let active: boolean;
  export let search: string;
  export let filtered: Record<string, string>;
  export let dirty: boolean;
  export let headersDraft: Record<string, string> | null;
  export let onChange: (entries: Record<string, string>) => void;
  export let onHeadersChange: (entries: Record<string, string>) => void;
  export let onSave: () => void;
</script>

<section class="env-detail">
  {#if active}
    <div class="toolbar">
      <input class="search text-input" placeholder="Search for Variables or Values…" bind:value={search} />
      <button class="save btn-save" class:dirty on:click={onSave} disabled={!dirty}>
        Save{dirty ? ' •' : ''}
      </button>
    </div>
    <KeyValueEditor entries={filtered} {onChange} />
    {#if search}
      <p class="note">Filtered view — hidden variables are kept as they are.</p>
    {/if}

    <h3 class="section-title">Headers</h3>
    <p class="note">Inherited by every request while this environment is active — auth lives here.</p>
    {#if headersDraft}
      <KeyValueEditor entries={headersDraft} onChange={onHeadersChange} />
    {/if}
  {:else}
    <p class="empty">Select an environment on the left.</p>
  {/if}
</section>

<style>
  .env-detail {
    padding: 16px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .toolbar {
    display: flex;
    gap: 8px;
  }
  .search {
    flex: 1;
  }
  .save {
    font-size: 13px;
    padding: 0 16px;
  }
  .note {
    color: #bbb;
    font-size: 12px;
    margin: 0;
  }
  .section-title {
    margin: 14px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--green-text);
  }
  .empty {
    color: #aaa;
    font-size: 13px;
  }
</style>
