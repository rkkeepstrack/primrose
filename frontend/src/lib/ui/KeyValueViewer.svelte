<script lang="ts">
  // Read-only key/value table with a section heading (the editable
  // counterpart is KeyValueEditor).
  export let title: string;
  export let entries: Record<string, string>;
  // muted tones down the values (e.g. request headers vs. response headers)
  export let muted = false;
</script>

<h4 class="section">{title}</h4>
<table class="kv-table headers-table" class:muted>
  <tbody>
    {#each Object.entries(entries) as [k, v] (k)}
      <tr><td class="hk">{k}</td><td>{v}</td></tr>
    {/each}
  </tbody>
</table>

<style>
  .section {
    margin: 4px 0 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .headers-table.muted td {
    color: var(--text-faint);
  }
  .headers-table {
    font-size: 12.5px;
  }
  .headers-table td {
    padding: 6px 10px;
    word-break: break-all;
  }
  .headers-table .hk {
    font-weight: 600;
    color: var(--text-muted);
    width: 220px;
  }
</style>
