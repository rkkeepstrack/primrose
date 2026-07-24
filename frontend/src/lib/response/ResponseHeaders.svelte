<script lang="ts">
  export let headers: Record<string, string>;
</script>

<table class="kv-table headers-table">
  <tbody>
    {#each Object.entries(headers) as [k, v] (k)}
      <tr><td class="hk">{k}</td><td>{v}</td></tr>
    {/each}
  </tbody>
</table>

<style>
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
