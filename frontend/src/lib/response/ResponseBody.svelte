<script lang="ts">
  // The response body with its json | raw | image modes; auto-picks the
  // right mode per response, manual override per response.
  import type { ApiResponse } from '../shared/types';
  import CodeViewer from '../editor/CodeViewer.svelte';
  import { fmtSize, prettyJson } from './format';
  import { autoMode, type BodyMode as Mode } from './responseMode';

  export let response: ApiResponse;

  let mode: Mode = 'json';
  let modeTouched = false;

  let lastResponse = response;
  $: if (response !== lastResponse) {
    lastResponse = response;
    modeTouched = false;
  }

  $: if (!modeTouched) mode = autoMode(response);

  function pickMode(m: Mode) {
    mode = m;
    modeTouched = true;
  }
</script>

<div class="mode-switch">
  {#each ['json', 'raw', 'image'] as m}
    <button class:on={mode === m} on:click={() => pickMode(m as Mode)}>{m}</button>
  {/each}
</div>
{#if mode === 'image'}
  {#if response.bodyBase64}
    <div class="image-wrap">
      <img src="data:{response.contentType};base64,{response.bodyBase64}" alt="response body" />
    </div>
  {:else}
    <p class="empty">Response is not an image.</p>
  {/if}
{:else if response.bodyBase64}
  <p class="empty">
    Binary response ({response.contentType || 'unknown type'}, {fmtSize(response.size)}) — try the image mode.
  </p>
{:else if mode === 'json'}
  <CodeViewer value={prettyJson(response.body)} lang="json" />
{:else}
  <CodeViewer value={response.body} lang="text" />
{/if}

<style>
  .mode-switch {
    display: flex;
    gap: 4px;
  }
  .mode-switch button {
    border: none;
    background: none;
    font-size: 12px;
    font-family: inherit;
    color: #bbb;
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .mode-switch button.on {
    color: var(--green);
    font-weight: 600;
    background: var(--green-bg);
  }
  .image-wrap {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .image-wrap img {
    max-width: 100%;
  }
  .empty {
    color: var(--text-disabled);
    font-size: 13px;
  }
</style>
