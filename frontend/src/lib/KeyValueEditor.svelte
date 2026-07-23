<script lang="ts">
  export let entries: Record<string, string>;
  export let onChange: (entries: Record<string, string>) => void;

  // Local row model so keys can be edited without map-key collisions.
  type Row = { key: string; value: string };
  let rows: Row[] = toRows(entries);
  let lastEntries = entries;

  // Re-sync only when the parent hands us a different object (request switch).
  $: if (entries !== lastEntries) {
    lastEntries = entries;
    rows = toRows(entries);
  }

  function toRows(e: Record<string, string>): Row[] {
    return Object.entries(e).map(([key, value]) => ({ key, value }));
  }

  function emit() {
    const out: Record<string, string> = {};
    for (const r of rows) {
      if (r.key.trim() !== '') out[r.key] = r.value;
    }
    lastEntries = out;
    onChange(out);
  }

  function addRow() {
    rows = [...rows, { key: '', value: '' }];
  }

  function removeRow(i: number) {
    rows = rows.filter((_, idx) => idx !== i);
    emit();
  }
</script>

<table class="kv">
  <thead><tr><th>Name</th><th>Value</th><th></th></tr></thead>
  <tbody>
    {#each rows as row, i}
      <tr>
        <td><input placeholder="name" bind:value={row.key} on:input={emit} /></td>
        <td><input placeholder="value" bind:value={row.value} on:input={emit} /></td>
        <td class="actions">
          <button class="remove" title="Remove" on:click={() => removeRow(i)}>×</button>
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
  .kv {
    border-collapse: collapse;
    width: 100%;
    max-width: 620px;
    font-size: 13px;
  }
  th, td {
    border: 1px solid #e5e5e5;
    padding: 0;
    text-align: left;
  }
  th {
    font-weight: 600;
    color: #666;
    background: #fafafa;
    padding: 7px 12px;
  }
  td input {
    width: 100%;
    box-sizing: border-box;
    border: none;
    padding: 7px 12px;
    font-size: 13px;
    font-family: inherit;
    color: #444;
    background: transparent;
  }
  td input:focus {
    outline: none;
    background: #fdf7dc;
  }
  td.actions {
    width: 34px;
    text-align: center;
  }
  .remove {
    border: none;
    background: none;
    color: #ccc;
    font-size: 15px;
    cursor: pointer;
    padding: 4px 10px;
  }
  .remove:hover { color: #d98282; }
  .add {
    border: none;
    background: none;
    color: #999;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    padding: 6px 12px;
  }
  .add:hover { color: #4caf7d; }
</style>
