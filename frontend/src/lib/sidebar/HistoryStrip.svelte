<script lang="ts">
  // Thin quick-access heatmap: the last 100 opened requests as equal-width
  // slots, newest at the left. Hover scrubs a popup with name + folder,
  // click opens the request and reveals it in the tree.
  import type { TreeNode } from '../shared/types';
  import { historyPaths, HISTORY_MAX } from '../shared/stores';
  import { findRequestNode, heatColor, revealRequest } from './treeView';
  import { selectRequest } from '../workspace/requests';
  import { activeIdx, activeRoot, collections } from '../workspace/state';

  $: root = $activeRoot ?? '';
  $: tree = $collections[$activeIdx]?.tree ?? [];
  $: entries = ($historyPaths[root] ?? []).map((path) => ({ path, node: findRequestNode(tree, path) }));

  let stripEl: HTMLDivElement;
  let hover: { name: string; folder: string; x: number } | null = null;

  // name + folder path (relative to the collection root) for the popup
  function label(entry: { path: string; node: TreeNode | null }): { name: string; folder: string } {
    const rel = entry.path.startsWith(root + '/') ? entry.path.slice(root.length + 1) : entry.path;
    const cut = rel.lastIndexOf('/');
    const name = entry.node?.name ?? (cut === -1 ? rel : rel.slice(cut + 1)).replace(/\.toml$/, '');
    return { name, folder: cut === -1 ? '/' : rel.slice(0, cut) };
  }

  function scrub(e: MouseEvent, entry: { path: string; node: TreeNode | null }) {
    const rect = stripEl?.getBoundingClientRect();
    const x = rect ? Math.max(0, Math.min(e.clientX - rect.left, rect.width - 40)) : 0;
    hover = { ...label(entry), x };
  }

  function open(entry: { path: string; node: TreeNode | null }) {
    if (!entry.node) return; // file vanished mid-session: skip the slot
    revealRequest(entry.path, root);
    selectRequest(entry.node);
  }
</script>

{#if entries.length}
  <div class="history-strip" bind:this={stripEl} role="toolbar" tabindex="-1" aria-label="Request history" on:mouseleave={() => (hover = null)}>
    {#each entries as entry, i (entry.path)}
      <button
        class="slot"
        style="background: {heatColor((HISTORY_MAX - i) / HISTORY_MAX)}"
        data-heat={heatColor((HISTORY_MAX - i) / HISTORY_MAX)}
        aria-label={label(entry).name}
        on:mousemove={(e) => scrub(e, entry)}
        on:click={() => open(entry)}></button>
    {/each}
    {#if hover}
      <div class="history-tip popover-card" style="left: {hover.x}px">
        <span class="tip-name">{hover.name}</span>
        <span class="tip-folder">{hover.folder}</span>
      </div>
    {/if}
  </div>
{/if}

<style>
  .history-strip {
    position: relative;
    display: flex;
    height: 8px;
    margin-bottom: 12px;
    flex-shrink: 0;
    border-radius: 2px;
    background: var(--bg-hover);
  }
  .slot {
    /* equal-width slots: always 1/100th of the strip, newest at the left */
    flex: 0 0 1%;
    min-width: 0;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .slot:hover {
    box-shadow: inset 0 0 0 1px var(--orange-strong);
  }
  .history-tip {
    position: absolute;
    top: 12px;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 10px;
    font-size: 12px;
    pointer-events: none;
    white-space: nowrap;
  }
  .tip-name {
    font-weight: 600;
    color: var(--text-strong);
  }
  .tip-folder {
    color: var(--text-soft);
  }
</style>
