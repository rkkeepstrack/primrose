<script lang="ts">
  // Full-width request toolbar: method picker, URL editor, Save/Send/Cancel,
  // draft-name row, and the ⌘S / ⌘↵ shortcuts.
  import Check from '@lucide/svelte/icons/check';
  import Code from '@lucide/svelte/icons/code';
  import Play from '@lucide/svelte/icons/play';
  import Save from '@lucide/svelte/icons/save';
  import X from '@lucide/svelte/icons/x';
  import { METHODS } from '../shared/types';
  import CodeEditor from '../editor/CodeEditor.svelte';
  import Menu from '../ui/Menu.svelte';
  import Popover from '../ui/Popover.svelte';
  import MenuItem from '../ui/MenuItem.svelte';
  import DiskChangeNotice from './DiskChangeNotice.svelte';
  import DraftNameRow from './DraftNameRow.svelte';
  import { toCurl } from './curl';
  import { setMethod, setUrl } from './requestEdit';
  import { saveRequest } from '../workspace/requests';
  import { cancelRequest, sendRequest } from '../workspace/send';
  import { activeEnvVars, dirty, diskChanged, draftName, inheritedHeaders, request, sending } from '../workspace/state';
  import { ClipboardSetText } from '../../../wailsjs/runtime/runtime';

  let curlCopied = false;

  async function copyCurl() {
    if (!$request) return;
    await ClipboardSetText(toCurl($request, $activeEnvVars, $inheritedHeaders));
    curlCopied = true; // the confirmation popover dismisses itself (and resets the icon)
  }

  // ⌘S lives in the native menu now; ⌘↵ stays here (menus can't bind Return)
  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      sendRequest();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $request}
  {#if $diskChanged}
    <DiskChangeNotice />
  {/if}
  {#if $draftName !== null}
    <DraftNameRow />
  {/if}
  <div class="url-row">
    <div class="url-bar">
      <div class="method-menu-scope">
        <Menu placement="bottom-start">
          <button slot="trigger" class="method method-{$request.method}">
            {$request.method}
          </button>
          {#each METHODS as m}
            <MenuItem class="method-item method-{m}" onSelect={() => setMethod(m)}>{m}</MenuItem>
          {/each}
        </Menu>
      </div>
      <CodeEditor singleLine value={$request.url} placeholder="https://api.example.com/…" onChange={setUrl} envVars={$activeEnvVars} />
      <Popover trigger="manual" placement="bottom-end" autoDismissMs={1600} bind:open={curlCopied}>
        <button
          slot="trigger"
          class="curl-btn"
          class:copied={curlCopied}
          title="Copy as curl"
          aria-label="Copy as curl"
          on:click={copyCurl}>
          {#if curlCopied}
            <Check size={14} strokeWidth={2} />
          {:else}
            <Code size={14} strokeWidth={2} />
          {/if}
        </button>
        <div class="curl-toast">Copied as curl request</div>
      </Popover>
    </div>
    <button class="action save" class:dirty={$dirty} on:click={saveRequest} title="Save (⌘S)" aria-label="Save">
      <Save size={15} strokeWidth={2} />
      {#if $dirty}<span class="save-dot"></span>{/if}
    </button>
    {#if $sending}
      <button class="action cancel" on:click={cancelRequest} title="Cancel request" aria-label="Cancel">
        <X size={13} strokeWidth={2.2} />
      </button>
    {:else}
      <button class="action send" on:click={sendRequest} title="Send (⌘↵)" aria-label="Send">
        <Play size={14} fill="currentColor" strokeWidth={1} />
      </button>
    {/if}
  </div>
{/if}

<style>
  .url-row {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .url-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--border-input);
    border-radius: 8px;
    padding: 4px 6px;
    font-size: 13px;
    background: var(--bg-soft);
    flex: 1;
    min-width: 0;
  }
  /* floats at the end of the url bar, set apart by its own divider */
  .curl-btn {
    display: flex;
    align-items: center;
    align-self: stretch;
    border: none;
    border-left: 1px solid var(--border-soft);
    background: none;
    color: var(--text-placeholder);
    cursor: pointer;
    padding: 0 8px 0 12px;
    margin-left: auto;
  }
  .curl-btn:hover {
    color: var(--green);
  }
  .curl-toast {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--green-text);
    white-space: nowrap;
  }
  .curl-btn.copied {
    color: var(--green);
  }

  button.method {
    border: none;
    background: none;
    font-weight: 600;
    font-size: 12px;
    font-family: inherit;
    cursor: pointer;
    padding: 5px 8px;
    border-radius: 5px;
  }
  /* hover tint follows the currently selected method's color */
  button.method.method-GET:hover {
    background: var(--green-bg-strong);
  }
  button.method.method-POST:hover {
    background: var(--blue-bg);
  }
  button.method.method-PUT:hover {
    background: var(--orange-bg);
  }
  button.method.method-PATCH:hover {
    background: var(--tan-bg);
  }
  button.method.method-DELETE:hover {
    background: var(--red-bg);
  }
  button.method.method-HEAD:hover,
  button.method.method-OPTIONS:hover {
    background: var(--bg-hover);
  }
  .method-menu-scope {
    display: contents;
  }
  .method-menu-scope :global(.method-item) {
    font-weight: 600;
    font-size: 12px;
  }
  /* item text and hover tint follow the method's color (the scoped MenuItem
     color would otherwise override the global .method-* classes) */
  .method-menu-scope :global(.method-item.method-GET) {
    color: var(--green);
  }
  .method-menu-scope :global(.method-item.method-GET:hover) {
    background: var(--green-bg-strong);
  }
  .method-menu-scope :global(.method-item.method-POST) {
    color: var(--blue);
  }
  .method-menu-scope :global(.method-item.method-POST:hover) {
    background: var(--blue-bg);
  }
  .method-menu-scope :global(.method-item.method-PUT) {
    color: var(--orange);
  }
  .method-menu-scope :global(.method-item.method-PUT:hover) {
    background: var(--orange-bg);
  }
  .method-menu-scope :global(.method-item.method-PATCH) {
    color: var(--tan);
  }
  .method-menu-scope :global(.method-item.method-PATCH:hover) {
    background: var(--tan-bg);
  }
  .method-menu-scope :global(.method-item.method-DELETE) {
    color: var(--red);
  }
  .method-menu-scope :global(.method-item.method-DELETE:hover) {
    background: var(--red-bg);
  }
  .method-menu-scope :global(.method-item.method-HEAD),
  .method-menu-scope :global(.method-item.method-OPTIONS) {
    color: var(--text-placeholder);
  }
  .action {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
  }
  .action:hover {
    background: var(--bg-lift);
  }
  .action.save.dirty {
    border-color: var(--yellow-border);
    background: var(--yellow-bg);
    color: var(--text);
  }
  .save-dot {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--orange-strong);
  }
  .action.send {
    border: none;
    background: var(--green);
    color: var(--text-on-accent);
    transition: background 0.1s ease;
  }
  .action.send:hover {
    background: var(--green-dark);
  }
  .action.send:active {
    background: var(--green-darker);
  }
  .action.cancel {
    border: none;
    background: var(--red);
    color: var(--text-on-accent);
    transition: background 0.1s ease;
  }
  .action.cancel:hover {
    background: var(--red-dark);
  }
</style>
