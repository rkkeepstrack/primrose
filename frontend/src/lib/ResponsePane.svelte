<script lang="ts">
  import type { RunRecord } from './types';

  export let runs: RunRecord[];

  type Tab = 'response' | 'headers' | 'timeline';
  let tab: Tab = 'response';
  let viewedIdx = 0;

  let lastRuns = runs;
  $: if (runs !== lastRuns) {
    lastRuns = runs;
    viewedIdx = 0; // a new run (or request switch) shows the latest response
  }

  $: current = runs[viewedIdx] ?? null;

  function pretty(body: string): string {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }

  function statusClass(status: number): string {
    if (status >= 200 && status < 300) return 'ok';
    if (status >= 400) return 'err';
    return 'other';
  }

  function fmtTime(d: Date): string {
    return d.toLocaleTimeString();
  }

  function fmtSize(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }
</script>

<div class="response-pane">
  <nav class="tabs">
    {#each ['response', 'headers', 'timeline'] as t}
      <button class:active={tab === t} on:click={() => (tab = t as Tab)}>
        {t[0].toUpperCase() + t.slice(1)}
      </button>
    {/each}
  </nav>

  {#if !current}
    <p class="empty">Send the request to see the response.</p>
  {:else}
    <div class="status-line">
      {#if current.error}
        <span class="status err">Error</span>
        <span class="meta">{fmtTime(current.at)}</span>
      {:else if current.response}
        <span class="status {statusClass(current.response.status)}">
          {current.response.status} {current.response.statusText}
        </span>
        <span class="meta">{current.response.durationMs} ms · {fmtSize(current.response.size)} · {fmtTime(current.at)}</span>
      {/if}
      {#if viewedIdx > 0}
        <span class="old-run">viewing run #{runs.length - viewedIdx}</span>
      {/if}
    </div>

    {#if tab === 'response'}
      {#if current.error}
        <pre class="body error-body">{current.error}</pre>
      {:else if current.response}
        <pre class="body">{pretty(current.response.body) || '(empty response body)'}</pre>
      {/if}
    {:else if tab === 'headers'}
      {#if current.response}
        <table class="kv">
          <tbody>
            {#each Object.entries(current.response.headers) as [k, v] (k)}
              <tr><td class="hk">{k}</td><td>{v}</td></tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="empty">No response headers (request failed).</p>
      {/if}
    {:else}
      <ul class="timeline">
        {#each runs as run, i}
          <li>
            <button class:viewing={i === viewedIdx} on:click={() => { viewedIdx = i; tab = 'response'; }}>
              {#if run.error}
                <span class="status err">Error</span>
              {:else if run.response}
                <span class="status {statusClass(run.response.status)}">{run.response.status}</span>
                <span class="meta">{run.response.durationMs} ms</span>
              {/if}
              <span class="meta">{fmtTime(run.at)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {/if}
  {/if}
</div>

<style>
  .response-pane {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    min-height: 0;
  }
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
    border-bottom-color: #e0a869;
  }

  .status-line {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .status { font-weight: 600; }
  .status.ok { color: #4caf7d; }
  .status.err { color: #d98282; }
  .status.other { color: #e0a869; }
  .meta { color: #aaa; font-size: 12px; }
  .old-run {
    color: #b8a23f;
    background: #fdf7dc;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
  }

  .body {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
    font-size: 12.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow: auto;
    margin: 0;
    background: #fafafa;
    color: #444;
    flex: 1;
    min-height: 0;
  }
  .error-body { color: #b06a6a; }

  .kv {
    border-collapse: collapse;
    width: 100%;
    font-size: 12.5px;
  }
  .kv td {
    border: 1px solid #e5e5e5;
    padding: 6px 10px;
    color: #444;
    word-break: break-all;
  }
  .kv .hk { font-weight: 600; color: #666; width: 220px; }

  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
  }
  .timeline button {
    display: flex;
    gap: 12px;
    align-items: center;
    width: 100%;
    border: none;
    background: none;
    padding: 7px 8px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
    text-align: left;
  }
  .timeline button:hover { background: #f5f5f5; }
  .timeline button.viewing { background: #fdf7dc; }

  .empty { color: #aaa; font-size: 13px; }
</style>
