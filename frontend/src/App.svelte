<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar from './lib/sidebar/Sidebar.svelte';
  import CollectionSplash from './lib/collection/CollectionSplash.svelte';
  import UrlBar from './lib/request/UrlBar.svelte';
  import SplitPane from './lib/ui/SplitPane.svelte';
  import RequestView from './lib/request/RequestView.svelte';
  import ResponsePane from './lib/response/ResponsePane.svelte';
  import EnvironmentEditor from './lib/environments/EnvironmentEditor.svelte';
  import Dialog from './lib/ui/Dialog.svelte';
  import primroseLogo from './assets/images/primrose-logo.svg';
  import {
    closeCollection,
    createCollectionViaDialog,
    openCollectionViaDialog,
    switchTab,
  } from './lib/workspace/collections';
  import {
    activeTabId,
    closeTab,
    cookiesTabRoot,
    envTabId,
    envTabRoot,
    isCookiesTab,
    isEnvTab,
    isSpecialTab,
    moveTab,
    tabOrder,
  } from './lib/workspace/tabs';
  import { runs } from './lib/workspace/drafts';
  import { pickEnvironment, saveEnvironment } from './lib/workspace/environments';
  import { persistSession, restoreSession } from './lib/workspace/session';
  import { initExternalSync } from './lib/workspace/sync';
  import { initMenuHandlers } from './lib/workspace/menu';
  import { WindowToggleMaximise } from '../wailsjs/runtime/runtime';
  import ShortcutsPanel from './lib/shortcuts/ShortcutsPanel.svelte';
  import CookiesPanel from './lib/cookies/CookiesPanel.svelte';
  import { closeRequest } from './lib/workspace/requests';
  import { closeEnvView, createEnvironment } from './lib/workspace/environments';
  import { dialog } from './lib/ui/dialogs';
  import { activeIdx, collections, environments, error, request, restored } from './lib/workspace/state';
  import { selectedEnvNames } from './lib/shared/stores';

  function collectionName(root: string): string {
    return $collections.find((c) => c.root === root)?.name ?? root;
  }

  function tabLabel(id: string): string {
    if (id === 'shortcuts') return 'Shortcuts';
    if (isEnvTab(id)) return `Env: ${collectionName(envTabRoot(id))}`;
    if (isCookiesTab(id)) return `Cookies: ${collectionName(cookiesTabRoot(id))}`;
    return collectionName(id);
  }

  function closeSpecial(id: string) {
    if (isEnvTab(id)) closeEnvView(id);
    else closeTab(id);
  }

  // middle mouse click closes any tab; collections always confirm
  function middleClose(e: MouseEvent, id: string) {
    if (e.button !== 1) return;
    e.preventDefault();
    if (isSpecialTab(id)) closeSpecial(id);
    else closeCollection(id);
  }

  // drag & drop rearranging of tabs
  let dragTabId: string | null = null;

  onMount(() => {
    initExternalSync();
    initMenuHandlers();
    restoreSession();
  });

  function onGlobalKeydown(e: KeyboardEvent) {
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

  // persist open collections, tab order and active tab whenever they change
  $: persistWhenChanged($restored, $collections, $activeIdx, $tabOrder);

  function persistWhenChanged(restoredNow: boolean, ..._deps: unknown[]) {
    if (restoredNow) persistSession();
  }
</script>

<svelte:window on:keydown={onGlobalKeydown} />

<div class="app">
  <div class="titlebar" on:dblclick={WindowToggleMaximise} role="presentation">
    <div class="brand">
      <img class="brand-logo" src={primroseLogo} alt="" />
      <span class="brand-name">Primrose</span>
    </div>
  </div>
  <header class="collection-tabs">
    {#each $tabOrder as id (id)}
      <button
        class="col-tab"
        class:active={id === $activeTabId}
        class:kind-env={isEnvTab(id)}
        class:kind-cookies={isCookiesTab(id)}
        class:kind-shortcuts={id === 'shortcuts'}
        class:kind-collection={!isSpecialTab(id)}
        draggable="true"
        on:dragstart={() => (dragTabId = id)}
        on:dragover|preventDefault
        on:drop={() => dragTabId && moveTab(dragTabId, id)}
        on:dragend={() => (dragTabId = null)}
        on:auxclick={(e) => middleClose(e, id)}
        on:click={() => switchTab(id)}
      >
        {tabLabel(id)}
        {#if isSpecialTab(id)}
          <span
            class="tab-close"
            role="button"
            tabindex="-1"
            title="Close tab"
            on:click|stopPropagation={() => closeSpecial(id)}
            on:keydown={(e) => e.key === 'Enter' && closeSpecial(id)}
          >×</span>
        {/if}
      </button>
    {/each}
    <div class="strip-actions">
      <button
        class="strip-btn"
        title="New collection… (File → New Collection)"
        aria-label="New collection"
        on:click={createCollectionViaDialog}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M2.5 5.2 L8 2.6 L13.5 5.2 V10.8 L8 13.4 L2.5 10.8 Z" stroke-linejoin="round" />
          <path d="M2.5 5.2 L8 7.8 L13.5 5.2 M8 7.8 V13.4" />
          <path d="M11.4 1.2 v3.6 M9.6 3 h3.6" stroke-linecap="round" stroke-width="1.4" />
        </svg>
      </button>
      <button
        class="strip-btn"
        title="Open collection folder… (⌘O)"
        aria-label="Open collection"
        on:click={openCollectionViaDialog}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
          <path d="M1.5 4.5 a1 1 0 0 1 1-1 h3.5 l1.5 1.8 h6 a1 1 0 0 1 1 1 v2" />
          <path d="M1.8 12.8 l1.6 -5 a1 1 0 0 1 0.95 -0.7 h10.4 a0.7 0.7 0 0 1 0.66 0.92 l-1.55 4.8 a1 1 0 0 1 -0.95 0.68 h-10.4 a0.7 0.7 0 0 1 -0.66 -0.7 z" />
      </svg>
      </button>
    </div>
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
  {:else if $activeTabId === 'shortcuts'}
    <ShortcutsPanel />
  {:else if $activeTabId && isCookiesTab($activeTabId)}
    {@const cookiesRoot = cookiesTabRoot($activeTabId)}
    {#key cookiesRoot}
      <CookiesPanel root={cookiesRoot} />
    {/key}
  {:else if $activeTabId && isEnvTab($activeTabId)}
    {@const envRoot = envTabRoot($activeTabId)}
    {#key envRoot}
      <EnvironmentEditor
        root={envRoot}
        environments={$environments[envRoot] ?? []}
        activeName={$selectedEnvNames[envRoot] ?? ($environments[envRoot] ?? [])[0]?.name ?? null}
        onSelect={(name) => pickEnvironment(envRoot, name)}
        onSave={(name, vars, headers) => saveEnvironment(envRoot, name, vars, headers)}
        onCreate={(name) => createEnvironment(envRoot, name)}
      />
    {/key}
  {:else}
    <SplitPane initialPct={22} minPct={14} maxPct={45}>
      <Sidebar slot="left" />
      <section class="detail" slot="right">
        {#if $request}
          <UrlBar />
          <SplitPane>
            <RequestView slot="left" />
            <ResponsePane slot="right" runs={$runs} />
          </SplitPane>
        {:else}
          <CollectionSplash />
        {/if}
      </section>
    </SplitPane>
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
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--tab-border-soft, var(--border));
    border-radius: 6px;
    background: var(--tab-bg-soft, #fff);
    padding: 5px 18px;
    font-size: 13px;
    font-family: inherit;
    color: var(--tab-text, var(--text-muted));
    cursor: pointer;
  }
  .col-tab:hover { background: var(--tab-bg-hover, #f7f7f7); }
  .col-tab.active,
  .col-tab.active:hover {
    background: var(--tab-bg, #fff);
    border-color: var(--tab-border-strong, var(--border));
  }
  .kind-collection {
    --tab-bg-soft: #fdfbf0;
    --tab-bg-hover: var(--yellow-bg);
    --tab-bg: #fbf0c2;
    --tab-border-soft: #f2ead0;
    --tab-border-strong: #d9bc55;
    --tab-text: #8a7a33;
  }
  .kind-env {
    --tab-bg-soft: #faf8fd;
    --tab-bg-hover: #f3eefa;
    --tab-bg: #ece2f8;
    --tab-border-soft: #eae2f4;
    --tab-border-strong: #a07fd0;
    --tab-text: #7d5bab;
  }
  .kind-cookies {
    --tab-bg-soft: #f7fafd;
    --tab-bg-hover: #e9f1fa;
    --tab-bg: #ddeaf8;
    --tab-border-soft: #e0eaf5;
    --tab-border-strong: var(--blue);
    --tab-text: #4a7cb5;
  }
  .kind-shortcuts {
    --tab-bg-soft: #f9fcfa;
    --tab-bg-hover: var(--green-bg);
    --tab-bg: #ddf1e6;
    --tab-border-soft: #e0efe6;
    --tab-border-strong: var(--green);
    --tab-text: var(--green-text);
  }
  .tab-close {
    color: inherit;
    opacity: 0.55;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
    border-radius: 3px;
    cursor: pointer;
  }
  .tab-close:hover { opacity: 1; background: rgba(0, 0, 0, 0.06); }
  .strip-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
  }
  .strip-btn {
    display: flex;
    align-items: center;
    border: none;
    background: none;
    color: #999;
    cursor: pointer;
    padding: 5px 8px;
    border-radius: 5px;
  }
  .strip-btn:hover { color: var(--green); background: var(--green-bg); }

  .detail {
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
    padding: 16px 20px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

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
