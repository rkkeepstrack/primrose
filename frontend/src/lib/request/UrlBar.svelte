<script lang="ts">
  // Full-width request toolbar: method picker, URL editor, Save/Send/Cancel,
  // draft-name row, and the ⌘S / ⌘↵ shortcuts.
  import { METHODS } from '../shared/types';
  import CodeEditor from '../editor/CodeEditor.svelte';
  import { setMethod, setUrl } from './requestEdit';
  import { saveRequest } from '../workspace/requests';
  import { cancelRequest, sendRequest } from '../workspace/send';
  import { keepMyEdits, reloadFromDisk } from '../workspace/sync';
  import { dirty, diskChanged, draftName, request, sending } from '../workspace/state';

  let methodOpen = false;

  function pickMethod(m: string) {
    methodOpen = false;
    setMethod(m);
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      saveRequest();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      sendRequest();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $request}
  {#if $diskChanged}
    <div class="disk-notice">
      <span>This request changed on disk while you have unsaved edits.</span>
      <button class="notice-btn" on:click={reloadFromDisk}>Load disk version</button>
      <button class="notice-btn keep" on:click={keepMyEdits}>Keep my edits</button>
    </div>
  {/if}
  {#if $draftName !== null}
    <div class="draft-row">
      <span class="draft-label">New request</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input
        class="draft-name text-input"
        placeholder="request name…"
        value={$draftName}
        autofocus
        on:input={(e) => draftName.set(e.currentTarget.value)}
        on:keydown={(e) => e.key === 'Enter' && saveRequest()}
      />
      <span class="draft-hint">saved as {$draftName || 'name'}.toml on Save</span>
    </div>
  {/if}
  <div class="url-row">
    <div class="url-bar">
      <div class="method-wrap">
        <button class="method method-{$request.method}" on:click={() => (methodOpen = !methodOpen)}>
          {$request.method}
        </button>
        {#if methodOpen}
          <div class="method-popup">
            {#each METHODS as m}
              <button class="method method-{m}" on:click={() => pickMethod(m)}>{m}</button>
            {/each}
          </div>
        {/if}
      </div>
      <CodeEditor
        singleLine
        value={$request.url}
        placeholder="https://api.example.com/…"
        onChange={setUrl}
      />
    </div>
    <button class="action save" class:dirty={$dirty} on:click={saveRequest} title="⌘S">
      Save{$dirty ? ' •' : ''}
    </button>
    {#if $sending}
      <button class="action cancel" on:click={cancelRequest}>Cancel</button>
    {:else}
      <button class="action send" on:click={sendRequest} title="⌘↵">Send</button>
    {/if}
  </div>
{/if}

<style>
  .disk-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    color: var(--yellow-text);
    background: var(--yellow-bg);
    border: 1px solid var(--yellow-border);
    border-radius: 6px;
    padding: 6px 12px;
  }
  .notice-btn {
    border: 1px solid var(--yellow-border);
    border-radius: 5px;
    background: #fff;
    font-size: 12px;
    font-family: inherit;
    color: var(--text);
    cursor: pointer;
    padding: 3px 10px;
  }
  .notice-btn:hover { background: var(--yellow-bg-light); }
  .notice-btn.keep { margin-left: auto; }

  .draft-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .draft-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--yellow-text);
    background: var(--yellow-bg);
    border-radius: 4px;
    padding: 3px 8px;
  }
  .draft-name {
    border-color: var(--yellow-border);
    width: 240px;
  }
  .draft-name:focus { background: var(--yellow-bg-light); }
  .draft-hint { font-size: 12px; color: #bbb; }

  .url-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .url-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 4px 6px;
    font-size: 13px;
    background: var(--bg-soft);
    flex: 1;
    min-width: 0;
  }
  .method-wrap { position: relative; }
  button.method {
    border: none;
    background: none;
    font-weight: 600;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    padding: 5px 8px;
    border-radius: 5px;
  }
  button.method:hover { background: #f0ead2; }
  .method-popup {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    padding: 4px;
    z-index: 10;
  }
  .method-popup button { text-align: left; }

  .action {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0 16px;
  }
  .action:hover { background: #f7f7f7; }
  .action.save.dirty {
    border-color: var(--yellow-border);
    background: var(--yellow-bg);
    color: var(--text);
  }
  .action.send {
    border: none;
    background: var(--green);
    color: #fff;
    font-weight: 500;
    padding: 0 20px;
    transition: background 0.1s ease;
  }
  .action.send:hover { background: var(--green-dark); }
  .action.send:active { background: var(--green-darker); }
  .action.cancel {
    border: none;
    background: var(--red);
    color: #fff;
    font-weight: 500;
    padding: 0 16px;
    transition: background 0.1s ease;
  }
  .action.cancel:hover { background: var(--red-dark); }
</style>
