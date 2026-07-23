<script lang="ts">
  import type { ApiRequest } from './types';
  import { METHODS } from './types';
  import KeyValueEditor from './KeyValueEditor.svelte';

  export let request: ApiRequest;
  export let dirty = false;
  export let sending = false;
  export let onSave: () => void;
  export let onSend: () => void;

  type Tab = 'query' | 'body' | 'headers' | 'env';
  let tab: Tab = 'query';
  let methodOpen = false;

  // horizontal split between request tabs (left) and response section (right)
  let panesEl: HTMLDivElement;
  let splitPct = 50;

  function startDrag(e: MouseEvent) {
    e.preventDefault();
    const rect = panesEl.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const pct = ((ev.clientX - rect.left) / rect.width) * 100;
      splitPct = Math.min(80, Math.max(20, pct));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function markDirty() {
    dirty = true;
  }

  function pickMethod(m: string) {
    request.method = m;
    methodOpen = false;
    markDirty();
  }

  function setQuery(q: Record<string, string>) {
    request.query = q;
    markDirty();
  }

  function setHeaders(h: Record<string, string>) {
    request.headers = h;
    markDirty();
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      onSave();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      onSend();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="request-view">
  <div class="url-row">
    <div class="url-bar">
      <div class="method-wrap">
        <button class="method method-{request.method}" on:click={() => (methodOpen = !methodOpen)}>
          {request.method}
        </button>
        {#if methodOpen}
          <div class="method-popup">
            {#each METHODS as m}
              <button class="method method-{m}" on:click={() => pickMethod(m)}>{m}</button>
            {/each}
          </div>
        {/if}
      </div>
      <input
        class="url"
        bind:value={request.url}
        on:input={markDirty}
        placeholder="https://api.example.com/…"
        spellcheck="false"
      />
    </div>
    <button class="action save" class:dirty on:click={onSave} title="⌘S">
      Save{dirty ? ' •' : ''}
    </button>
    <button class="action send" disabled={sending} on:click={onSend} title="⌘↵">
      {sending ? 'Sending…' : 'Send'}
    </button>
  </div>

  <div class="panes" bind:this={panesEl}>
    <div class="pane request-pane" style="width: {splitPct}%">
      <nav class="tabs">
        {#each ['query', 'body', 'headers', 'env'] as t}
          <button class:active={tab === t} on:click={() => (tab = t as Tab)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        {/each}
      </nav>

      {#if tab === 'query'}
        <KeyValueEditor entries={request.query} onChange={setQuery} />
      {:else if tab === 'headers'}
        <KeyValueEditor entries={request.headers} onChange={setHeaders} />
      {:else if tab === 'body'}
        <div class="body-switch">
          <button class:on={request.body.type === 'json'} on:click={() => { request.body.type = 'json'; markDirty(); }}>json</button>
          <span class="sep">|</span>
          <button class:on={request.body.type === 'text'} on:click={() => { request.body.type = 'text'; markDirty(); }}>text</button>
        </div>
        <textarea
          class="body-content"
          bind:value={request.body.content}
          on:input={markDirty}
          placeholder="Enter text here…"
          spellcheck="false"
        ></textarea>
      {:else}
        <p class="empty">Environment variables in this call — coming in milestone 3.</p>
      {/if}
    </div>

    <div class="divider" role="separator" aria-orientation="vertical" on:mousedown={startDrag}></div>

    <div class="pane response-pane-wrap">
      <slot />
    </div>
  </div>
</div>

<style>
  .request-view {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    min-height: 0;
    height: 100%;
  }
  .panes {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .pane {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
  }
  .response-pane-wrap {
    flex: 1;
  }
  .divider {
    flex-shrink: 0;
    width: 5px;
    margin: 0 10px;
    cursor: col-resize;
    border-left: 1px solid #e5e5e5;
  }
  .divider:hover {
    border-left-color: #ecdfa8;
  }
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
    background: #fafafa;
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
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    padding: 4px;
    z-index: 10;
  }
  .method-popup button { text-align: left; }
  .method-GET { color: #4caf7d; }
  .method-POST { color: #6b9fdb; }
  .method-PUT { color: #e0a869; }
  .method-PATCH { color: #c9a86b; }
  .method-DELETE { color: #d98282; }
  .method-HEAD, .method-OPTIONS { color: #999; }

  input.url {
    flex: 1;
    min-width: 0;
    border: none;
    background: transparent;
    font-size: 13px;
    font-family: inherit;
    color: #444;
    padding: 5px 4px;
  }
  input.url:focus { outline: none; }

  .action {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    background: #fff;
    font-size: 13px;
    font-family: inherit;
    color: #666;
    cursor: pointer;
    padding: 0 16px;
  }
  .action:hover { background: #f7f7f7; }
  .action.save.dirty {
    border-color: #ecdfa8;
    background: #fdf7dc;
    color: #333;
  }
  .action.send {
    border: none;
    background: #4caf7d;
    color: #fff;
    font-weight: 500;
    padding: 0 20px;
    transition: background 0.1s ease;
  }
  .action.send:hover { background: #429e70; }
  .action.send:active { background: #3a8d63; }
  .action.send:disabled { opacity: 0.6; cursor: default; }

  .tabs {
    display: flex;
    gap: 18px;
    border-bottom: 1px solid #eee;
  }
  .tabs button {
    border: none;
    background: none;
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 6px 2px;
    color: #888;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .tabs button.active {
    color: #333;
    border-bottom-color: #4caf7d;
  }

  .body-switch {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #bbb;
  }
  .body-switch button {
    border: none;
    background: none;
    font-size: 13px;
    font-family: inherit;
    color: #bbb;
    cursor: pointer;
    padding: 2px 4px;
  }
  .body-switch button.on { color: #4caf7d; font-weight: 600; }
  .body-content {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 12px;
    min-height: 220px;
    font-size: 12.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: #fafafa;
    color: #444;
    resize: vertical;
  }
  .body-content:focus { outline: none; border-color: #ecdfa8; background: #fff; }
  .empty { color: #aaa; font-size: 13px; }
</style>
