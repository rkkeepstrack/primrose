<script lang="ts">
  // The response body with its json | raw | image modes; auto-picks the
  // right mode per response, manual override per response.
  import type { ApiResponse } from '../shared/types';
  import ChevronsDownUp from '@lucide/svelte/icons/chevrons-down-up';
  import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
  import Copy from '@lucide/svelte/icons/copy';
  import Check from '@lucide/svelte/icons/check';
  import Popover from '../ui/Popover.svelte';
  import { ClipboardSetText } from '../../../wailsjs/runtime/runtime';
  import CodeViewer from '../editor/CodeViewer.svelte';
  import { fmtSize, prettyJson } from './format';
  import { autoMode, type BodyMode as Mode } from './responseMode';

  export let response: ApiResponse;

  let mode: Mode = 'json';
  let modeTouched = false;

  let viewer: CodeViewer;
  let collapsed = false;

  let lastResponse = response;
  $: if (response !== lastResponse) {
    lastResponse = response;
    modeTouched = false;
    collapsed = false;
  }

  let copied = false;
  // copies the body as displayed: pretty-printed in json mode, raw otherwise
  async function copyBody() {
    await ClipboardSetText(mode === 'json' ? prettyJson(response.body) : response.body);
    copied = true; // the popover dismisses itself and resets the icon
  }

  function toggleFold() {
    collapsed = !collapsed;
    if (collapsed) viewer.collapseAll();
    else viewer.expandAll();
  }

  $: if (!modeTouched) mode = autoMode(response);

  function pickMode(m: Mode) {
    mode = m;
    modeTouched = true;
    // the viewer rebuilds (unfolded) when the mode changes
    collapsed = false;
  }
</script>

<div class="mode-switch">
  {#each ['json', 'raw', 'image'] as m}
    <button class:on={mode === m} on:click={() => pickMode(m as Mode)}>{m}</button>
  {/each}
  {#if mode !== 'image' && !response.bodyBase64}
    <span class="tools">
      {#if mode === 'json'}
        <button class="tool" title={collapsed ? 'Expand all' : 'Collapse all'} on:click={toggleFold}>
          {#if collapsed}<ChevronsUpDown size={14} strokeWidth={2} />{:else}<ChevronsDownUp size={14} strokeWidth={2} />{/if}
        </button>
      {/if}
      <Popover trigger="manual" placement="bottom-end" autoDismissMs={1600} bind:open={copied}>
        <button slot="trigger" class="tool" class:copied title="Copy response body" aria-label="Copy response body" on:click={copyBody}>
          {#if copied}<Check size={14} strokeWidth={2} />{:else}<Copy size={14} strokeWidth={2} />{/if}
        </button>
        <div class="toast">Response copied</div>
      </Popover>
    </span>
  {/if}
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
  <CodeViewer bind:this={viewer} value={prettyJson(response.body)} lang="json" />
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
    color: var(--text-ghost);
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .mode-switch button.on {
    color: var(--green);
    font-weight: 600;
    background: var(--green-bg);
  }
  .tools {
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .tools .tool {
    display: inline-flex;
    align-items: center;
  }
  .tools .tool:hover,
  .tools .tool.copied {
    color: var(--text-soft);
  }
  .toast {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--green-text);
    white-space: nowrap;
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
