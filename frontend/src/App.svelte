<script lang="ts">
  import { onMount } from 'svelte';
  import X from '@lucide/svelte/icons/x';
  import FolderOpen from '@lucide/svelte/icons/folder-open';
  import PackagePlus from '@lucide/svelte/icons/package-plus';
  import Sidebar from './lib/sidebar/Sidebar.svelte';
  import CollectionSplash from './lib/collection/CollectionSplash.svelte';
  import UrlBar from './lib/request/UrlBar.svelte';
  import SplitPane from './lib/ui/SplitPane.svelte';
  import RequestView from './lib/request/RequestView.svelte';
  import ResponsePane from './lib/response/ResponsePane.svelte';
  import EnvironmentEditor from './lib/environments/EnvironmentEditor.svelte';
  import Dialog from './lib/ui/Dialog.svelte';
  import primroseLogo from './assets/images/primrose-logo.svg';
  import { closeCollection, createCollectionViaDialog, openCollectionViaDialog, switchTab } from './lib/workspace/collections';
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

  // every tab is closable; collections confirm via closeCollection
  function closeAny(id: string) {
    if (isSpecialTab(id)) closeSpecial(id);
    else closeCollection(id);
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
      // claim the key — an unhandled Escape falls through to the native
      // responder chain and macOS plays the error beep
      e.preventDefault();
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
        on:click={() => switchTab(id)}>
        <span class="tab-label">{tabLabel(id)}</span>
        <span
          class="tab-close"
          role="button"
          tabindex="-1"
          title={isSpecialTab(id) ? 'Close tab' : 'Close collection'}
          on:click|stopPropagation={() => closeAny(id)}
          on:keydown={(e) => e.key === 'Enter' && closeAny(id)}>
          <X size={12} strokeWidth={2} />
        </span>
      </button>
    {/each}
    <div class="strip-actions">
      <button
        class="strip-btn"
        title="New collection… (File → New Collection)"
        aria-label="New collection"
        on:click={createCollectionViaDialog}>
        <PackagePlus size={15} strokeWidth={2} />
      </button>
      <button class="strip-btn" title="Open collection folder… (⌘O)" aria-label="Open collection" on:click={openCollectionViaDialog}>
        <FolderOpen size={15} strokeWidth={2} />
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
      <p>Open a collection folder to get started — or create a new one.</p>
      <div class="empty-actions">
        <button class="primary" on:click={openCollectionViaDialog}>Open Collection…</button>
        <button class="primary" on:click={createCollectionViaDialog}>New Collection…</button>
      </div>
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
        onCreate={(name) => createEnvironment(envRoot, name)} />
    {/key}
  {:else}
    <SplitPane storageKey="sidebar" initialPct={22} minPct={14} maxPct={45} flushLeft>
      <Sidebar slot="left" />
      <section class="detail" slot="right">
        {#if $request}
          <UrlBar />
          <SplitPane storageKey="request-response">
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
    background: var(--bg);
    color: var(--text);
  }
  .titlebar {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 38px;
    flex-shrink: 0;
    --wails-draggable: drag;
    cursor: default;
    user-select: none;
    -webkit-user-select: none;
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
    color: var(--text-soft);
    letter-spacing: 0.01em;
  }
  .collection-tabs {
    display: flex;
    align-items: stretch;
    background: var(--bg-lift);
    border-bottom: 1px solid var(--border-soft);
  }
  .col-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    flex: 1 1 0;
    /* lets tabs shrink below their label width so the label ellipsizes */
    min-width: 0;
    border: none;
    border-right: 1px solid var(--border-soft);
    background: var(--tab-bg-soft, transparent);
    padding: 8px 8px 8px 14px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
  }
  .tab-label {
    flex: 1;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .col-tab:hover:not(.active) {
    background: var(--tab-bg-hover, var(--bg-hover));
  }
  .col-tab.active {
    background: var(--tab-bg, var(--bg));
    color: var(--text);
    /* accent line on top, and a 1px cover over the strip's bottom border
       so the active tab merges with the content area */
    box-shadow:
      inset 0 2px 0 var(--tab-accent, var(--border)),
      0 1px 0 var(--tab-bg, var(--bg));
  }
  .kind-collection {
    --tab-accent: var(--tab-yellow-border-strong);
    --tab-bg-soft: var(--tab-yellow-bg-soft);
    --tab-bg-hover: var(--yellow-bg);
    --tab-bg: var(--tab-yellow-bg);
  }
  .kind-env {
    --tab-accent: var(--tab-purple-border-strong);
    --tab-bg-soft: var(--purple-bg-soft);
    --tab-bg-hover: var(--purple-bg);
    --tab-bg: var(--tab-purple-bg);
  }
  .kind-cookies {
    --tab-accent: var(--blue);
    --tab-bg-soft: var(--tab-blue-bg-soft);
    --tab-bg-hover: var(--blue-bg-strong);
    --tab-bg: var(--tab-blue-bg);
  }
  .kind-shortcuts {
    --tab-accent: var(--green);
    --tab-bg-soft: var(--tab-green-bg-soft);
    --tab-bg-hover: var(--green-bg);
    --tab-bg: var(--tab-green-bg);
  }
  .tab-close {
    display: inline-flex;
    opacity: 0.55;
    padding: 2px;
    margin-top: 3px;
  }
  .tab-close:hover {
    opacity: 1;
    background: rgba(0, 0, 0, 0.06);
  }
  .strip-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-left: auto;
    padding: 0 10px;
  }
  .strip-btn {
    display: flex;
    align-items: center;
    border: none;
    background: none;
    color: var(--text-placeholder);
    cursor: pointer;
    padding: 5px 8px;
    border-radius: 5px;
  }
  .strip-btn:hover {
    color: var(--green);
    background: var(--green-bg);
  }

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
  .empty-state h1 {
    font-weight: 500;
    color: var(--text-soft);
    margin: 0;
  }
  .splash-logo {
    width: 72px;
    height: 72px;
    margin-bottom: 6px;
  }
  .empty-actions {
    display: flex;
    gap: 10px;
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
  .primary:hover {
    background: var(--yellow-bg-strong);
  }
  .error {
    background: var(--red-bg);
    color: var(--red-text);
    padding: 8px 14px;
    font-size: 13px;
  }
</style>
