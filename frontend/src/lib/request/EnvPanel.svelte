<script lang="ts">
  // The request-level Env tab: which {{env}} and /:dynamic variables this
  // call uses, with session-only editing for the dynamic ones.
  import { extractDynamicVars, extractEnvVars } from './vars';
  import { dynamicVars, setDynamicVar } from '../shared/stores';
  import { activeEnvVars, request, selectedPath } from '../workspace/state';

  $: usedEnvVars = $request ? extractEnvVars($request) : [];
  $: usedDynamicVars = $request ? extractDynamicVars($request) : [];
  $: dynValues = ($selectedPath && $dynamicVars[$selectedPath]) || {};
</script>

<h4 class="env-heading">Environment variables in this call</h4>
{#if usedEnvVars.length === 0}
  <p class="empty">No <span class="var-token">{'{{variables}}'}</span> used in this request.</p>
{:else}
  <table class="kv-table env-table">
    <thead><tr><th>Name</th><th>Value</th></tr></thead>
    <tbody>
      {#each usedEnvVars as name (name)}
        <tr>
          <td>{name}</td>
          {#if $activeEnvVars[name] !== undefined}
            <td>{$activeEnvVars[name]}</td>
          {:else}
            <td class="missing">not set in current environment</td>
          {/if}
        </tr>
      {/each}
    </tbody>
  </table>
{/if}

<h4 class="env-heading">Dynamic variables in this call</h4>
{#if usedDynamicVars.length === 0}
  <p class="empty">No <span class="var-token">:dynamicVariables</span> in this request.</p>
{:else}
  <table class="kv-table env-table">
    <thead><tr><th>Name</th><th>Value</th></tr></thead>
    <tbody>
      {#each usedDynamicVars as name (name)}
        <tr>
          <td>{name}</td>
          <td class="dyn-cell">
            <input
              placeholder="session value…"
              value={dynValues[name] ?? ''}
              on:input={(e) => $selectedPath && setDynamicVar($selectedPath, name, e.currentTarget.value)}
            />
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="dyn-note">Dynamic values live in this session only — they are never saved to files.</p>
{/if}

<style>
  .env-heading {
    margin: 6px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--green-text);
  }
  .var-token {
    color: var(--green-text);
    font-weight: 600;
  }
  .env-table { max-width: 560px; }
  .env-table td.missing {
    color: var(--red);
    font-style: italic;
  }
  .env-table td.dyn-cell { padding: 0; }
  .env-table td.dyn-cell input {
    width: 100%;
    box-sizing: border-box;
    border: none;
    padding: 7px 12px;
    font-size: 13px;
    font-family: inherit;
    color: var(--text-soft);
    background: transparent;
  }
  .env-table td.dyn-cell input:focus {
    outline: none;
    background: var(--yellow-bg);
  }
  .empty { color: var(--text-disabled); font-size: 13px; }
  .dyn-note { color: #bbb; font-size: 12px; margin: 0; }
</style>
