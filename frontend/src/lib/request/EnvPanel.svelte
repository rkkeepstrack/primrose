<script lang="ts">
  // The request-level Variables tab: dynamic :vars (saved with the request,
  // like environment variables at request scope) first, then the {{env}}
  // variables this call uses — editable, with an explicit save that writes
  // to the current environment file. Missing variables can be filled in and
  // are created on save.
  import { extractDynamicVars, extractEnvVars } from './vars';
  import { setVar } from './requestEdit';
  import { saveEnvironment } from '../workspace/environments';
  import { activeEnvName, activeEnvVars, activeRoot, envs, inheritedHeaders, request, selectedPath } from '../workspace/state';

  $: usedEnvVars = $request ? extractEnvVars($request, Object.values($inheritedHeaders)) : [];
  $: usedDynamicVars = $request ? extractDynamicVars($request) : [];
  $: dynValues = $request?.vars ?? {};

  // draft of edited env values, keyed by var name; reset when the request
  // or the active environment changes
  let draft: Record<string, string> = {};
  let draftKey = '';
  $: {
    const key = `${$selectedPath ?? ''}|${$activeEnvName ?? ''}`;
    if (key !== draftKey) {
      draftKey = key;
      draft = {};
    }
  }

  $: dirty = usedEnvVars.some(
    (name) => draft[name] !== undefined && draft[name] !== ($activeEnvVars[name] ?? '')
  );

  async function save() {
    const merged = { ...$activeEnvVars };
    for (const name of usedEnvVars) {
      if (draft[name] !== undefined) merged[name] = draft[name];
    }
    if ($activeEnvName && $activeRoot) {
      const headers = $envs.find((e) => e.name === $activeEnvName)?.headers ?? {};
      await saveEnvironment($activeRoot, $activeEnvName, merged, headers);
      draft = {};
    }
  }
</script>

<h4 class="heading">Dynamic variables in this call</h4>
{#if usedDynamicVars.length === 0}
  <p class="empty">No <span class="var-token">:dynamicVariables</span> in this request.</p>
{:else}
  <table class="kv-table vars-table">
    <thead><tr><th>Name</th><th>Value</th></tr></thead>
    <tbody>
      {#each usedDynamicVars as name (name)}
        <tr>
          <td>{name}</td>
          <td class="cell-input">
            <input
              placeholder="value… (saved with the request)"
              value={dynValues[name] ?? ''}
              on:input={(e) => setVar(name, e.currentTarget.value)}
            />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="note">Dynamic values are saved with the request (⌘S) — like environment variables, scoped to this call.</p>
{/if}

<div class="env-head">
  <h4 class="heading">Environment variables in this call</h4>
  {#if usedEnvVars.length > 0 && $activeEnvName}
    <button class="save btn-save" class:dirty disabled={!dirty} on:click={save}>
      Save to {$activeEnvName}{dirty ? ' •' : ''}
    </button>
  {/if}
</div>
{#if usedEnvVars.length === 0}
  <p class="empty">No <span class="var-token">{'{{variables}}'}</span> used in this request.</p>
{:else}
  <table class="kv-table vars-table">
    <thead><tr><th>Name</th><th>Value</th></tr></thead>
    <tbody>
      {#each usedEnvVars as name (name)}
        {@const missing = $activeEnvVars[name] === undefined && draft[name] === undefined}
        <tr>
          <td>{name}</td>
          <td class="cell-input" class:missing>
            <input
              placeholder={missing ? 'not set — enter to create…' : ''}
              value={draft[name] ?? $activeEnvVars[name] ?? ''}
              on:input={(e) => (draft = { ...draft, [name]: e.currentTarget.value })}
            />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<style>
  .heading {
    margin: 6px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--green-text);
  }
  .env-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 560px;
    gap: 12px;
  }
  .var-token {
    color: var(--green-text);
    font-weight: 600;
  }
  .vars-table { max-width: 560px; }
  .vars-table td.cell-input { padding: 0; }
  .vars-table td.cell-input input {
    width: 100%;
    box-sizing: border-box;
    border: none;
    padding: 7px 12px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-soft);
    background: transparent;
  }
  .vars-table td.cell-input input:focus {
    outline: none;
    background: var(--yellow-bg);
  }
  .vars-table td.cell-input.missing input::placeholder {
    color: var(--red);
    font-style: italic;
  }
  .save {
    font-size: 12px;
    padding: 4px 12px;
    white-space: nowrap;
  }
  .empty { color: var(--text-disabled); font-size: 13px; }
  .note { color: #bbb; font-size: 12px; margin: 0; }
</style>
