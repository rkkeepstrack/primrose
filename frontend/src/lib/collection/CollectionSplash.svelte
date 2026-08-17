<script lang="ts">
  // Shown in the detail area while no request is open: a small overview of
  // the active collection.
  import primroseLogo from '../../assets/images/primrose-logo.svg';
  import type { TreeNode } from '../shared/types';
  import { activeIdx, activeRoot, collections, envs } from '../workspace/state';

  function countTree(nodes: TreeNode[]): { requests: number; folders: number } {
    let requests = 0;
    let folders = 0;
    for (const n of nodes) {
      if (n.isFolder) {
        folders++;
        const sub = countTree(n.children ?? []);
        requests += sub.requests;
        folders += sub.folders;
      } else {
        requests++;
      }
    }
    return { requests, folders };
  }

  $: col = $collections[$activeIdx] ?? null;
  $: counts = col ? countTree(col.tree ?? []) : { requests: 0, folders: 0 };
</script>

{#if col}
  <div class="splash">
    <img class="logo" src={primroseLogo} alt="" />
    <h2>{col.name}</h2>
    <div class="stats">
      <div class="stat">
        <span class="num">{counts.requests}</span>
        <span class="label">{counts.requests === 1 ? 'request' : 'requests'}</span>
      </div>
      <div class="stat">
        <span class="num">{counts.folders}</span>
        <span class="label">{counts.folders === 1 ? 'folder' : 'folders'}</span>
      </div>
      <div class="stat">
        <span class="num">{$envs.length}</span>
        <span class="label">{$envs.length === 1 ? 'environment' : 'environments'}</span>
      </div>
    </div>
    <p class="path" title={$activeRoot}>{$activeRoot}</p>
    <p class="hint">Select a request in the sidebar — or press ⌘P to search.</p>
  </div>
{/if}

<style>
  .splash {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100%;
    color: var(--text-muted);
    margin: auto;
  }
  .logo {
    width: 48px;
    height: 48px;
    opacity: 0.85;
  }
  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    color: var(--text-soft);
  }
  .stats {
    display: flex;
    gap: 28px;
    margin-top: 6px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
  }
  .num {
    font-size: 20px;
    font-weight: 600;
    color: var(--green-text);
  }
  .label {
    font-size: 12px;
    color: var(--text-faint);
  }
  .path {
    margin: 8px 0 0;
    font-size: 11.5px;
    font-family: var(--mono);
    color: var(--text-disabled);
    /* cap by viewport-ish width, not by the shrink-to-fit splash width */
    max-width: 60ch;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hint {
    margin: 2px 0 0;
    font-size: 13px;
    color: var(--text-disabled);
  }
</style>
