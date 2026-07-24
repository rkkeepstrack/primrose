<script lang="ts">
  // Status + timing/size metadata of one run, and the resolved final URL.
  import type { RunRecord } from '../shared/types';
  import StatusBadge from './StatusBadge.svelte';
  import { fmtSize, fmtTime } from './format';

  export let run: RunRecord;
  export let oldRunLabel = ''; // e.g. "viewing run #3" when not the latest
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
{#if run.response?.finalUrl}
  <div class="final-url" title="URL actually requested, after variable resolution">
    → {run.response.finalUrl}
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
  .final-url {
    color: var(--text-disabled);
    font-size: 12px;
    font-family: var(--mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
