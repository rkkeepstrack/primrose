<script lang="ts">
  import type { ApiRequest } from './types';

  export let request: ApiRequest;
  export let name: string;

  type Tab = 'query' | 'body' | 'headers' | 'env';
  let tab: Tab = 'query';

  $: queryRows = Object.entries(request.query);
  $: headerRows = Object.entries(request.headers);
</script>

<div class="request-view">
  <div class="url-bar">
    <span class="method method-{request.method}">{request.method}</span>
    <span class="url">{request.url}</span>
  </div>

  <nav class="tabs">
    {#each ['query', 'body', 'headers', 'env'] as t}
      <button class:active={tab === t} on:click={() => (tab = t as Tab)}>
        {t[0].toUpperCase() + t.slice(1)}
      </button>
    {/each}
  </nav>

  {#if tab === 'query' || tab === 'headers'}
    {@const rows = tab === 'query' ? queryRows : headerRows}
    <table class="kv">
      <thead><tr><th>Name</th><th>Value</th></tr></thead>
      <tbody>
        {#each rows as [k, v] (k)}
          <tr><td>{k}</td><td>{v}</td></tr>
        {:else}
          <tr><td colspan="2" class="empty">No {tab === 'query' ? 'query parameters' : 'headers'}</td></tr>
        {/each}
      </tbody>
    </table>
  {:else if tab === 'body'}
    <div class="body-switch">
      <span class:on={request.body.type === 'json'}>json</span>
      <span class="sep">|</span>
      <span class:on={request.body.type === 'text'}>text</span>
    </div>
    <pre class="body-content">{request.body.content || '(empty body)'}</pre>
  {:else}
    <p class="empty">Environment variables in this call — coming in milestone 3.</p>
  {/if}
</div>

<style>
  .request-view {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }
  .url-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 9px 12px;
    font-size: 13px;
    overflow-x: auto;
    background: #fafafa;
  }
  .method { font-weight: 600; font-size: 12px; }
  .method-GET { color: #4caf7d; }
  .method-POST { color: #6b9fdb; }
  .method-PUT { color: #e0a869; }
  .method-DELETE { color: #d98282; }
  .url { white-space: nowrap; color: #444; }

  .tabs {
    display: flex;
    gap: 18px;
    border-bottom: 1px solid #eee;
  }
  .tabs button {
    border: none;
    background: none;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 6px 2px;
    color: #888;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .tabs button.active {
    color: #333;
    border-bottom-color: #4caf7d;
  }

  .kv {
    border-collapse: collapse;
    width: 100%;
    max-width: 560px;
    font-size: 13px;
  }
  .kv th, .kv td {
    border: 1px solid #e5e5e5;
    padding: 7px 12px;
    text-align: left;
  }
  .kv th { font-weight: 600; color: #666; background: #fafafa; }
  .kv td { color: #444; }

  .body-switch { font-size: 13px; color: #bbb; }
  .body-switch .sep { margin: 0 4px; }
  .body-switch .on { color: #4caf7d; font-weight: 600; }
  .body-content {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
    min-height: 200px;
    font-size: 12.5px;
    overflow: auto;
    margin: 0;
    background: #fafafa;
    color: #444;
  }
  .empty { color: #aaa; font-size: 13px; }
</style>
