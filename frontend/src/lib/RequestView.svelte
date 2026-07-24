<script lang="ts">
  // The left pane of the detail split: tab bar plus the active panel.
  import KeyValueEditor from './KeyValueEditor.svelte';
  import TabBar from './TabBar.svelte';
  import BodyEditor from './BodyEditor.svelte';
  import EnvPanel from './EnvPanel.svelte';
  import { setHeaders, setQuery } from './requestEdit';
  import { request } from './workspace/state';

  type Tab = 'query' | 'body' | 'headers' | 'env';
  let tab: Tab = 'query';
</script>

{#if $request}
  <TabBar
    tabs={['query', 'body', 'headers', 'env']}
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
