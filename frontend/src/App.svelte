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
    recentPaths,
    touchRecent,
    renameRecent,
    RECENT_MAX,
    unsavedEdits,
    stashEdit,
    dropEdit,
    pruneEdits,
  } from './lib/stores';
  import { filterTree } from './lib/fuzzy';
  import Dialog from './lib/Dialog.svelte';
  import { confirmDialog, promptDialog } from './lib/dialogs';
  import {
    OpenCollectionDialog,
    CreateRequest,
    CreateFolder,
    MoveItem,
    CancelRequest,
    RenameItem,
    DeleteItem,
    DuplicateItem,
    OpenCollection,
    LoadUIState,
    SaveUIState,
    ReadRequest,
    SaveRequest,
    SendRequest,
    GetTree,
    ListEnvironments,
    SaveEnvironment,
  } from '../wailsjs/go/main/App';

  import { onMount } from 'svelte';

  let collections: Collection[] = [];
  let activeIdx = 0;
  let restored = false;

  onMount(async () => {
    try {
      const state = await LoadUIState();
      for (const root of state?.openRoots ?? []) {
        try {
          const col = (await OpenCollection(root)) as Collection;
          collections = [...collections, col];
          await loadEnvironments(root);
        } catch {
          // folder gone/renamed — skip silently
        }
      }
      const idx = collections.findIndex((c) => c.root === state?.activeRoot);
      if (idx >= 0) activeIdx = idx;
    } finally {
      restored = true;
    }
  });

  // persist open collections + active tab whenever they change
  $: if (restored) {
    SaveUIState({
      openRoots: collections.map((c) => c.root),
      activeRoot: collections[activeIdx]?.root ?? '',
    } as any);
  }
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

  async function newRequest(dir: string) {
    if (draftDir !== null && dirty && !(await confirmDialog('Discard the unsaved new request?'))) return;
    stashCurrentEdit();
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
      if (selectedPath) dropEdit(selectedPath);
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
    const name = await promptDialog('Folder name:');
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

  async function renameItem(node: TreeNode) {
    const name = await promptDialog('New name:', node.name);
    if (!name?.trim() || name === node.name) return;
    error = '';
    try {
      const newPath = await RenameItem(node.path, name);
      if (selectedPath === node.path) {
        selectedPath = newPath;
        selectedName = name;
      } else if (selectedPath?.startsWith(node.path + '/')) {
        selectedPath = newPath + selectedPath.slice(node.path.length);
      }
      renameRecent(node.path, newPath);
      await refreshTree();
    } catch (e) {
      error = String(e);
    }
  }

  async function duplicateItem(node: TreeNode) {
    error = '';
    try {
      await DuplicateItem(node.path);
      await refreshTree();
    } catch (e) {
      error = String(e);
    }
  }

  async function deleteItem(node: TreeNode) {
    const what = node.isFolder ? `folder "${node.name}" and everything in it` : `request "${node.name}"`;
    if (!(await confirmDialog(`Delete ${what}?`, true))) return;
    error = '';
    try {
      await DeleteItem(node.path);
      dropEdit(node.path);
      if (selectedPath === node.path || selectedPath?.startsWith(node.path + '/')) {
        selectedPath = null;
        request = null;
        dirty = false;
      }
      await refreshTree();
    } catch (e) {
      error = String(e);
    }
  }

  // sidebar search + recency heatmap / recent-only filter
  let search = '';
  let recentFilterOn = false;

  function findRequestNode(nodes: TreeNode[], path: string): TreeNode | null {
    for (const n of nodes) {
      if (n.path === path && !n.isFolder) return n;
      if (n.isFolder && n.children?.length) {
        const hit = findRequestNode(n.children, path);
        if (hit) return hit;
      }
    }
    return null;
  }

  $: visibleTree = collections[activeIdx]
    ? recentFilterOn
      ? // flat list of the recent requests, chronological (newest first)
        filterTree(
          $recentPaths
            .map((p) => findRequestNode(collections[activeIdx].tree, p))
            .filter((n): n is TreeNode => n !== null),
          search
        )
      : filterTree(collections[activeIdx].tree, search)
    : [];
  $: heat = Object.fromEntries(
    $recentPaths.map((p, i) => [p, (RECENT_MAX - i) / RECENT_MAX])
  );

  // discard stashed edits for requests that fell out of the recents window
  $: pruneEdits($recentPaths);
  $: dirtyPaths = new Set(Object.keys($unsavedEdits).concat(dirty && selectedPath ? [selectedPath] : []));

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
      const msg = String(e);
      recordRun(path, {
        at: new Date(),
        response: null,
        error: msg.includes('canceled') ? 'Canceled' : msg,
      });
    } finally {
      sending = false;
    }
  }

  function cancelRequest() {
    CancelRequest();
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

  // keep unsaved edits in memory when switching away from a request
  function stashCurrentEdit() {
    if (dirty && selectedPath && request) stashEdit(selectedPath, request);
  }

  async function selectRequest(node: TreeNode) {
    if (draftDir !== null && dirty && !(await confirmDialog('Discard the unsaved new request?'))) return;
    error = '';
    stashCurrentEdit();
    draftDir = null;
    draftName = null;
    try {
      const stashed = $unsavedEdits[node.path];
      if (stashed) {
        request = stashed;
        dirty = true;
      } else {
        const r = (await ReadRequest(node.path)) as ApiRequest;
        // URL is the source of truth for query params in the UI
        const norm = normalizeUrlAndQuery(r.url, r.query);
        r.url = norm.url;
        r.query = norm.query;
        request = r;
        dirty = false;
      }
      selectedPath = node.path;
      selectedName = node.name;
      touchRecent(node.path);
    } catch (e) {
      error = String(e);
    }
  }

  async function switchCollection(i: number) {
    if (i === activeIdx && !envView) return;
    if (draftDir !== null && dirty && !(await confirmDialog('Discard the unsaved new request?'))) return;
    envView = false;
    if (i === activeIdx) return;
    stashCurrentEdit();
    activeIdx = i;
    selectedPath = null;
    request = null;
    dirty = false;
    draftDir = null;
    draftName = null;
  }
</script>

<div class="app">
  <div class="titlebar">
    <div class="brand">
      <img class="brand-logo" src={primroseLogo} alt="" />
      <span class="brand-name">Primrose</span>
    </div>
  </div>
  <header class="collection-tabs">
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

  {#if !restored}
    <!-- restoring saved collections; render nothing to avoid a splash flicker -->
    <div class="empty-state"></div>
  {:else if collections.length === 0}
    <div class="empty-state">
      <img class="splash-logo" src={primroseLogo} alt="" />
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
          <div class="search-row">
            <input class="search" placeholder="Search" bind:value={search} />
            <button
              class="heat-toggle"
              class:on={recentFilterOn}
              title="Show only the recently opened requests, newest first"
              on:click={() => (recentFilterOn = !recentFilterOn)}
            >
              <img src={primroseLogo} alt="recent filter" />
            </button>
          </div>
          <Tree
            nodes={visibleTree}
            {selectedPath}
            forceOpen={search.trim().length > 0}
            {heat}
            {dirtyPaths}
            onSelect={selectRequest}
            onNewRequest={newRequest}
            onNewFolder={newFolder}
            onMove={moveItem}
            onRename={renameItem}
            onDuplicate={duplicateItem}
            onDelete={deleteItem}
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
              onCancel={cancelRequest}
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
  <Dialog />
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #fff;
    color: #333;
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
    border-bottom: 1px solid #e5e5e5;
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
  .search-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
  }
  .search-row .search { margin-bottom: 0; flex: 1; }
  .heat-toggle {
    border: none;
    background: none;
    padding: 4px;
    border-radius: 5px;
    cursor: pointer;
    line-height: 0;
    opacity: 0.25;
    filter: grayscale(1);
    transition: opacity 0.12s ease, filter 0.12s ease;
  }
  .heat-toggle.on { opacity: 1; filter: none; }
  .heat-toggle img { width: 16px; height: 16px; }
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
  .empty-state h1 { font-weight: 500; color: #444; margin: 0; }
  .splash-logo {
    width: 72px;
    height: 72px;
    margin-bottom: 6px;
  }
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
