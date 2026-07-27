<script lang="ts">
  export let headers: Record<string, string>;
  export let requestHeaders: Record<string, string> = {};
</script>

<h4 class="section">Response</h4>
<table class="kv-table headers-table">
  <tbody>
    {#each Object.entries(headers) as [k, v] (k)}
      <tr><td class="hk">{k}</td><td>{v}</td></tr>
    {/each}
  </tbody>
</table>

{#if Object.keys(requestHeaders).length > 0}
  <h4 class="section">Request</h4>
  <table class="kv-table headers-table request">
    <tbody>
      {#each Object.entries(requestHeaders) as [k, v] (k)}
        <tr><td class="hk">{k}</td><td>{v}</td></tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .section {
    margin: 4px 0 0;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-faint);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .headers-table.request td {
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
