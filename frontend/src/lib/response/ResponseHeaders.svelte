<script lang="ts">
  import KeyValueViewer from '../ui/KeyValueViewer.svelte';
  export let headers: Record<string, string>;
  export let requestHeaders: Record<string, string> = {};
</script>

<KeyValueViewer title="Response" entries={headers} />

{#if Object.keys(requestHeaders).length > 0}
  <KeyValueViewer title="Request" entries={requestHeaders} muted />
{/if}
