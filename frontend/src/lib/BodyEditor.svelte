<script lang="ts">
  import CodeEditor from './CodeEditor.svelte';
  import { setBodyContent, setBodyType } from './requestEdit';
  import { request } from './workspace/state';
</script>

{#if $request}
  <div class="body-switch">
    <button class:on={$request.body.type === 'json'} on:click={() => setBodyType('json')}>json</button>
    <span class="sep">|</span>
    <button class:on={$request.body.type === 'text'} on:click={() => setBodyType('text')}>text</button>
  </div>
  <CodeEditor
    value={$request.body.content}
    lang={$request.body.type}
    placeholder="Enter text here…"
    onChange={setBodyContent}
  />
{/if}

<style>
  .body-switch {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: #bbb;
  }
  .body-switch button {
    border: none;
    background: none;
    font-size: 13px;
    font-family: inherit;
    color: #bbb;
    cursor: pointer;
    padding: 2px 4px;
  }
  .body-switch button.on {
    color: var(--green);
    font-weight: 600;
  }
</style>
