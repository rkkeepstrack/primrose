<script lang="ts">
  // Status + timing/size metadata of one run, and the resolved final URL.
  import type { RunRecord } from '../shared/types';
  import StatusBadge from './StatusBadge.svelte';
  import { fmtSize, fmtTime } from './format';

  export let run: RunRecord;
  export let oldRunLabel = ''; // e.g. "viewing run #3" when not the latest
  export let showUrl = true; // the timeline tab lists URLs itself

  $: sentUrl = run.response?.requestUrl ?? run.response?.finalUrl;
  $: hops = run.response?.redirects ?? [];
</script>

<div class="status-line">
  {#if run.error}
    <StatusBadge text={run.error === 'Canceled' ? 'Canceled' : 'Error'} />
    <span class="meta">{fmtTime(run.at)}</span>
  {:else if run.response}
    <StatusBadge status={run.response.status} text={run.response.statusText} />
    <span class="meta">
      {run.response.durationMs} ms · {fmtSize(run.response.size)} · {fmtTime(run.at)}
    </span>
  {/if}
  {#if oldRunLabel}
    <span class="old-run">{oldRunLabel}</span>
  {/if}
</div>
{#if showUrl && sentUrl && run.response}
  <div class="url-wrap">
    {#if hops.length}
      <!-- redirected: one line for where the response came from; the full
           chain (sent request + hops) lives in the hover popup -->
      <div class="final-url redirect">↪ {run.response.finalUrl}</div>
      <div class="url-pop">
        <div class="pop-row">→ {sentUrl}</div>
        {#each hops as hop}
          <div class="pop-row hop">↪ {hop}</div>
        {/each}
      </div>
    {:else}
      <div class="final-url" title="URL requested, after variable resolution">→ {sentUrl}</div>
    {/if}
  </div>
{/if}

<style>
  .status-line {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
  }
  .meta {
    color: var(--text-disabled);
    font-size: 12px;
  }
  .old-run {
    color: var(--yellow-text);
    background: var(--yellow-bg);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
  }
  .url-wrap {
    position: relative;
  }
  .url-pop {
    display: none;
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    max-width: 100%;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    padding: 6px 10px;
    z-index: 30;
  }
  .url-wrap:hover .url-pop {
    display: block;
  }
  .pop-row {
    font-size: 11.5px;
    font-family: var(--mono);
    color: var(--text-soft);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 1px 0;
  }
  .pop-row.hop {
    color: var(--orange-strong);
    padding-left: 10px;
  }
  .final-url.redirect {
    color: var(--orange-strong);
    opacity: 0.75;
    cursor: default;
  }
  .final-url {
    color: var(--text-disabled);
    font-size: 12px;
    font-family: var(--mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
