<script lang="ts">
  import X from '@lucide/svelte/icons/x';
  // The collection's session cookie jar: inspect, delete, clear, add.
  import { onMount } from 'svelte';
  import { addCookie, clearAllCookies, deleteCookie, loadCookies, type Cookie } from '../workspace/cookies';

  export let root: string;

  let cookies: Cookie[] = [];
  let draft = { domain: '', name: '', value: '' };

  async function refresh() {
    cookies = await loadCookies(root);
  }
  onMount(refresh);

  async function remove(c: Cookie) {
    await deleteCookie(root, c);
    await refresh();
  }

  async function clearAll() {
    await clearAllCookies(root);
    await refresh();
  }

  async function add() {
    if (!draft.domain.trim() || !draft.name.trim()) return;
    await addCookie(root, draft);
    draft = { domain: '', name: '', value: '' };
    await refresh();
  }

  function fmtExpiry(iso: string): string {
    return iso ? new Date(iso).toLocaleString() : 'session';
  }
</script>

<div class="cookies">
  <div class="head">
    <h3>Session cookies</h3>
    <div class="head-actions">
      <button class="plain" on:click={refresh}>Refresh</button>
      {#if cookies.length > 0}
        <button class="plain danger" on:click={clearAll}>Clear all</button>
      {/if}
    </div>
  </div>
  <p class="note">
    Collected from Set-Cookie responses and re-sent automatically on matching requests. Session-only — never written to files.
  </p>

  {#if cookies.length === 0}
    <p class="empty">No cookies yet — they appear once a response sets one.</p>
  {:else}
    <table class="kv-table">
      <thead>
        <tr><th>Domain</th><th>Path</th><th>Name</th><th>Value</th><th>Expires</th><th>Flags</th><th></th></tr>
      </thead>
      <tbody>
        {#each cookies as c (c.domain + c.path + c.name)}
          <tr>
            <td>{c.hostOnly ? c.domain : `.${c.domain}`}</td>
            <td>{c.path}</td>
            <td>{c.name}</td>
            <td class="val" title={c.value}>{c.value}</td>
            <td>{fmtExpiry(c.expires)}</td>
            <td class="flags">{[c.secure && 'secure', c.httpOnly && 'httpOnly'].filter(Boolean).join(' ')}</td>
            <td class="actions">
              <button class="remove" title="Delete cookie" on:click={() => remove(c)}><X size={13} strokeWidth={2} /></button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <h4 class="add-title">Add cookie</h4>
  <div class="add-row">
    <input class="text-input" placeholder="domain (e.g. api.x.io)" bind:value={draft.domain} />
    <input class="text-input" placeholder="name" bind:value={draft.name} />
    <input class="text-input grow" placeholder="value" bind:value={draft.value} />
    <button class="btn-save" class:dirty={draft.domain.trim() && draft.name.trim()} on:click={add}> Add </button>
  </div>
</div>

<style>
  .cookies {
    padding: 20px 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 900px;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .head h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-soft);
  }
  .head-actions {
    display: flex;
    gap: 8px;
  }
  .plain {
    border: none;
    background: none;
    font-size: 12px;
    font-family: inherit;
    color: var(--text-muted);
    cursor: pointer;
    padding: 3px 8px;
    border-radius: 5px;
  }
  .plain:hover {
    background: var(--bg-hover);
  }
  .plain.danger {
    color: var(--red);
  }
  .plain.danger:hover {
    background: var(--red-bg);
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--text-disabled);
  }
  .empty {
    color: var(--text-disabled);
    font-size: 13px;
  }
  .kv-table td.val {
    max-width: 220px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--mono);
    font-size: 12px;
  }
  .kv-table td.flags {
    font-size: 11px;
    color: var(--text-faint);
  }
  .kv-table td.actions {
    width: 34px;
    text-align: center;
  }
  .remove {
    display: flex;
    align-items: center;
    border: none;
    background: none;
    color: var(--text-ghost);
    cursor: pointer;
    padding: 4px 8px;
  }
  .remove:hover {
    color: var(--red);
  }
  .add-title {
    margin: 12px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--green-text);
  }
  .add-row {
    display: flex;
    gap: 8px;
  }
  .add-row .text-input {
    width: 180px;
  }
  .add-row .grow {
    flex: 1;
    width: auto;
  }
  .add-row .btn-save {
    font-size: 13px;
    padding: 0 16px;
  }
</style>
