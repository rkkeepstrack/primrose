<script lang="ts">
  import type { Environment } from '../shared/types';
  import KeyValueEditor from '../ui/KeyValueEditor.svelte';
  import SplitPane from '../ui/SplitPane.svelte';
  import ContextMenu from '../ui/ContextMenu.svelte';
  import { confirmDialog, promptDialog } from '../ui/dialogs';
  import { confirmDiscardEnvEdits, deleteEnvironment, duplicateEnvironment, renameEnvironment } from '../workspace/environments';
  import { envDrafts, envSaveSignal } from '../workspace/state';

  export let root: string;
  export let environments: Environment[];
  export let activeName: string | null;
  export let onSelect: (name: string) => void;
  export let onSave: (name: string, vars: Record<string, string>, headers: Record<string, string>) => Promise<void> | void;
  export let onCreate: (name: string) => void;

  let search = '';
  let draft: Record<string, string> | null = null;
  let headersDraft: Record<string, string> | null = null;
  let draftFor: string | null = null;
  function menuAction(action: (root: string, name: string) => void, name: string) {
    draftFor = null; // the list may change under us — rebuild the draft
    action(root, name);
  }

  $: active = environments.find((e) => e.name === activeName) ?? null;

  // reset draft when switching environments; a stashed draft from a previous
  // tab switch takes precedence so unsaved edits survive leaving the tab
  $: if (active && draftFor !== active.name) {
    draftFor = active.name;
    const stash = $envDrafts[root];
    if (stash && stash.name === active.name) {
      draft = { ...stash.vars };
      headersDraft = { ...stash.headers };
    } else {
      draft = { ...active.vars };
      headersDraft = { ...active.headers };
    }
    search = '';
  }

  $: filtered = draft
    ? Object.fromEntries(
        Object.entries(draft).filter(
          ([k, v]) => !search || k.toLowerCase().includes(search.toLowerCase()) || v.toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : {};

  // key-order-insensitive comparison — the draft is rebuilt in row order,
  // which JSON.stringify would flag as a change even when values match
  function sameVars(a: Record<string, string>, b: Record<string, string>): boolean {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
  }

  $: dirty = active && draft && headersDraft ? !sameVars(draft, active.vars) || !sameVars(headersDraft, active.headers) : false;

  // keep the shared stash in sync: dirty drafts survive unmounting (tab
  // switches), clean state drops the stash again
  $: syncStash(dirty, draft, headersDraft);
  function syncStash(d: boolean, vars: Record<string, string> | null, headers: Record<string, string> | null) {
    envDrafts.update((m) => {
      if (d && draftFor && vars && headers) return { ...m, [root]: { name: draftFor, vars, headers } };
      if (!d && m[root]) {
        const { [root]: _, ...rest } = m;
        return rest;
      }
      return m;
    });
  }

  async function createEnv() {
    if (!(await confirmDiscardEnvEdits(root))) return;
    const name = await promptDialog('Environment name:');
    if (!name?.trim()) return;
    draftFor = null;
    onCreate(name.trim());
  }

  async function pick(name: string) {
    if (name === activeName) return;
    if (!(await confirmDiscardEnvEdits(root))) return;
    draftFor = null; // force a fresh draft for the newly picked environment
    onSelect(name);
  }

  function handleChange(entries: Record<string, string>) {
    if (!draft) return;
    if (search) {
      // editing a filtered view: merge changes back over the unfiltered draft
      const hidden = Object.fromEntries(Object.entries(draft).filter(([k]) => !(k in filtered)));
      draft = { ...hidden, ...entries };
    } else {
      draft = entries;
    }
  }

  async function save() {
    if (!active || !draft || !headersDraft) return;
    await onSave(active.name, draft, headersDraft);
    // resync from the saved file so the rows show the alphabetical order
    // the file was written in
    draftFor = null;
  }

  // ⌘S while this tab is active (routed via the native menu handler)
  let lastSaveSignal: number | null = null;
  $: if ($envSaveSignal !== lastSaveSignal) {
    const first = lastSaveSignal === null;
    lastSaveSignal = $envSaveSignal;
    if (!first && dirty) save();
  }
</script>

<div class="env-editor">
  <SplitPane initialPct={18} minPct={12} maxPct={40}>
    <aside class="env-list" slot="left">
      {#each environments as e (e.name)}
        <div class="env-row" class:active={e.name === activeName}>
          <button class="env-name" on:click={() => pick(e.name)}>
            {e.name}
          </button>
          <ContextMenu
            onRename={() => menuAction(renameEnvironment, e.name)}
            onDuplicate={() => menuAction(duplicateEnvironment, e.name)}
            onDelete={() => menuAction(deleteEnvironment, e.name)} />
        </div>
      {:else}
        <p class="empty">No environments yet.</p>
      {/each}
      <button class="new-env" on:click={createEnv}>+ New environment</button>
    </aside>

    <section class="env-detail" slot="right">
      {#if active && draft}
        <div class="toolbar">
          <input class="search text-input" placeholder="Search for Variables or Values…" bind:value={search} />
          <button class="save btn-save" class:dirty on:click={save} disabled={!dirty}>
            Save{dirty ? ' •' : ''}
          </button>
        </div>
        <KeyValueEditor entries={filtered} onChange={handleChange} />
        {#if search}
          <p class="note">Filtered view — hidden variables are kept as they are.</p>
        {/if}

        <h3 class="section-title">Headers</h3>
        <p class="note">Inherited by every request while this environment is active — auth lives here.</p>
        {#if headersDraft}
          <KeyValueEditor entries={headersDraft} onChange={(h) => (headersDraft = h)} />
        {/if}
      {:else}
        <p class="empty">Select an environment on the left.</p>
      {/if}
    </section>
  </SplitPane>
</div>

<style>
  .env-editor {
    display: flex;
    height: 100%;
    min-height: 0;
  }
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
    color: #666;
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
    color: #999;
    font-size: 12px;
  }
  .new-env:hover {
    color: var(--purple-text);
    background: var(--purple-bg);
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
