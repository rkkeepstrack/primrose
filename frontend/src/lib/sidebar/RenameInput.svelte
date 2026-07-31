<script lang="ts">
  // In-place rename field for tree rows: italic input pre-filled with the
  // current name. Enter or blur commits, Escape aborts.
  export let name: string;
  export let onCommit: (name: string) => void;
  export let onCancel: () => void;

  let committed = false;

  function focusSelect(el: HTMLInputElement) {
    el.focus();
    el.select();
  }

  function commit(e: Event) {
    if (committed) return;
    committed = true;
    onCommit((e.target as HTMLInputElement).value);
  }

  function keydown(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commit(e);
    } else if (e.key === 'Escape') {
      e.preventDefault(); // unhandled Escape would beep (native responder chain)
      committed = true; // abort: swallow the blur that follows
      onCancel();
    }
  }
</script>

<input class="rename-input" value={name} use:focusSelect on:keydown={keydown} on:blur={commit} />

<style>
  .rename-input {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    padding: 0;
    font-size: 13px;
    font-family: inherit;
    font-style: italic;
    color: var(--text-strong);
    outline: none;
  }
</style>
