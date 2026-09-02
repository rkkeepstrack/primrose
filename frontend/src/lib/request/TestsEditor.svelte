<script lang="ts">
  // The request's post-response assertion script (Starlark, Python syntax).
  // Runs sandboxed in the Go backend after each send; {{env}} vars resolve
  // in the script text like they do in bodies.
  import CodeEditor from '../editor/CodeEditor.svelte';
  import { setTestScript } from './requestEdit';
  import { activeEnvVars, request } from '../workspace/state';
</script>

{#if $request}
  <CodeEditor
    value={$request.tests?.script ?? ''}
    onChange={setTestScript}
    lang="python"
    envVars={$activeEnvVars}
    placeholder={'assert res.status == 200\nassert "json" in res.headers["content-type"]'} />
  <p class="hint">Starlark (Python syntax). Each top-level assert becomes one result; res has status, headers, body, duration_ms, size, url.</p>
{/if}

<style>
  .hint {
    color: var(--text-ghost);
    font-size: 12px;
    margin: 0;
  }
</style>
