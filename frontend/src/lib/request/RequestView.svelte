<script lang="ts">
  // The left pane of the detail split: tab bar plus the active panel.
  import KeyValueEditor from '../ui/KeyValueEditor.svelte';
  import TabBar from '../ui/TabBar.svelte';
  import BodyEditor from './BodyEditor.svelte';
  import EnvPanel from './EnvPanel.svelte';
  import TestsEditor from './TestsEditor.svelte';
  import { setHeaders, setQuery } from './requestEdit';
  import { inheritedHeaders, request } from '../workspace/state';

  type Tab = 'query' | 'body' | 'headers' | 'variables' | 'tests';
  const TABS: Tab[] = ['query', 'body', 'headers', 'variables', 'tests'];
  let tab: Tab = 'query';

  // ⌘1–4 switch the first four request tabs (⌘5–7 belong to the response
  // pane, so the tests tab has no shortcut)
  function onKeydown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      e.preventDefault();
      tab = TABS[n - 1];
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $request}
  <TabBar tabs={TABS} active={tab} onSelect={(t) => (tab = t as Tab)} />

  {#if tab === 'query'}
    <KeyValueEditor entries={$request.query} onChange={setQuery} />
  {:else if tab === 'headers'}
    <KeyValueEditor entries={$request.headers} onChange={setHeaders} inherited={$inheritedHeaders} />
    {#if Object.keys($inheritedHeaders).length > 0}
      <p class="inherit-note">Same name overrides an inherited header; an empty value removes it for this request.</p>
    {/if}
  {:else if tab === 'body'}
    <BodyEditor />
  {:else if tab === 'variables'}
    <EnvPanel />
  {:else}
    <TestsEditor />
  {/if}
{/if}

<style>
  .inherit-note {
    color: var(--text-ghost);
    font-size: 12px;
    margin: 0;
  }
</style>
