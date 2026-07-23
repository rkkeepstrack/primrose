<script lang="ts">
  import Tree from './lib/Tree.svelte';
  import RequestView from './lib/RequestView.svelte';
  import type { Collection, TreeNode, ApiRequest } from './lib/types';
  import { OpenCollectionDialog, ReadRequest } from '../wailsjs/go/main/App';

  let collections: Collection[] = [];
  let activeIdx = 0;
  let selectedPath: string | null = null;
  let selectedName = '';
  let request: ApiRequest | null = null;
  let error = '';

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
    } catch (e) {
      error = String(e);
    }
  }

  async function selectRequest(node: TreeNode) {
    error = '';
    try {
      request = (await ReadRequest(node.path)) as ApiRequest;
      selectedPath = node.path;
      selectedName = node.name;
    } catch (e) {
      error = String(e);
    }
  }

  function switchCollection(i: number) {
    activeIdx = i;
    selectedPath = null;
    request = null;
  }
</script>

<div class="app">
  <header class="collection-tabs">
    {#each collections as col, i (col.root)}
      <button class="col-tab" class:active={i === activeIdx} on:click={() => switchCollection(i)}>
        {col.name}
      </button>
    {/each}
    <button class="col-tab open-btn" on:click={openCollection}>+ Open Collection</button>
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
    <div class="main">
      <aside class="sidebar">
        <div class="sidebar-head">
          <span class="env-label">Environment A</span>
        </div>
        <input class="search" placeholder="Search" disabled title="Fuzzy search comes in milestone 4" />
        <Tree nodes={collections[activeIdx].tree} {selectedPath} onSelect={selectRequest} />
      </aside>
      <section class="detail">
        {#if request}
          <RequestView {request} name={selectedName} />
        {:else}
          <p class="hint">Select a request in the sidebar.</p>
        {/if}
      </section>
    </div>
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
    gap: 8px;
    padding: 10px 14px;
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
    justify-content: flex-end;
    margin-bottom: 8px;
  }
  .env-label { font-size: 13px; color: #888; }
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
    overflow-y: auto;
    min-width: 0;
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
