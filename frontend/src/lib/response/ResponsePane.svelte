<script lang="ts">
  // The response section: tab bar plus the active panel, tracking which
  // run of the history is being viewed.
  import type { RunRecord } from '../shared/types';
  import TabBar from '../ui/TabBar.svelte';
  import ResponseLoading from './ResponseLoading.svelte';
  import StatusLine from './StatusLine.svelte';
  import ResponseBody from './ResponseBody.svelte';
  import ResponseHeaders from './ResponseHeaders.svelte';
  import Timeline from './Timeline.svelte';
  import { sending } from '../workspace/state';

  export let runs: RunRecord[];

  type Tab = 'response' | 'headers' | 'timeline';
  const TABS: Tab[] = ['response', 'headers', 'timeline'];
  let tab: Tab = 'response';
  let viewedIdx = 0;

  // ⌘5–7 switch the response tabs (⌘1–4 belong to the request pane)
  function onKeydown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const n = Number(e.key);
    if (n >= 5 && n <= 4 + TABS.length) {
      e.preventDefault();
      tab = TABS[n - 5];
    }
  }

  let lastRuns = runs;
  $: if (runs !== lastRuns) {
    lastRuns = runs;
    viewedIdx = 0; // a new run (or request switch) shows the latest response
  }

  $: current = runs[viewedIdx] ?? null;
</script>

<svelte:window on:keydown={onKeydown} />

<div class="response-pane">
  <TabBar
    tabs={TABS}
    active={tab}
    onSelect={(t) => (tab = t as Tab)}
    accent="var(--orange)"
  />

  {#if $sending}
    <ResponseLoading />
  {:else if !current}
    <p class="empty">Send the request to see the response.</p>
  {:else}
    <StatusLine
      run={current}
      oldRunLabel={viewedIdx > 0 ? `viewing run #${runs.length - viewedIdx}` : ''}
    />

    {#if tab === 'response'}
      {#if current.error}
        <pre class="error-body">{current.error}</pre>
      {:else if current.response}
        <ResponseBody response={current.response} />
      {/if}
    {:else if tab === 'headers'}
      {#if current.response}
        <ResponseHeaders headers={current.response.headers} />
      {:else}
        <p class="empty">No response headers (request failed).</p>
      {/if}
    {:else}
      <Timeline {runs} {viewedIdx} onView={(i) => { viewedIdx = i; tab = 'response'; }} />
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
  .error-body {
    color: var(--red-text);
    font-size: 12.5px;
    font-family: var(--mono);
    white-space: pre-wrap;
    margin: 0;
  }
  .empty {
    color: var(--text-disabled);
    font-size: 13px;
  }
</style>
