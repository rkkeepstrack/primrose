<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './lib/sidebar/Sidebar.svelte';
  import UrlBar from './lib/request/UrlBar.svelte';
  import SplitPane from './lib/ui/SplitPane.svelte';
  import RequestView from './lib/request/RequestView.svelte';
  import ResponsePane from './lib/response/ResponsePane.svelte';
  import EnvironmentEditor from './lib/environments/EnvironmentEditor.svelte';
  import Dialog from './lib/ui/Dialog.svelte';
  import primroseLogo from './assets/images/primrose-logo.svg';
  import { openCollectionViaDialog, switchCollection } from './lib/workspace/collections';
  import { runs } from './lib/workspace/drafts';
  import { pickEnvironment, saveEnvVars } from './lib/workspace/environments';
  import { persistSession, restoreSession } from './lib/workspace/session';
  import { initExternalSync } from './lib/workspace/sync';
  import ShortcutsPanel from './lib/shortcuts/ShortcutsPanel.svelte';
  import { shortcutsView } from './lib/workspace/state';
  import { closeRequest } from './lib/workspace/requests';
  import { closeEnvView, createEnvironment } from './lib/workspace/environments';
  import { dialog } from './lib/ui/dialogs';
  import { activeEnvName, activeIdx, collections, envView, envs, error, request, restored } from './lib/workspace/state';

  onMount(() => {
    initExternalSync();
    restoreSession();
  });

  function onGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      (async () => {
        if ($envView && !(await closeEnvView())) return;
        shortcutsView.update((v) => !v);
      })();
      return;
    }
    if (e.key === 'Escape') {
      if ($dialog) return; // the dialog owns Escape while open
      const t = e.target as HTMLElement;
      // first Esc leaves the field you're typing in; the next one closes
      if (t.closest('.cm-editor')) {
        (t.closest('.cm-editor')?.querySelector('.cm-content') as HTMLElement)?.blur();
        return;
      }
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return; // inputs handle their own Esc
      closeRequest();
    }
  }

  // persist open collections + active tab whenever they change
  $: if ($restored && $collections && $activeIdx >= 0) persistSession();
</script>

<svelte:window on:keydown={onGlobalKeydown} />

<div class="app">
  <div class="titlebar">
    <div class="brand">
      <img class="brand-logo" src={primroseLogo} alt="" />
      <span class="brand-name">Primrose</span>
    </div>
  </div>
  <header class="collection-tabs">
    {#each $collections as col, i (col.root)}
      <button class="col-tab" class:active={i === $activeIdx} on:click={() => switchCollection(i)}>
        {col.name}
      </button>
    {/each}
    <button class="col-tab open-btn" on:click={openCollectionViaDialog}>+ Open Collection</button>
    {#if $envView}
      <button class="col-tab env-tab active" on:click={closeEnvView}>
        Environment ×
      </button>
    {/if}
    {#if $shortcutsView}
      <button class="col-tab shortcuts-tab" on:click={() => shortcutsView.set(false)}>
        Shortcuts ×
      </button>
    {/if}
  </header>

  {#if $error}
    <div class="error">{$error}</div>
  {/if}

  {#if !$restored}
    <!-- restoring saved collections; render nothing to avoid a splash flicker -->
    <div class="empty-state"></div>
  {:else if $collections.length === 0}
    <div class="empty-state">
      <img class="splash-logo" src={primroseLogo} alt="" />
      <h1>Primrose</h1>
      <p>Open a collection folder to get started.</p>
      <button class="primary" on:click={openCollectionViaDialog}>Open Collection…</button>
    </div>
  {:else if $shortcutsView}
    <ShortcutsPanel />
  {:else if $envView}
    <EnvironmentEditor
      environments={$envs}
      activeName={$activeEnvName}
      onSelect={pickEnvironment}
      onSaveVars={saveEnvVars}
      onCreate={createEnvironment}
    />
  {:else}
    <div class="main">
      <Sidebar />
      <section class="detail">
        {#if $request}
          <UrlBar />
          <SplitPane>
            <RequestView slot="left" />
            <ResponsePane slot="right" runs={$runs} />
          </SplitPane>
        {:else}
          <p class="hint">Select a request in the sidebar.</p>
        {/if}
      </section>
    </div>
  {/if}
  <Dialog />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #fff;
    color: var(--text);
  }
  .titlebar {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    flex-shrink: 0;
    --wails-draggable: drag;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .brand-logo {
    width: 18px;
    height: 18px;
  }
  .brand-name {
    font-size: 13px;
    font-weight: 600;
    color: #555;
    letter-spacing: 0.01em;
  }
  .collection-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 14px 10px;
    border-bottom: 1px solid var(--border-soft);
  }
  .col-tab {
    border: 1px solid var(--border);
    border-radius: 6px;
    background: #fff;
    padding: 5px 18px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
  }
  .col-tab:hover { background: #f7f7f7; }
  .col-tab.active {
    background: var(--yellow-bg);
    border-color: var(--yellow-border);
    color: var(--text);
  }
  .open-btn {
    border-style: dashed;
    color: #999;
  }
  .env-tab { margin-left: auto; }
  .shortcuts-tab {
    margin-left: auto;
    background: var(--green-bg);
    border-color: var(--green-border);
    color: var(--green-text);
  }
  .env-tab + .shortcuts-tab { margin-left: 0; }

  .main {
    display: grid;
    grid-template-columns: 300px 1fr;
    flex: 1;
    min-height: 0;
  }
  .detail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 20px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .hint { color: var(--text-disabled); }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--text-muted);
  }
  .empty-state h1 { font-weight: 500; color: var(--text-soft); margin: 0; }
  .splash-logo {
    width: 72px;
    height: 72px;
    margin-bottom: 6px;
  }
  .primary {
    border: 1px solid var(--yellow-border);
    background: var(--yellow-bg);
    border-radius: 6px;
    padding: 7px 16px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text);
    cursor: pointer;
  }
  .primary:hover { background: #f8efc7; }
  .error {
    background: var(--red-bg);
    color: var(--red-text);
    padding: 8px 14px;
    font-size: 13px;
  }
</style>
