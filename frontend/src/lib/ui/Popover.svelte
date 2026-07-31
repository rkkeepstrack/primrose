<script lang="ts">
  // Shared popup shell: a trigger slot plus a floating card. The card is
  // position:fixed and measured against the viewport, so scroll containers
  // can never clip it (the bug bespoke absolute-positioned menus had), and
  // it flips above the trigger when there is no room below.
  import { tick } from 'svelte';

  // 'manual': the caller drives `open` (bind:open), e.g. for confirmations
  export let trigger: 'click' | 'hover' | 'manual' = 'click';
  export let placement: 'bottom-start' | 'bottom-end' = 'bottom-start';
  export let open = false;
  // > 0: the popup closes itself this many ms after opening
  export let autoDismissMs = 0;

  const GAP = 4; // px between trigger and card
  const HOVER_CLOSE_DELAY = 120; // ms to bridge the gap on the way to the card

  let wrapEl: HTMLElement;
  let popEl: HTMLElement | null = null;
  let top = 0;
  let left = 0;
  let ready = false;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let dismissTimer: ReturnType<typeof setTimeout> | null = null;

  // edge-triggered on open (a plain $: on `open` would also depend on the
  // timer variable it assigns, re-triggering itself)
  let wasOpen = false;
  $: if (open !== wasOpen) {
    wasOpen = open;
    if (open && autoDismissMs > 0) scheduleDismiss();
  }
  // fade out with plain CSS before actually closing
  const FADE_MS = 350;
  let fading = false;
  function scheduleDismiss() {
    if (dismissTimer) clearTimeout(dismissTimer);
    fading = false;
    dismissTimer = setTimeout(() => {
      fading = true;
      dismissTimer = setTimeout(() => {
        fading = false;
        open = false;
      }, FADE_MS);
    }, autoDismissMs);
  }

  async function position() {
    await tick();
    if (!popEl || !wrapEl) return;
    // the wrap is display:contents (no box of its own, so it never disturbs
    // the caller's layout) — measure the trigger element instead
    const anchor = (wrapEl.querySelector(':scope > *:not(.popover-card)') ?? wrapEl) as HTMLElement;
    const r = anchor.getBoundingClientRect();
    const p = popEl.getBoundingClientRect();
    let t = r.bottom + GAP;
    if (t + p.height > window.innerHeight && r.top - p.height - GAP > 0) {
      t = r.top - p.height - GAP; // flip above
    }
    let l = placement === 'bottom-end' ? r.right - p.width : r.left;
    l = Math.max(4, Math.min(l, window.innerWidth - p.width - 4));
    top = t;
    left = l;
    ready = true;
  }

  // hide only the first, not-yet-positioned frame; on close the card must
  // stay visible so the out-transition (fade) is actually seen
  $: if (open) {
    ready = false;
    position();
  }

  function cancelClose() {
    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = null;
  }
  function onEnter() {
    if (trigger !== 'hover') return;
    cancelClose();
    open = true;
  }
  function onLeave() {
    if (trigger !== 'hover') return;
    cancelClose();
    closeTimer = setTimeout(() => (open = false), HOVER_CLOSE_DELAY);
  }
  function onClick(e: MouseEvent) {
    if (trigger !== 'click') return;
    e.stopPropagation(); // the window listener would immediately re-close
    open = !open;
  }
</script>

<svelte:window
  on:click={() => trigger === 'click' && (open = false)}
  on:keydown={(e) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault(); // unhandled Escape would beep (native responder chain)
      open = false;
    }
  }} />

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
<div class="pop-wrap" bind:this={wrapEl} on:mouseenter={onEnter} on:mouseleave={onLeave} on:click={onClick}>
  <slot name="trigger" />
  {#if open}
    <div
      class="popover-card"
      class:fading
      bind:this={popEl}
      style="top: {top}px; left: {left}px; visibility: {ready ? 'visible' : 'hidden'}">
      <slot />
    </div>
  {/if}
</div>

<style>
  .pop-wrap {
    display: contents;
  }
  /* visuals come from the global .popover-card class */
  div.popover-card {
    position: fixed;
    z-index: 40;
    transition: opacity 350ms linear;
  }
  div.popover-card.fading {
    opacity: 0;
  }
</style>
