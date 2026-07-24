<script lang="ts">
  // Root-level actions (new request / new folder) and the environment
  // quick-switch dropdown.
  import { newRequest } from '../workspace/requests';
  import { pickEnvironment } from '../workspace/environments';
  import { activeEnvName, activeRoot, envs, envView } from '../workspace/state';
  import { newFolder } from '../workspace/treeOps';

  let envMenuOpen = false;

  function pick(name: string) {
    envMenuOpen = false;
    pickEnvironment(name);
  }

  function openEditor() {
    envMenuOpen = false;
    envView.set(true);
  }
</script>

<svelte:window on:click={() => (envMenuOpen = false)} />

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
  <div class="env-wrap">
    <button
      class="env-label"
      title="Switch environment"
      on:click|stopPropagation={() => (envMenuOpen = !envMenuOpen)}
    >
      {$activeEnvName ?? 'No environment'}
      <svg class="chev" width="8" height="8" viewBox="0 0 10 10">
        <path d="M1.5 3 L5 7 L8.5 3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    {#if envMenuOpen}
      <div class="env-menu">
        {#each $envs as e (e.name)}
          <button class:current={e.name === $activeEnvName} on:click={() => pick(e.name)}>
            {e.name}
          </button>
        {:else}
          <span class="none">No environments</span>
        {/each}
        <div class="sep"></div>
        <button on:click={openEditor}>Edit environments…</button>
      </div>
    {/if}
  </div>
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
  .env-wrap { position: relative; }
  .env-label {
    display: flex;
    align-items: center;
    gap: 5px;
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
  .chev { color: var(--green-text); opacity: 0.7; }
  .env-menu {
    position: absolute;
    right: 0;
    top: calc(100% + 4px);
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    padding: 4px;
    z-index: 30;
    display: flex;
    flex-direction: column;
    min-width: 160px;
  }
  .env-menu button {
    border: none;
    background: none;
    text-align: left;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-soft);
    padding: 6px 10px;
    border-radius: 5px;
    cursor: pointer;
  }
  .env-menu button:hover { background: var(--bg-hover); }
  .env-menu button.current {
    color: var(--green-text);
    font-weight: 600;
    background: var(--green-bg);
  }
  .env-menu .none {
    color: var(--text-disabled);
    font-size: 12px;
    padding: 6px 10px;
  }
  .env-menu .sep {
    height: 1px;
    background: var(--border-faint);
    margin: 4px 2px;
  }
</style>
