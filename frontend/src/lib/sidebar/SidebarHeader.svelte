<script lang="ts">
  // Root-level actions (new request / new folder) and the environment
  // quick-switch dropdown.
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import CirclePlus from '@lucide/svelte/icons/circle-plus';
  import Cookie from '@lucide/svelte/icons/cookie';
  import FolderPlus from '@lucide/svelte/icons/folder-plus';
  import { newRequest } from '../workspace/requests';
  import { pickEnvironment } from '../workspace/environments';
  import { activeEnvName, activeRoot, envs } from '../workspace/state';
  import { openCookiesTab, openEnvironmentTab } from '../workspace/collections';
  import { newFolder } from '../workspace/treeOps';

  let envMenuOpen = false;

  function pick(name: string) {
    envMenuOpen = false;
    if ($activeRoot) pickEnvironment($activeRoot, name);
  }

  function openEditor() {
    envMenuOpen = false;
    if ($activeRoot) openEnvironmentTab($activeRoot);
  }
</script>

<svelte:window on:click={() => (envMenuOpen = false)} />

<div class="sidebar-head">
  <div class="head-actions">
    <button
      class="new-root"
      title="New request at root level"
      on:click={() => $activeRoot && newRequest($activeRoot)}
    >
      <CirclePlus size={14} strokeWidth={2} />
    </button>
    <button
      class="new-root"
      title="New folder at root level"
      on:click={() => $activeRoot && newFolder($activeRoot)}
    >
      <FolderPlus size={14} strokeWidth={2} />
    </button>
  </div>
  <button
    class="cookies-btn"
    title="Session cookies"
    aria-label="Session cookies"
    on:click={() => $activeRoot && openCookiesTab($activeRoot)}
  >
    <Cookie size={14} strokeWidth={2} />
  </button>
  <div class="env-wrap">
    <button
      class="env-label"
      title="Switch environment"
      on:click|stopPropagation={() => (envMenuOpen = !envMenuOpen)}
    >
      {$activeEnvName ?? 'No environment'}
      <ChevronDown class="chev" size={8} strokeWidth={2} />
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
  .cookies-btn {
    display: flex;
    align-items: center;
    border: none;
    background: none;
    color: #999;
    cursor: pointer;
    padding: 3px 6px;
    border-radius: 5px;
    margin-left: auto;
  }
  .cookies-btn:hover { color: #4a7cb5; background: #e9f1fa; }
  .env-wrap { position: relative; }
  /* purple, matching the environment tab's palette (.kind-env in App.svelte) */
  .env-label {
    display: flex;
    align-items: center;
    gap: 5px;
    border: 1px solid #eae2f4;
    background: #faf8fd;
    font-size: 13px;
    font-family: inherit;
    color: #6c4fa1;
    cursor: pointer;
    padding: 3px 10px;
    border-radius: 5px;
    transition: background 0.12s ease, border-color 0.12s ease;
  }
  .env-label:hover {
    background: #f3eefa;
    border-color: #d9c9ef;
  }
  .env-label :global(.chev) { color: #6c4fa1; opacity: 0.7; }
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
    color: #6c4fa1;
    font-weight: 600;
    background: #f3eefa;
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
