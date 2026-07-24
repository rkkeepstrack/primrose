<script lang="ts">
  // The left pane of the detail split: tab bar plus the active panel.
  import KeyValueEditor from '../ui/KeyValueEditor.svelte';
  import TabBar from '../ui/TabBar.svelte';
  import BodyEditor from './BodyEditor.svelte';
  import EnvPanel from './EnvPanel.svelte';
  import { setHeaders, setQuery } from './requestEdit';
  import { request } from '../workspace/state';

  type Tab = 'query' | 'body' | 'headers' | 'variables';
  const TABS: Tab[] = ['query', 'body', 'headers', 'variables'];
  let tab: Tab = 'query';

  // ⌘1–4 switch the request tabs (⌘5–7 belong to the response pane)
  function onKeydown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= TABS.length) {
      e.preventDefault();
      tab = TABS[n - 1];
    }
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $request}
  <TabBar
    tabs={TABS}
    active={tab}
    onSelect={(t) => (tab = t as Tab)}
  />

  {#if tab === 'query'}
    <KeyValueEditor entries={$request.query} onChange={setQuery} />
  {:else if tab === 'headers'}
    <KeyValueEditor entries={$request.headers} onChange={setHeaders} />
  {:else if tab === 'body'}
    <BodyEditor />
  {:else}
    <EnvPanel />
  {/if}
{/if}
