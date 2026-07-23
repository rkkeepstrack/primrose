<script lang="ts">
  import Tree from './lib/Tree.svelte';
  import RequestView from './lib/RequestView.svelte';
  import ResponsePane from './lib/ResponsePane.svelte';
  import EnvironmentEditor from './lib/EnvironmentEditor.svelte';
  import type { Collection, TreeNode, ApiRequest, Environment } from './lib/types';
  import { normalizeUrlAndQuery } from './lib/urlQuery';
  import primroseLogo from './assets/images/primrose-logo.svg';
  import {
    runHistory,
    recordRun,
    selectedEnvNames,
    dynamicVars,
    setDynamicVar,
  } from './lib/stores';
  import {
    OpenCollectionDialog,
    CreateRequest,
    CreateFolder,
    MoveItem,
    ReadRequest,
    SaveRequest,
    SendRequest,
    GetTree,
    ListEnvironments,
    SaveEnvironment,
  } from '../wailsjs/go/main/App';

  let collections: Collection[] = [];
  let activeIdx = 0;
  let selectedPath: string | null = null;
  let selectedName = '';
  let request: ApiRequest | null = null;
  let dirty = false;
  let sending = false;
  let error = '';
  let envView = false;
  let environments: Record<string, Environment[]> = {};

  $: runs = $runHistory[selectedPath ?? 'draft'] ?? [];
  $: activeRoot = collections[activeIdx]?.root ?? null;
  $: envs = activeRoot ? (environments[activeRoot] ?? []) : [];
  $: activeEnvName = activeRoot
    ? ($selectedEnvNames[activeRoot] ?? envs[0]?.name ?? null)
    : null;
  $: activeEnvVars = envs.find((e) => e.name === activeEnvName)?.vars ?? {};
  $: dynValues = selectedPath ? ($dynamicVars[selectedPath] ?? {}) : {};

  async function loadEnvironments(root: string) {
    try {
      environments[root] = ((await ListEnvironments(root)) ?? []) as Environment[];
    } catch (e) {
      error = String(e);
    }
  }

  function pickEnvironment(name: string) {
    if (!activeRoot) return;
    selectedEnvNames.update((s) => ({ ...s, [activeRoot!]: name }));
  }

  async function saveEnvVars(name: string, vars: Record<string, string>) {
    if (!activeRoot) return;
    error = '';
    try {
      await SaveEnvironment(activeRoot, name, vars);
      await loadEnvironments(activeRoot);
    } catch (e) {
      error = String(e);
    }
  }

  // draft state for a new, not-yet-saved request
  let draftDir: string | null = null;
  let draftName: string | null = null;

  function newRequest(dir: string) {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    request = {
      method: 'GET',
      url: '',
      query: {},
      headers: {},
      body: { type: 'json', content: '' },
    };
    selectedPath = null;
    selectedName = '';
    draftDir = dir;
    draftName = '';
    dirty = true;
  }

  async function saveRequest() {
    if (!request) return;
    error = '';
    try {
      if (draftDir !== null) {
        if (!draftName?.trim()) {
          error = 'Give the new request a name before saving.';
          return;
        }
        selectedPath = await CreateRequest(draftDir, draftName, request as any);
        selectedName = draftName;
        draftDir = null;
        draftName = null;
      } else if (selectedPath) {
        await SaveRequest(selectedPath, request as any);
      } else {
        return;
      }
      dirty = false;
      // tree changed (new file or method badge)
      const col = (await GetTree(collections[activeIdx].root)) as Collection;
      collections[activeIdx] = col;
    } catch (e) {
      error = String(e);
    }
  }

  async function refreshTree() {
    const col = (await GetTree(collections[activeIdx].root)) as Collection;
    collections[activeIdx] = col;
  }

  async function newFolder(dir: string) {
    const name = prompt('Folder name:');
    if (!name?.trim()) return;
    error = '';
    try {
      await CreateFolder(dir, name);
      await refreshTree();
    } catch (e) {
      error = String(e);
    }
  }

  async function moveItem(src: string, destDir: string) {
    error = '';
    try {
      const newPath = await MoveItem(src, destDir);
      if (selectedPath === src) selectedPath = newPath;
      else if (selectedPath?.startsWith(src + '/')) {
        selectedPath = newPath + selectedPath.slice(src.length);
      }
      await refreshTree();
    } catch (e) {
      error = String(e);
    }
  }

  let rootDroppable = false;

  function rootDragOver(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('application/x-primrose-path')) return;
    // only when dropping on the sidebar background itself, not on a tree row
    if ((e.target as HTMLElement).closest('.tree')) {
      rootDroppable = false;
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    rootDroppable = true;
  }

  function rootDrop(e: DragEvent) {
    rootDroppable = false;
    if ((e.target as HTMLElement).closest('.tree')) return;
    e.preventDefault();
    const src = e.dataTransfer?.getData('application/x-primrose-path');
    if (src && activeRoot) moveItem(src, activeRoot);
  }

  async function sendRequest() {
    if (!request || sending) return;
    error = '';
    sending = true;
    const path = selectedPath ?? 'draft';
    try {
      const resp = await SendRequest(request as any, activeEnvVars, dynValues);
      recordRun(path, { at: new Date(), response: resp, error: null });
    } catch (e) {
      recordRun(path, { at: new Date(), response: null, error: String(e) });
    } finally {
      sending = false;
    }
  }

  async function openCollection() {
    error = '';
    try {
      const col = (await OpenCollectionDialog()) as Collection | null;
      if (!col) return;
      const existing = collections.findIndex((c) => c.root === col.root);
      if (existing >= 0) {
        collections[existing] = col;
        activeIdx = existing;
      } else {
        collections = [...collections, col];
        activeIdx = collections.length - 1;
      }
      await loadEnvironments(col.root);
    } catch (e) {
      error = String(e);
    }
  }

  async function selectRequest(node: TreeNode) {
    if (dirty && !confirm('Discard unsaved changes?')) return;
    error = '';
    draftDir = null;
    draftName = null;
    try {
      const r = (await ReadRequest(node.path)) as ApiRequest;
      // URL is the source of truth for query params in the UI
      const norm = normalizeUrlAndQuery(r.url, r.query);
      r.url = norm.url;
      r.query = norm.query;
      request = r;
      selectedPath = node.path;
      selectedName = node.name;
      dirty = false;
    } catch (e) {
      error = String(e);
    }
  }

  function switchCollection(i: number) {
    if (i === activeIdx && !envView) return;
    if (dirty && !confirm('Discard unsaved changes?')) return;
    envView = false;
    if (i === activeIdx) return;
    activeIdx = i;
    selectedPath = null;
    request = null;
    dirty = false;
    draftDir = null;
    draftName = null;
  }
</script>

<div class="app">
  <header class="collection-tabs">
    <div class="brand">
      <img class="brand-logo" src={primroseLogo} alt="" />
      <span class="brand-name">Primrose</span>
    </div>
    {#each collections as col, i (col.root)}
      <button class="col-tab" class:active={i === activeIdx} on:click={() => switchCollection(i)}>
        {col.name}
      </button>
    {/each}
    <button class="col-tab open-btn" on:click={openCollection}>+ Open Collection</button>
    {#if envView}
      <button class="col-tab env-tab active" on:click={() => (envView = false)}>
        Environment ×
      </button>
    {/if}
  </header>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  {#if collections.length === 0}
    <div class="empty-state">
      <h1>Primrose</h1>
      <p>Open a collection folder to get started.</p>
      <button class="primary" on:click={openCollection}>Open Collection…</button>
    </div>
  {:else}
    {#if envView}
      <EnvironmentEditor
        environments={envs}
        activeName={activeEnvName}
        onSelect={pickEnvironment}
        onSaveVars={saveEnvVars}
      />
    {:else}
      <div class="main">
        <aside
          class="sidebar"
          class:root-droppable={rootDroppable}
          role="tree"
          on:dragover={rootDragOver}
          on:dragleave={() => (rootDroppable = false)}
          on:drop={rootDrop}
        >
          <div class="sidebar-head">
            <div class="head-actions">
              <button
                class="new-root"
                title="New request at root level"
                on:click={() => activeRoot && newRequest(activeRoot)}
              >+</button>
              <button
                class="new-root"
                title="New folder at root level"
                on:click={() => activeRoot && newFolder(activeRoot)}
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                  <path d="M1.5 4.5 a1 1 0 0 1 1-1 h3.5 l1.5 1.8 h6 a1 1 0 0 1 1 1 v6.2 a1 1 0 0 1 -1 1 h-11 a1 1 0 0 1 -1-1 z" />
                  <path d="M8 7.6 v4 M6 9.6 h4" stroke-linecap="round" />
                </svg>
              </button>
            </div>
            <button class="env-label" on:click={() => (envView = true)} title="Edit environments">
              {activeEnvName ?? 'No environment'}
            </button>
          </div>
          <input class="search" placeholder="Search" disabled title="Fuzzy search comes in milestone 4" />
          <Tree
            nodes={collections[activeIdx].tree}
            {selectedPath}
            onSelect={selectRequest}
            onNewRequest={newRequest}
            onNewFolder={newFolder}
            onMove={moveItem}
          />
        </aside>
        <section class="detail">
          {#if request}
            <RequestView
              {request}
              bind:dirty
              bind:draftName
              {sending}
              envVars={activeEnvVars}
              dynamicValues={dynValues}
              onDynamicChange={(name, value) => selectedPath && setDynamicVar(selectedPath, name, value)}
              onSave={saveRequest}
              onSend={sendRequest}
            >
              <ResponsePane {runs} {sending} />
            </RequestView>
          {:else}
            <p class="hint">Select a request in the sidebar.</p>
          {/if}
        </section>
      </div>
    {/if}
  {/if}
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #fff;
    color: #333;
  }
  .collection-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid #e5e5e5;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-right: 10px;
  }
  .brand-logo {
    width: 20px;
    height: 20px;
  }
  .brand-name {
    font-size: 14px;
    font-weight: 600;
    color: #444;
    letter-spacing: 0.01em;
  }
  .col-tab {
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    background: #fff;
    padding: 5px 18px;
    font-size: 13px;
    font-family: inherit;
    color: #666;
    cursor: pointer;
  }
  .col-tab:hover { background: #f7f7f7; }
  .col-tab.active {
    background: #fdf7dc;
    border-color: #ecdfa8;
    color: #333;
  }
  .open-btn {
    border-style: dashed;
    color: #999;
  }

  .main {
    display: grid;
    grid-template-columns: 300px 1fr;
    flex: 1;
    min-height: 0;
  }
  .sidebar {
    border-right: 1px solid #e5e5e5;
    padding: 12px;
    overflow-y: auto;
  }
  .sidebar-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .head-actions { display: flex; align-items: center; gap: 2px; }
  .new-root {
    display: flex;
    align-items: center;
    border: none;
    background: none;
    color: #999;
    font-size: 16px;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 5px;
  }
  .new-root:hover { color: #4caf7d; background: #f4faf6; }
  .sidebar.root-droppable {
    background: #f4faf6;
    outline: 1px dashed #4caf7d;
    outline-offset: -4px;
  }
  .env-label {
    border: none;
    background: none;
    font-size: 13px;
    font-family: inherit;
    color: #3d9469;
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 5px;
  }
  .env-label:hover { background: #f4faf6; }
  .env-tab { margin-left: auto; }
  .search {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 7px 12px;
    margin-bottom: 12px;
    font-size: 13px;
    font-family: inherit;
    background: #fafafa;
  }
  .search:focus { outline: none; border-color: #ecdfa8; background: #fff; }
  .detail {
    padding: 16px 20px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }
  .hint { color: #aaa; }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: #666;
  }
  .empty-state h1 { font-weight: 500; color: #444; }
  .primary {
    border: 1px solid #ecdfa8;
    background: #fdf7dc;
    border-radius: 6px;
    padding: 7px 16px;
    font-size: 13px;
    font-family: inherit;
    color: #333;
    cursor: pointer;
  }
  .primary:hover { background: #f8efc7; }
  .error {
    background: #fdf0f0;
    color: #b06a6a;
    padding: 8px 14px;
    font-size: 13px;
  }
</style>
