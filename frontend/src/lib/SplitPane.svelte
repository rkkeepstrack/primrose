<script lang="ts">
  // Generic horizontal split with a draggable divider.
  export let initialPct = 50;
  export let minPct = 20;
  export let maxPct = 80;

  let host: HTMLDivElement;
  let pct = initialPct;

  function startDrag(e: MouseEvent) {
    e.preventDefault();
    const rect = host.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      const p = ((ev.clientX - rect.left) / rect.width) * 100;
      pct = Math.min(maxPct, Math.max(minPct, p));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
</script>

<div class="panes" bind:this={host}>
  <div class="pane" style="width: {pct}%">
    <slot name="left" />
  </div>
  <div class="divider" role="separator" aria-orientation="vertical" on:mousedown={startDrag}></div>
  <div class="pane grow">
    <slot name="right" />
  </div>
</div>

<style>
  .panes {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .pane {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
  }
  .pane.grow {
    flex: 1;
  }
  .divider {
    flex-shrink: 0;
    width: 5px;
    margin: 0 10px;
    cursor: col-resize;
    border-left: 1px solid var(--border-soft);
  }
  .divider:hover {
    border-left-color: var(--yellow-border);
  }
</style>
