<script lang="ts">
  // Name row for an unsaved request draft; Enter saves.
  import { saveRequest } from '../workspace/requests';
  import { draftName } from '../workspace/state';
</script>

<div class="draft-row">
  <span class="draft-label">New request</span>
  <!-- svelte-ignore a11y_autofocus -->
  <input
    class="draft-name text-input"
    placeholder="request name…"
    value={$draftName}
    autofocus
    on:input={(e) => draftName.set(e.currentTarget.value)}
    on:keydown={(e) => e.key === 'Enter' && saveRequest()} />
  <span class="draft-hint">saved as {$draftName || 'name'}.toml on Save</span>
</div>

<style>
  .draft-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .draft-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--yellow-text);
    background: var(--yellow-bg);
    border-radius: 4px;
    padding: 3px 8px;
  }
  .draft-name {
    border-color: var(--yellow-border);
    width: 240px;
  }
  .draft-name:focus {
    background: var(--yellow-bg-light);
  }
  .draft-hint {
    font-size: 12px;
    color: #bbb;
  }
</style>
