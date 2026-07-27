<script lang="ts">
  // The response viewer's search panel — rendered into CodeMirror's panel
  // slot by the createPanel hook in CodeViewer (see searchPanel there).
  import {
    closeSearchPanel,
    findNext,
    findPrevious,
    getSearchQuery,
    SearchQuery,
    setSearchQuery,
  } from '@codemirror/search';
  import type { EditorView } from '@codemirror/view';
  import CaseSensitive from '@lucide/svelte/icons/case-sensitive';
  import ChevronDown from '@lucide/svelte/icons/chevron-down';
  import ChevronUp from '@lucide/svelte/icons/chevron-up';
  import Regex from '@lucide/svelte/icons/regex';
  import WholeWord from '@lucide/svelte/icons/whole-word';
  import X from '@lucide/svelte/icons/x';

  export let view: EditorView;

  const initial = getSearchQuery(view.state);
  let text = initial.search;
  let caseSensitive = initial.caseSensitive;
  let regexp = initial.regexp;
  let wholeWord = initial.wholeWord;

  let inputEl: HTMLInputElement;
  let total = 0;
  let current = 0;
  let invalid = false;

  // called by the Panel wrapper when CM mounts the panel / the doc changes
  export function focusInput() {
    inputEl.focus();
    inputEl.select();
    recount();
  }
  export function recount() {
    total = 0;
    current = 0;
    invalid = false;
    if (!text) return;
    try {
      const cursor = query().getCursor(view.state);
      const sel = view.state.selection.main;
      for (let step = cursor.next(); !step.done; step = cursor.next()) {
        total++;
        if (step.value.from === sel.from && step.value.to === sel.to) current = total;
        if (total >= 1000) break;
      }
    } catch {
      invalid = true; // incomplete regex while typing
    }
  }

  $: countText = !text || invalid
    ? ''
    : total === 0
      ? 'no results'
      : `${current || '–'}/${total}${total >= 1000 ? '+' : ''}`;

  function query() {
    return new SearchQuery({ search: text, caseSensitive, regexp, wholeWord });
  }
  function commit() {
    view.dispatch({ effects: setSearchQuery.of(query()) });
    recount();
  }
  function toggle(flip: () => void) {
    flip();
    commit();
  }
  function next() {
    findNext(view);
    recount();
  }
  function prev() {
    findPrevious(view);
    recount();
  }

  // CM's openSearchPanel refocuses the element carrying this attribute
  function markMainField(el: HTMLInputElement) {
    el.setAttribute('main-field', 'true');
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.shiftKey ? prev() : next();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeSearchPanel(view);
    }
  }
</script>

<div class="search">
  <input
    bind:this={inputEl}
    placeholder="Search…"
    value={text}
    use:markMainField
    on:input={(e) => { text = e.currentTarget.value; commit(); }}
    on:keydown={onKeydown}
  />
  <span class="count">{countText}</span>
  <span class="sep"></span>
  <button class:on={caseSensitive} title="Match case" on:click={() => toggle(() => (caseSensitive = !caseSensitive))}>
    <CaseSensitive size={14} strokeWidth={2} />
  </button>
  <button class:on={wholeWord} title="Whole word" on:click={() => toggle(() => (wholeWord = !wholeWord))}>
    <WholeWord size={14} strokeWidth={2} />
  </button>
  <button class:on={regexp} title="Regular expression" on:click={() => toggle(() => (regexp = !regexp))}>
    <Regex size={14} strokeWidth={2} />
  </button>
  <span class="sep"></span>
  <button title="Previous match (⇧↵)" on:click={prev}>
    <ChevronUp size={14} strokeWidth={2} />
  </button>
  <button title="Next match (↵)" on:click={next}>
    <ChevronDown size={14} strokeWidth={2} />
  </button>
  <button title="Close (Esc)" on:click={() => closeSearchPanel(view)}>
    <X size={14} strokeWidth={2} />
  </button>
</div>

<style>
  .search {
    display: flex;
    align-items: center;
    gap: 3px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
    padding: 5px 6px;
  }
  input {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 3px 8px;
    width: 170px;
    outline: none;
    margin-right: 3px;
  }
  input:focus {
    border-color: var(--yellow-border);
  }
  .count {
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 11px;
    color: var(--text-muted);
    min-width: 52px;
    text-align: center;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .sep {
    width: 1px;
    height: 16px;
    background: var(--border-faint);
    margin: 0 3px;
  }
  button {
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: #999;
    cursor: pointer;
    padding: 3px;
    border-radius: 5px;
  }
  button:hover,
  button.on {
    color: var(--green);
    background: var(--green-bg);
  }
</style>
