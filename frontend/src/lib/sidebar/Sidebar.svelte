<script lang="ts">
  // Layout shell: header, search row, tree, and the root drop zone.
  import Tree from './Tree.svelte';
  import SidebarHeader from './SidebarHeader.svelte';
  import primroseLogo from '../../assets/images/primrose-logo.svg';
  import { acceptPathDrag, carriesPath, readPathDrag } from './dnd';
  import { get } from 'svelte/store';
  import { flatRequests, recentFilterOn, resetFilters, revealRequest, search, visibleTree } from './treeView';
  import { selectRequest } from '../workspace/requests';
  import { activeRoot, selectedPath } from '../workspace/state';
  import { moveItem } from '../workspace/treeOps';

  let searchEl: HTMLInputElement;

  // ⌘P focuses the search; ⌥↑/⌥↓ hop between visible requests
  function onGlobalKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault();
      searchEl?.focus();
      searchEl?.select();
      return;
    }
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      // leave Alt-arrows alone inside text editors (CodeMirror line moves)
      const t = e.target as HTMLElement;
      if (t.closest('.cm-editor') || t.tagName === 'TEXTAREA') return;
      if (t.tagName === 'INPUT' && t !== searchEl) return;
      e.preventDefault();
      hop(e.key === 'ArrowDown' ? 1 : -1);
    }
  }

  function hop(step: number) {
    const list = get(flatRequests);
    if (list.length === 0) return;
    const idx = list.findIndex((n) => n.path === get(selectedPath));
    const next = idx === -1 ? (step > 0 ? 0 : list.length - 1) : (idx + step + list.length) % list.length;
    const root = get(activeRoot);
    if (root) revealRequest(list[next].path, root);
    selectRequest(list[next]);
  }

  function onSearchKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      const first = get(flatRequests)[0];
      if (first) {
        selectRequest(first);
        searchEl.blur();
      }
    } else if (e.key === 'Escape') {
      search.set('');
      searchEl.blur();
    }
  }

  let lastRoot: string | null = null;
  $: if ($activeRoot !== lastRoot) {
    lastRoot = $activeRoot;
    resetFilters();
  }

  // dropping on the sidebar background moves an item to the collection root
  let rootDroppable = false;

  function rootDragOver(e: DragEvent) {
    if (!carriesPath(e)) return;
    if ((e.target as HTMLElement).closest('.tree')) {
      rootDroppable = false;
      return;
    }
    acceptPathDrag(e);
    rootDroppable = true;
  }

  function rootDrop(e: DragEvent) {
    rootDroppable = false;
    if ((e.target as HTMLElement).closest('.tree')) return;
    e.preventDefault();
    const src = readPathDrag(e);
    if (src && $activeRoot) moveItem(src, $activeRoot);
  }
</script>

<svelte:window on:keydown={onGlobalKeydown} />

<aside
  class="sidebar"
  class:root-droppable={rootDroppable}
  on:dragover={rootDragOver}
  on:dragleave={() => (rootDroppable = false)}
  on:drop={rootDrop}
>
  <SidebarHeader />
  <div class="search-row">
    <input
      class="search text-input"
      placeholder="Search (⌘P)"
      bind:value={$search}
      bind:this={searchEl}
      on:keydown={onSearchKeydown}
    />
    <button
      class="heat-toggle"
      class:on={$recentFilterOn}
      title="Show only the recently opened requests, newest first"
      on:click={() => recentFilterOn.update((v) => !v)}
    >
      <img src={primroseLogo} alt="recent filter" />
    </button>
  </div>
  <Tree nodes={$visibleTree} />
</aside>

<style>
  .sidebar {
    border-right: 1px solid var(--border-soft);
    padding: 12px;
    overflow-y: auto;
  }
  .sidebar.root-droppable {
    background: var(--green-bg);
    outline: 1px dashed var(--green);
    outline-offset: -4px;
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 12px;
  }
  .search {
    flex: 1;
    min-width: 0;
  }
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
  .heat-toggle.on {
    opacity: 1;
    filter: none;
  }
  .heat-toggle img {
    width: 16px;
    height: 16px;
  }
</style>
