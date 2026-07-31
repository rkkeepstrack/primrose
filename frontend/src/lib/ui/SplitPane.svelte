<script lang="ts">
  // Generic horizontal split with a draggable divider.
  export let initialPct = 50;
  export let minPct = 20;
  export let maxPct = 80;
  // flushLeft removes the gutter between the left pane and the divider, so a
  // tinted left panel (the sidebar) runs right up to the divider line
  export let flushLeft = false;
  // when set, the divider position survives unmounts via localStorage
  export let storageKey: string | undefined = undefined;

  let host: HTMLDivElement;
  let dividerEl: HTMLDivElement;
  let pct = restore() ?? initialPct;

  function restore(): number | null {
    if (!storageKey) return null;
    const saved = Number(localStorage.getItem(`splitpane:${storageKey}`));
    return Number.isFinite(saved) && saved >= minPct && saved <= maxPct ? saved : null;
  }

  $: if (storageKey) localStorage.setItem(`splitpane:${storageKey}`, String(pct));
  let dragging = false;
  // focus given by mouse shouldn't show the keyboard focus ring; WebKit
  // treats the explicit focus() in startDrag as :focus-visible
  let mouseFocus = false;

  function clamp(p: number) {
    return Math.min(maxPct, Math.max(minPct, p));
  }

  function startDrag(e: MouseEvent) {
    // preventDefault stops text selection while dragging, but also swallows
    // the browser's focus-on-click — focus explicitly so arrow keys work
    e.preventDefault();
    mouseFocus = true;
    dividerEl.focus();
    dragging = true;
    const rect = host.getBoundingClientRect();
    const onMove = (ev: MouseEvent) => {
      pct = clamp(((ev.clientX - rect.left) / rect.width) * 100);
    };
    const onUp = () => {
      dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ARIA "window splitter": a focusable separator, resizable via arrow keys
  function onKeydown(e: KeyboardEvent) {
    mouseFocus = false; // keyboard use brings the focus ring back
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      pct = clamp(pct - 2);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      pct = clamp(pct + 2);
    }
  }
</script>

<div class="panes" bind:this={host}>
  <div class="pane" style="width: {pct}%">
    <slot name="left" />
  </div>
  <!-- ARIA APG "window splitter": a focusable separator with arrow-key
       resizing IS interactive per spec; svelte's checker doesn't model the
       focusable-separator variant, so these two warnings are false positives -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    bind:this={dividerEl}
    class="divider"
    class:flush-left={flushLeft}
    class:dragging
    class:mouse-focus={mouseFocus}
    role="separator"
    aria-orientation="vertical"
    aria-valuenow={Math.round(pct)}
    aria-valuemin={minPct}
    aria-valuemax={maxPct}
    tabindex="0"
    on:mousedown={startDrag}
    on:keydown={onKeydown}
    on:blur={() => (mouseFocus = false)}>
  </div>
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
  .divider.flush-left {
    margin-left: 0;
  }
  .divider:hover,
  .divider.dragging {
    border-left-color: var(--yellow-border);
  }
  .divider:focus-visible {
    outline: none;
    border-left: 2px solid var(--orange-strong);
  }
  .divider.mouse-focus:focus-visible {
    border-left: 1px solid var(--border-soft);
  }
  .divider.mouse-focus:focus-visible:hover {
    border-left-color: var(--yellow-border);
  }
</style>
