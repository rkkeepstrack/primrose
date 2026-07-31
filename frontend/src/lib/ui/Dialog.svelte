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
    if (e.key === 'Escape') {
      e.preventDefault(); // unhandled Escape would beep (native responder chain)
      close($dialog.kind === 'prompt' ? null : false);
    }
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
    background: var(--bg);
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
    color: var(--text);
    line-height: 1.45;
  }
  .input {
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 7px 12px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text);
  }
  .input:focus {
    outline: none;
    border-color: var(--yellow-border);
    background: var(--yellow-bg-light);
  }
  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .btn {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    font-size: 13px;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px 16px;
  }
  .btn:hover {
    background: var(--bg-lift);
  }
  .btn.primary {
    border: none;
    background: var(--green);
    color: var(--text-on-accent);
    font-weight: 500;
  }
  .btn.primary:hover {
    background: var(--green-dark);
  }
  .btn.primary.danger {
    background: var(--red);
  }
  .btn.primary.danger:hover {
    background: var(--red-dark);
  }
  .btn.discard {
    border: none;
    background: var(--red);
    color: var(--text-on-accent);
    font-weight: 500;
  }
  .btn.discard:hover {
    background: var(--red-dark);
  }
  .btn.keep {
    border: 1px solid var(--yellow-border);
    background: var(--yellow-bg);
    color: var(--text);
    font-weight: 500;
  }
  .btn.keep:hover {
    background: var(--yellow-bg-strong);
  }
</style>
