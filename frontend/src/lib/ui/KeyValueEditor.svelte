<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import Eye from '@lucide/svelte/icons/eye';
  import EyeOff from '@lucide/svelte/icons/eye-off';
  import Lock from '@lucide/svelte/icons/lock';
  import LockOpen from '@lucide/svelte/icons/lock-open';
  import Power from '@lucide/svelte/icons/power';
  import CodeEditor from '../editor/CodeEditor.svelte';
  import { findDuplicateKeys, toEntries, toRows, type Row } from './keyValueTable';
  export let entries: Record<string, string>;
  export let onChange: (entries: Record<string, string>) => void;
  // read-only rows shown pinned on top (e.g. headers inherited from the
  // environment); struck through once an own row overrides the same name
  export let inherited: Record<string, string> = {};
  // keys whose values are secret: masked input + reveal toggle. When
  // onToggleSecret is set, every row gets a lock button to flip the flag.
  export let secretKeys: string[] = [];
  export let onToggleSecret: ((key: string) => void) | null = null;
  // keys switched off (kept in the table, dimmed). When onToggleEnabled is
  // set, every row gets a power button to flip it.
  export let disabledKeys: string[] = [];
  export let onToggleEnabled: ((key: string, enabled: boolean) => void) | null = null;

  // when set, non-secret values get {{var}} highlighting, hover and completion
  export let envVars: Record<string, string> | null = null;
  // forwarded to the value editors so their undo history resets per request
  export let docKey: unknown = undefined;

  let revealed: Record<string, boolean> = {};
  $: secretSet = new Set(secretKeys);
  $: disabledSet = new Set(disabledKeys);

  // Local row model so keys can be edited without map-key collisions.
  let rows: Row[] = toRows(entries);
  let lastEntries = entries;

  // Re-sync only when the parent hands us a different object (request switch).
  $: if (entries !== lastEntries) {
    lastEntries = entries;
    rows = toRows(entries);
  }

  function emit() {
    const out = toEntries(rows);
    lastEntries = out;
    onChange(out);
  }

  $: duplicateKeys = findDuplicateKeys(rows);

  function addRow() {
    rows = [...rows, { key: '', value: '' }];
  }

  function removeRow(i: number) {
    rows = rows.filter((_, idx) => idx !== i);
    emit();
  }
</script>

<table class="kv-table kv">
  <thead><tr><th>Name</th><th>Value</th><th></th></tr></thead>
  <tbody>
    {#each Object.entries(inherited) as [k, v] (k)}
      {@const overridden = rows.some((r) => r.key.toLowerCase() === k.toLowerCase())}
      <tr class="inherited-row" class:overridden>
        <td class="ro">{k}</td>
        <td class="ro">{v}</td>
        <td class="origin">inherited</td>
      </tr>
    {/each}
    {#each rows as row, i (row)}
      <tr class:off={disabledSet.has(row.key)}>
        <td class:duplicate={duplicateKeys.has(row.key)}>
          <input
            placeholder="name"
            bind:value={row.key}
            on:input={emit}
            title={duplicateKeys.has(row.key) ? 'Duplicate name — only the last value is used' : ''} />
        </td>
        <td class="value-cell">
          {#if secretSet.has(row.key) && !revealed[row.key]}
            <input placeholder="value" type="password" bind:value={row.value} on:input={emit} />
          {:else if envVars}
            <div class="cell-editor">
              <CodeEditor
                singleLine
                value={row.value}
                placeholder="value"
                {envVars}
                {docKey}
                onChange={(v) => {
                  row.value = v;
                  emit();
                }} />
            </div>
          {:else}
            <input placeholder="value" type="text" bind:value={row.value} on:input={emit} />
          {/if}
          {#if secretSet.has(row.key)}
            <button
              class="reveal"
              title={revealed[row.key] ? 'Hide value' : 'Reveal value'}
              on:click={() => (revealed = { ...revealed, [row.key]: !revealed[row.key] })}>
              {#if revealed[row.key]}<EyeOff size={13} strokeWidth={2} />{:else}<Eye size={13} strokeWidth={2} />{/if}
            </button>
          {/if}
        </td>
        <td class="actions">
          {#if onToggleEnabled}
            <button
              class="enable-toggle"
              class:is-off={disabledSet.has(row.key)}
              title={disabledSet.has(row.key) ? 'Enable' : 'Disable (keeps the row)'}
              on:click={() => onToggleEnabled?.(row.key, disabledSet.has(row.key))}>
              <Power size={13} strokeWidth={2} />
            </button>
          {/if}
          {#if onToggleSecret}
            <button
              class="secret-toggle"
              class:is-secret={secretSet.has(row.key)}
              title={secretSet.has(row.key) ? 'Secret — click to make normal' : 'Make secret'}
              on:click={() => onToggleSecret?.(row.key)}>
              {#if secretSet.has(row.key)}<Lock size={13} strokeWidth={2} />{:else}<LockOpen size={13} strokeWidth={2} />{/if}
            </button>
          {/if}
          <button class="remove" title="Remove" on:click={() => removeRow(i)}><X size={13} strokeWidth={2} /></button>
        </td>
      </tr>
    {/each}
    <tr>
      <td colspan="3">
        <button class="add" on:click={addRow}>+ Add</button>
      </td>
    </tr>
  </tbody>
</table>

<style>
  .kv td {
    padding: 0;
  }
  td input {
    width: 100%;
    box-sizing: border-box;
    border: none;
    padding: 7px 12px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-soft);
    background: transparent;
  }
  td input:focus {
    outline: none;
    background: var(--yellow-bg);
  }
  tr.off td:not(.actions),
  tr.off .secret-toggle {
    opacity: 0.45;
  }
  tr.off td input,
  tr.off .cell-editor :global(.cm-line) {
    text-decoration: line-through;
  }
  /* the CodeMirror value cell mimics the plain inputs around it */
  .cell-editor {
    display: flex;
    flex: 1;
    min-width: 0;
  }
  .cell-editor :global(.cm-content) {
    padding: 7px 10px;
  }
  .cell-editor:focus-within {
    background: var(--yellow-bg);
  }
  td.duplicate input {
    color: var(--red);
    text-decoration: underline wavy var(--red);
  }
  .inherited-row td {
    background: var(--purple-bg-soft); /* whisper of environment purple */
    color: var(--text-faint);
  }
  .inherited-row td.ro {
    padding: 7px 12px;
  }
  .inherited-row td.origin {
    font-size: 11px;
    color: var(--purple-soft);
    text-align: center;
    white-space: nowrap;
    padding: 7px 10px;
  }
  .inherited-row.overridden td.ro {
    text-decoration: line-through;
    opacity: 0.6;
  }
  td.actions {
    width: 64px;
    white-space: nowrap;
    text-align: center;
  }
  .value-cell {
    position: relative;
  }
  .value-cell .reveal {
    position: absolute;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    border: none;
    background: none;
    display: flex;
    align-items: center;
    cursor: pointer;
    color: var(--text-faint);
  }
  .secret-toggle {
    border: none;
    background: none;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    color: var(--text-faint);
  }
  .secret-toggle.is-secret {
    color: var(--purple-soft);
  }
  .enable-toggle {
    border: none;
    background: none;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    color: var(--text-faint);
  }
  .enable-toggle:hover {
    color: var(--text-soft);
  }
  .enable-toggle.is-off {
    color: var(--orange-strong);
  }
  .remove {
    border: none;
    background: none;
    display: inline-flex;
    align-items: center;
    color: var(--text-ghost);
    cursor: pointer;
    padding: 6px 10px;
  }
  .remove:hover {
    color: var(--red);
  }
  .add {
    border: none;
    background: none;
    color: var(--text-placeholder);
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    padding: 6px 12px;
  }
  .add:hover {
    color: var(--green);
  }
</style>
