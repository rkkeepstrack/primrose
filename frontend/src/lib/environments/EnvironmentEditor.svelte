<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Environment } from '../shared/types';
  import KeyValueEditor from '../ui/KeyValueEditor.svelte';
  import { confirmDialog } from '../ui/dialogs';
  import { envEditorDirty } from '../workspace/state';

  export let environments: Environment[];
  export let activeName: string | null;
  export let onSelect: (name: string) => void;
  export let onSaveVars: (name: string, vars: Record<string, string>) => void;

  let search = '';
  let draft: Record<string, string> | null = null;
  let draftFor: string | null = null;

  $: active = environments.find((e) => e.name === activeName) ?? null;

  // reset draft when switching environments
  $: if (active && draftFor !== active.name) {
    draftFor = active.name;
    draft = { ...active.vars };
    search = '';
  }

  $: filtered = draft
    ? Object.fromEntries(
        Object.entries(draft).filter(
          ([k, v]) =>
            !search ||
            k.toLowerCase().includes(search.toLowerCase()) ||
            v.toLowerCase().includes(search.toLowerCase())
        )
      )
    : {};

  // key-order-insensitive comparison — the draft is rebuilt in row order,
  // which JSON.stringify would flag as a change even when values match
  function sameVars(a: Record<string, string>, b: Record<string, string>): boolean {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
  }

  $: dirty = active && draft ? !sameVars(draft, active.vars) : false;
  $: envEditorDirty.set(dirty);
  onDestroy(() => envEditorDirty.set(false));

  async function pick(name: string) {
    if (name === activeName) return;
    if (dirty && !(await confirmDialog('Discard unsaved environment changes?'))) return;
    draftFor = null; // force a fresh draft for the newly picked environment
    onSelect(name);
  }

  function handleChange(entries: Record<string, string>) {
    if (!draft) return;
    if (search) {
      // editing a filtered view: merge changes back over the unfiltered draft
      const hidden = Object.fromEntries(
        Object.entries(draft).filter(([k]) => !(k in filtered))
      );
      draft = { ...hidden, ...entries };
    } else {
      draft = entries;
    }
  }

  function save() {
    if (active && draft) onSaveVars(active.name, draft);
  }
</script>

<div class="env-editor">
  <aside class="env-list">
    {#each environments as e (e.name)}
      <button class:active={e.name === activeName} on:click={() => pick(e.name)}>
        {e.name}
      </button>
    {:else}
      <p class="empty">No environments yet.<br />Add TOML files under <code>environments/</code>.</p>
    {/each}
  </aside>

  <section class="env-detail">
    {#if active && draft}
      <div class="toolbar">
        <input class="search text-input" placeholder="Search for Variables or Values…" bind:value={search} />
        <button class="save" class:dirty on:click={save} disabled={!dirty}>
          Save{dirty ? ' •' : ''}
        </button>
      </div>
      <KeyValueEditor entries={filtered} onChange={handleChange} />
      {#if search}
        <p class="note">Filtered view — hidden variables are kept as they are.</p>
      {/if}
    {:else}
      <p class="empty">Select an environment on the left.</p>
    {/if}
  </section>
</div>

<style>
  .env-editor {
    display: grid;
    grid-template-columns: 220px 1fr;
    height: 100%;
    min-height: 0;
  }
  .env-list {
    border-right: 1px solid #e5e5e5;
    padding: 12px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .env-list button {
    border: none;
    background: none;
    text-align: left;
    font-size: 13px;
    font-family: inherit;
    color: #666;
    padding: 6px 10px;
    border-radius: 6px;
    cursor: pointer;
  }
  .env-list button:hover { background: #f5f5f5; }
  .env-list button.active {
    color: var(--green-text);
    font-weight: 600;
    background: var(--green-bg);
  }
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
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fff;
    font-size: 13px;
    font-family: inherit;
    color: #666;
    cursor: pointer;
    padding: 0 16px;
  }
  .save:disabled { opacity: 0.5; cursor: default; }
  .save.dirty {
    border-color: var(--yellow-border);
    background: var(--yellow-bg);
    color: #333;
  }
  .note { color: #bbb; font-size: 12px; margin: 0; }
  .empty { color: #aaa; font-size: 13px; }
  code { font-size: 12px; }
</style>
