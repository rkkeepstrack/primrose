<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { RunRecord, ApiResponse } from './types';
  import CodeViewer from './CodeViewer.svelte';
  import TabBar from './TabBar.svelte';
  import primroseLogo from '../assets/images/primrose-logo.svg';
  import { sending } from './workspace/state';
  import { fmtElapsed, fmtSize, fmtTime, prettyJson, statusClass } from './format';

  export let runs: RunRecord[];

  type Tab = 'response' | 'headers' | 'timeline';
  type Mode = 'json' | 'raw' | 'image';
  let tab: Tab = 'response';
  let viewedIdx = 0;
  let mode: Mode = 'json';
  let modeTouched = false;

  let lastRuns = runs;
  $: if (runs !== lastRuns) {
    lastRuns = runs;
    viewedIdx = 0; // a new run (or request switch) shows the latest response
    modeTouched = false;
  }

  $: current = runs[viewedIdx] ?? null;

  function autoMode(r: ApiResponse | null): Mode {
    if (!r) return 'raw';
    if (r.contentType?.startsWith('image/')) return 'image';
    if (looksLikeJson(r)) return 'json';
    return 'raw';
  }

  // heuristic: trusts the content type, falls back to attempting a parse
  function looksLikeJson(r: ApiResponse): boolean {
    if (r.contentType?.includes('json')) return true;
    try {
      JSON.parse(r.body);
      return true;
    } catch {
      return false;
    }
  }

  $: if (!modeTouched && current) mode = autoMode(current.response);

  function pickMode(m: Mode) {
    mode = m;
    modeTouched = true;
  }

  // live elapsed timer while a request is in flight; ~50ms keeps the display
  // fluid without excessive redraws
  const TIMER_TICK_MS = 53;
  let elapsedMs = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  $: if ($sending && !timer) {
    const startedAt = Date.now();
    elapsedMs = 0;
    timer = setInterval(() => (elapsedMs = Date.now() - startedAt), TIMER_TICK_MS);
  } else if (!$sending && timer) {
    clearInterval(timer);
    timer = null;
  }
  onDestroy(() => timer && clearInterval(timer));
</script>

<div class="response-pane">
  <TabBar
    tabs={['response', 'headers', 'timeline']}
    active={tab}
    onSelect={(t) => (tab = t as Tab)}
    accent="var(--orange)"
  />

  {#if $sending}
    <div class="loading">
      <img class="spinner" src={primroseLogo} alt="loading" />
      <span class="elapsed">{fmtElapsed(elapsedMs)}</span>
    </div>
  {:else if !current}
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
    {#if current.response?.finalUrl}
      <div class="final-url" title="URL actually requested, after variable resolution">
        → {current.response.finalUrl}
      </div>
    {/if}

    {#if tab === 'response'}
      {#if current.error}
        <pre class="error-body">{current.error}</pre>
      {:else if current.response}
        <div class="mode-switch">
          {#each ['json', 'raw', 'image'] as m}
            <button class:on={mode === m} on:click={() => pickMode(m as Mode)}>{m}</button>
          {/each}
        </div>
        {#if mode === 'image'}
          {#if current.response.bodyBase64}
            <div class="image-wrap">
              <img
                src="data:{current.response.contentType};base64,{current.response.bodyBase64}"
                alt="response body"
              />
            </div>
          {:else}
            <p class="empty">Response is not an image.</p>
          {/if}
        {:else if current.response.bodyBase64}
          <p class="empty">Binary response ({current.response.contentType || 'unknown type'}, {fmtSize(current.response.size)}) — try the image mode.</p>
        {:else if mode === 'json'}
          <CodeViewer value={prettyJson(current.response.body)} lang="json" />
        {:else}
          <CodeViewer value={current.response.body} lang="text" />
        {/if}
      {/if}
    {:else if tab === 'headers'}
      {#if current.response}
        <table class="kv-table headers-table">
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
    height: 100%;
  }

  .status-line {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .status { font-weight: 600; }
  .status.ok { color: var(--green); }
  .status.err { color: var(--red); }
  .status.other { color: var(--orange); }
  .meta { color: var(--text-disabled); font-size: 12px; }
  .final-url {
    color: var(--text-disabled);
    font-size: 12px;
    font-family: var(--mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .old-run {
    color: var(--yellow-text);
    background: var(--yellow-bg);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
  }

  .mode-switch {
    display: flex;
    gap: 4px;
  }
  .mode-switch button {
    border: none;
    background: none;
    font-size: 12px;
    font-family: inherit;
    color: #bbb;
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .mode-switch button.on {
    color: var(--green);
    font-weight: 600;
    background: var(--green-bg);
  }

  .image-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .image-wrap img {
    max-width: 100%;
  }

  .error-body {
    color: var(--red-text);
    font-size: 12.5px;
    font-family: var(--mono);
    white-space: pre-wrap;
    margin: 0;
  }

  .headers-table {
    font-size: 12.5px;
  }
  .headers-table td {
    padding: 6px 10px;
    word-break: break-all;
  }
  .headers-table .hk { font-weight: 600; color: var(--text-muted); width: 220px; }

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
  .timeline button:hover { background: var(--bg-hover); }
  .timeline button.viewing { background: var(--yellow-bg); }

  .empty { color: var(--text-disabled); font-size: 13px; }

  .loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }
  .spinner {
    width: 56px;
    height: 56px;
    animation: primrose-spin 1.6s linear infinite;
  }
  .elapsed {
    font-size: 13px;
    color: #999;
    font-variant-numeric: tabular-nums;
  }
  @keyframes primrose-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
