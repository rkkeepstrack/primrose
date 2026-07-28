<script lang="ts">
  // Root-level actions (new request / new folder) and the environment
  // quick-switch dropdown.
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import CirclePlus from '@lucide/svelte/icons/circle-plus';
  import Cookie from '@lucide/svelte/icons/cookie';
  import FolderPlus from '@lucide/svelte/icons/folder-plus';
  import Menu from '../ui/Menu.svelte';
  import MenuItem from '../ui/MenuItem.svelte';
  import MenuSep from '../ui/MenuSep.svelte';
  import { newRequest } from '../workspace/requests';
  import { pickEnvironment } from '../workspace/environments';
  import { activeEnvName, activeRoot, envs } from '../workspace/state';
  import { openCookiesTab, openEnvironmentTab } from '../workspace/collections';
  import { newFolder } from '../workspace/treeOps';

  function pick(name: string) {
    if ($activeRoot) pickEnvironment($activeRoot, name);
  }

  function openEditor() {
    if ($activeRoot) openEnvironmentTab($activeRoot);
  }
</script>

<div class="sidebar-head">
  <div class="head-actions">
    <button class="new-root" title="New request at root level" on:click={() => $activeRoot && newRequest($activeRoot)}>
      <CirclePlus size={14} strokeWidth={2} />
    </button>
    <button class="new-root" title="New folder at root level" on:click={() => $activeRoot && newFolder($activeRoot)}>
      <FolderPlus size={14} strokeWidth={2} />
    </button>
  </div>
  <button
    class="cookies-btn"
    title="Session cookies"
    aria-label="Session cookies"
    on:click={() => $activeRoot && openCookiesTab($activeRoot)}>
    <Cookie size={14} strokeWidth={2} />
  </button>
  <div class="env-menu-scope">
    <Menu placement="bottom-end">
      <button slot="trigger" class="env-label" title="Switch environment">
        {$activeEnvName ?? 'No environment'}
        <ChevronDown class="chev" size={8} strokeWidth={2} />
      </button>
      {#each $envs as e (e.name)}
        <MenuItem current={e.name === $activeEnvName} onSelect={() => pick(e.name)}>
          {e.name}
        </MenuItem>
      {:else}
        <span class="none">No environments</span>
      {/each}
      <MenuSep />
      <MenuItem onSelect={openEditor}>Edit environments…</MenuItem>
    </Menu>
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
  .cookies-btn:hover {
    color: #4a7cb5;
    background: #e9f1fa;
  }
  /* purple, matching the environment tab's palette (.kind-env in App.svelte) */
  .env-label {
    display: flex;
    align-items: center;
    gap: 5px;
    border: 1px solid var(--purple-border);
    background: var(--purple-bg-soft);
    font-size: 13px;
    font-family: inherit;
    color: var(--purple-text);
    cursor: pointer;
    padding: 3px 10px;
    border-radius: 5px;
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }
  .env-label:hover {
    background: var(--purple-bg);
    border-color: var(--purple-border-strong);
  }
  .env-label :global(.chev) {
    color: var(--purple-text);
    opacity: 0.7;
  }
  /* the current environment shows in the tab's purple, not the default green */
  .env-menu-scope {
    display: contents;
    --menu-current-color: var(--purple-text);
    --menu-current-bg: #f3eefa;
  }
  .none {
    color: var(--text-disabled);
    font-size: 12px;
    padding: 6px 10px;
  }
</style>
