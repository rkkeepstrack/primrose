<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  import { findDuplicateKeys, toEntries, toRows, type Row } from './keyValueTable';
  export let entries: Record<string, string>;
  export let onChange: (entries: Record<string, string>) => void;
  // read-only rows shown pinned on top (e.g. headers inherited from the
  // environment); struck through once an own row overrides the same name
  export let inherited: Record<string, string> = {};

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
    {#each rows as row, i}
      <tr>
        <td class:duplicate={duplicateKeys.has(row.key)}>
          <input
            placeholder="name"
            bind:value={row.key}
            on:input={emit}
            title={duplicateKeys.has(row.key) ? 'Duplicate name — only the last value is used' : ''} />
        </td>
        <td><input placeholder="value" bind:value={row.value} on:input={emit} /></td>
        <td class="actions">
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
    width: 34px;
    text-align: center;
  }
  .remove {
    border: none;
    background: none;
    display: flex;
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
