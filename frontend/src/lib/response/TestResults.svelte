<script lang="ts">
  // One row per assert statement: its source text, pass/fail mark, and the
  // failure message when it failed.
  import type { TestReport } from '../shared/types';

  export let report: TestReport;
</script>

<ul class="results">
  {#each report.results as r, i (i)}
    <li class:fail={!r.ok}>
      <span class="mark">{r.ok ? '✓' : '✗'}</span>
      <div class="detail">
        <code>{r.source}</code>
        {#if !r.ok && r.message}
          <span class="msg">{r.message}</span>
        {/if}
      </div>
    </li>
  {/each}
</ul>

<style>
  .results {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
    overflow-y: auto;
    min-height: 0;
  }
  .results li {
    display: flex;
    gap: 8px;
    align-items: baseline;
    font-size: 12.5px;
  }
  .mark {
    color: var(--green-text);
    font-weight: 600;
  }
  li.fail .mark {
    color: var(--red-text);
  }
  .detail {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  code {
    font-family: var(--mono);
    color: var(--text-soft);
    word-break: break-all;
  }
  .msg {
    color: var(--red-text);
    font-size: 12px;
  }
</style>
