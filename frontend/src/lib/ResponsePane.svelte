<script lang="ts">
  import type { RunRecord, ApiResponse } from './types';
  import CodeViewer from './CodeViewer.svelte';
  import primroseLogo from '../assets/images/primrose-logo.svg';

  import { onDestroy } from 'svelte';

  export let runs: RunRecord[];
  export let sending = false;

  // live elapsed timer while a request is in flight
  let elapsedMs = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  $: if (sending && !timer) {
    const startedAt = Date.now();
    elapsedMs = 0;
    timer = setInterval(() => (elapsedMs = Date.now() - startedAt), 53);
  } else if (!sending && timer) {
    clearInterval(timer);
    timer = null;
  }
  onDestroy(() => timer && clearInterval(timer));

  function fmtElapsed(ms: number): string {
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }

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
    if (isJson(r)) return 'json';
    return 'raw';
  }

  function isJson(r: ApiResponse): boolean {
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

  {#if sending}
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
          <CodeViewer value={pretty(current.response.body)} lang="json" />
        {:else}
          <CodeViewer value={current.response.body} lang="text" />
        {/if}
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
    height: 100%;
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
  .final-url {
    color: #aaa;
    font-size: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .old-run {
    color: #b8a23f;
    background: #fdf7dc;
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
    color: #4caf7d;
    font-weight: 600;
    background: #f4faf6;
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
    color: #b06a6a;
    font-size: 12.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    white-space: pre-wrap;
    margin: 0;
  }

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

  .loading {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }
  .elapsed {
    font-size: 13px;
    color: #999;
    font-variant-numeric: tabular-nums;
  }
  .spinner {
    width: 56px;
    height: 56px;
    animation: primrose-spin 1.6s linear infinite;
  }
  @keyframes primrose-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
</style>
