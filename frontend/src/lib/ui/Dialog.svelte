<script lang="ts">
  import { dialog } from './dialogs';

  let value = '';
  let lastState: unknown = null;

  $: if ($dialog !== lastState) {
    lastState = $dialog;
    value = $dialog?.initial ?? '';
  }

  function close(result: string | boolean | null) {
    $dialog?.resolve(result);
    dialog.set(null);
  }

  function onKeydown(e: KeyboardEvent) {
    if (!$dialog) return;
    if (e.key === 'Escape') close($dialog.kind === 'prompt' ? null : false);
    // Enter keeps editing on discard dialogs — losing work needs a click
    if (e.key === 'Enter') close($dialog.kind === 'prompt' ? value : $dialog.kind !== 'discard');
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if $dialog}
  <!-- clicking the backdrop (but not the dialog itself) dismisses -->
  <div
    class="backdrop"
    role="presentation"
    on:click={(e) => e.target === e.currentTarget && close($dialog.kind === 'prompt' ? null : false)}>
    <div class="dialog" role="dialog" aria-modal="true" tabindex="-1">
      <p class="message">{$dialog.message}</p>
      {#if $dialog.kind === 'prompt'}
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" bind:value autofocus spellcheck="false" />
      {/if}
      <div class="buttons">
        {#if $dialog.kind === 'discard'}
          <button class="btn discard" on:click={() => close(true)}>Discard</button>
          <button class="btn keep" on:click={() => close(false)}>Keep editing</button>
        {:else}
          <button class="btn" on:click={() => close($dialog.kind === 'prompt' ? null : false)}> Cancel </button>
          {#if $dialog.kind === 'prompt'}
            <button class="btn primary" on:click={() => close(value)}>OK</button>
          {:else}
            <button class="btn primary" class:danger={$dialog.danger} on:click={() => close(true)}>
              {$dialog.danger ? 'Delete' : 'OK'}
            </button>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.18);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 18vh;
    z-index: 100;
  }
  .dialog {
    background: #fff;
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
    padding: 18px 20px;
    min-width: 320px;
    max-width: 440px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .message {
    margin: 0;
    font-size: 13.5px;
    color: #333;
    line-height: 1.45;
  }
  .input {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 7px 12px;
    font-size: 13px;
    font-family: inherit;
    color: #333;
  }
  .input:focus {
    outline: none;
    border-color: #ecdfa8;
    background: #fffdf2;
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .btn {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fff;
    font-size: 13px;
    font-family: inherit;
    color: #666;
    cursor: pointer;
    padding: 6px 16px;
  }
  .btn:hover {
    background: #f7f7f7;
  }
  .btn.primary {
    border: none;
    background: #4caf7d;
    color: #fff;
    font-weight: 500;
  }
  .btn.primary:hover {
    background: #429e70;
  }
  .btn.primary.danger {
    background: #d98282;
  }
  .btn.primary.danger:hover {
    background: #c96f6f;
  }
  .btn.discard {
    border: none;
    background: #d98282;
    color: #fff;
    font-weight: 500;
  }
  .btn.discard:hover {
    background: #c96f6f;
  }
  .btn.keep {
    border: 1px solid var(--yellow-border);
    background: var(--yellow-bg);
    color: var(--text);
    font-weight: 500;
  }
  .btn.keep:hover {
    background: #f8efc7;
  }
</style>
