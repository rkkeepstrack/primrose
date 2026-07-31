<script lang="ts">
  // Banner shown when the open request changed on disk under unsaved edits.
  import { keepMyEdits, reloadFromDisk } from '../workspace/sync';
</script>

<div class="disk-notice">
  <span>This request changed on disk while you have unsaved edits.</span>
  <button class="notice-btn" on:click={reloadFromDisk}>Load disk version</button>
  <button class="notice-btn keep" on:click={keepMyEdits}>Keep my edits</button>
</div>

<style>
  .disk-notice {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12.5px;
    color: var(--yellow-text);
    background: var(--yellow-bg);
    border: 1px solid var(--yellow-border);
    border-radius: 6px;
    padding: 6px 12px;
  }
  .notice-btn {
    border: 1px solid var(--yellow-border);
    border-radius: 5px;
    background: #fff;
    font-size: 12px;
    font-family: inherit;
    color: var(--text);
    cursor: pointer;
    padding: 3px 10px;
  }
  .notice-btn:hover {
    background: var(--yellow-bg-light);
  }
  .notice-btn.keep {
    margin-left: auto;
  }
</style>
