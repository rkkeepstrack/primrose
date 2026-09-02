<script lang="ts">
  // Status + timing/size metadata of one run, and the resolved final URL.
  import type { RunRecord } from '../shared/types';
  import Popover from '../ui/Popover.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import { fmtSize, fmtTime } from './format';

  export let run: RunRecord;
  export let oldRunLabel = ''; // e.g. "viewing run #3" when not the latest
  export let showUrl = true; // the timeline tab lists URLs itself
  // render-only masking of secret values (identity when no env is active)
  export let mask: (s: string) => string = (s) => s;

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
  {#if hops.length}
    <!-- redirected: one line for where the response came from; the full
         chain (sent request + hops) lives in the hover popup -->
    <Popover trigger="hover" placement="bottom-start">
      <div slot="trigger" class="final-url redirect">↪ {mask(run.response.finalUrl)}</div>
      <div class="chain">
        <div class="pop-row">→ {mask(sentUrl)}</div>
        {#each hops as hop}
          <div class="pop-row hop">↪ {mask(hop)}</div>
        {/each}
      </div>
    </Popover>
  {:else}
    <div class="final-url" title="URL requested, after variable resolution">→ {mask(sentUrl)}</div>
  {/if}
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
  .chain {
    padding: 10px 14px;
    max-width: 80vw;
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
