<script lang="ts">
  // Session run history: click an entry to view that response.
  import type { RunRecord } from '../shared/types';
  import StatusBadge from './StatusBadge.svelte';
  import { fmtTime } from './format';

  export let runs: RunRecord[];
  export let viewedIdx: number;
  export let onView: (idx: number) => void;
</script>

<ul class="timeline">
  {#each runs as run, i}
    <li>
      <button class:viewing={i === viewedIdx} on:click={() => onView(i)}>
        <span class="row-line">
          {#if run.error}
            <StatusBadge text={run.error === 'Canceled' ? 'Canceled' : 'Error'} />
          {:else if run.response}
            <StatusBadge status={run.response.status} />
            <span class="meta">{run.response.durationMs} ms</span>
          {/if}
          <span class="meta">{fmtTime(run.at)}</span>
        </span>
        {#if run.response?.finalUrl}
          <span class="row-url">→ {run.response.finalUrl}</span>
        {/if}
      </button>
    </li>
  {/each}
</ul>

<style>
  .timeline {
    list-style: none;
    margin: 0;
    padding: 0;
    overflow-y: auto;
  }
  .timeline button {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 2px;
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
  .timeline button:hover {
    background: var(--bg-hover);
  }
  .timeline button.viewing {
    background: var(--yellow-bg);
  }
  .meta {
    color: var(--text-disabled);
    font-size: 12px;
  }
  .row-line {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  .row-url {
    color: var(--text-disabled);
    font-size: 11.5px;
    font-family: var(--mono);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
