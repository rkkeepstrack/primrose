<script lang="ts">
  // Hover card for a {{var}} token: the active environment's value plus a
  // copy button. Mounted into CodeMirror's hover-tooltip slot by CodeEditor;
  // CM owns positioning, the card look comes from the global .popover-card.
  import Check from '@lucide/svelte/icons/check';
  import Copy from '@lucide/svelte/icons/copy';
  import { ClipboardSetText } from '../../../wailsjs/runtime/runtime';

  export let value: string | undefined;

  let copied = false; // stays a checkmark for the lifetime of this tooltip

  function copy() {
    if (value === undefined) return;
    ClipboardSetText(value);
    copied = true;
  }
</script>

<div class="var-tooltip popover-card" class:missing={value === undefined}>
  {#if value === undefined}
    <span>not set in the active environment</span>
  {:else}
    <span class="value">{value}</span>
    <button type="button" title="Copy value" class:copied on:click={copy}>
      {#if copied}
        <Check size={12} strokeWidth={2} />
      {:else}
        <Copy size={12} strokeWidth={2} />
      {/if}
    </button>
  {/if}
</div>

<style>
  .var-tooltip {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 4px 9px;
    font-family: var(--sans);
    font-size: 12px;
    color: var(--text-soft);
    max-width: 420px;
  }
  .var-tooltip.missing {
    color: var(--orange-strong);
    font-style: italic;
  }
  .value {
    overflow-wrap: anywhere;
  }
  button {
    display: flex;
    align-items: center;
    border: none;
    background: none;
    color: #999;
    cursor: pointer;
    padding: 2px;
    border-radius: 4px;
  }
  button:hover {
    color: var(--green);
    background: var(--green-bg);
  }
  button.copied {
    color: var(--green);
  }
</style>
