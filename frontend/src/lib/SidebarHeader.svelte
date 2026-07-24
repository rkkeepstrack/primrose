<script lang="ts">
  // Root-level actions (new request / new folder) and the environment button.
  import { newRequest } from './workspace/requests';
  import { activeEnvName, activeRoot, envView } from './workspace/state';
  import { newFolder } from './workspace/treeOps';
</script>

<div class="sidebar-head">
  <div class="head-actions">
    <button
      class="new-root"
      title="New request at root level"
      on:click={() => $activeRoot && newRequest($activeRoot)}
    >+</button>
    <button
      class="new-root"
      title="New folder at root level"
      on:click={() => $activeRoot && newFolder($activeRoot)}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
        <path d="M1.5 4.5 a1 1 0 0 1 1-1 h3.5 l1.5 1.8 h6 a1 1 0 0 1 1 1 v6.2 a1 1 0 0 1 -1 1 h-11 a1 1 0 0 1 -1-1 z" />
        <path d="M8 7.6 v4 M6 9.6 h4" stroke-linecap="round" />
      </svg>
    </button>
  </div>
  <button class="env-label" on:click={() => envView.set(true)} title="Edit environments">
    {$activeEnvName ?? 'No environment'}
  </button>
</div>

<style>
  .sidebar-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .head-actions {
    display: flex;
    align-items: center;
    gap: 2px;
  }
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
  .new-root:hover {
    color: var(--green);
    background: var(--green-bg);
  }
  .env-label {
    border: none;
    background: none;
    font-size: 13px;
    font-family: inherit;
    color: var(--green-text);
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 5px;
  }
  .env-label:hover {
    background: var(--green-bg);
  }
</style>
