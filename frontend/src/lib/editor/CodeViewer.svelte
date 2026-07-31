<script lang="ts">
  import { onMount, onDestroy, mount, unmount, flushSync } from 'svelte';
  import { EditorView, keymap, lineNumbers, highlightSpecialChars, type Panel } from '@codemirror/view';
  import { highlightSelectionMatches, openSearchPanel, search, searchKeymap } from '@codemirror/search';
  import SearchPanel from './SearchPanel.svelte';
  import { EditorState } from '@codemirror/state';
  import { json } from '@codemirror/lang-json';
  import { foldGutter, codeFolding, syntaxHighlighting, foldedRanges } from '@codemirror/language';
  import { Decoration, WidgetType } from '@codemirror/view';
  import { RangeSetBuilder, StateField } from '@codemirror/state';
  import { jsonHighlightStyle } from './jsonHighlight';

  export let value: string;
  export let lang: 'json' | 'text' = 'text';

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  const theme = EditorView.theme({
    '&': { fontSize: '11px', height: '100%', backgroundColor: 'transparent' },
    '.cm-content': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      color: 'var(--text-soft)',
      lineHeight: '1.65',
      padding: '8px 12px',
    },
    // no per-line padding: it breaks indentation-marker alignment
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--editor-gutter)',
      border: 'none',
      borderRight: '1px solid var(--border-faint)',
      lineHeight: '1.65',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 14px', minWidth: '32px' },
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 6px 0 2px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    '.cm-foldPlaceholder': {
      background: 'var(--bg-hover)',
      border: '1px solid var(--border-soft)',
      color: 'var(--text-faint)',
      borderRadius: '4px',
      padding: '0 5px',
      margin: '0 2px',
      cursor: 'pointer',
    },
    '.cm-fold-count': {
      color: 'var(--text-placeholder)',
      fontStyle: 'italic',
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-scroller': { overflow: 'auto' },
    '&.cm-focused': { outline: 'none' },
    // search floats in the top-right corner instead of pushing content down
    '.cm-panels.cm-panels-top': {
      position: 'absolute',
      top: '4px',
      right: '14px',
      left: 'auto',
      zIndex: '20',
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text)',
    },
    '.cm-searchMatch': { backgroundColor: 'rgba(240, 213, 90, 0.4)' },
    '.cm-searchMatch-selected': { backgroundColor: 'rgba(232, 169, 76, 0.55)' },
  });

  // count the folded region's direct children (top-level commas at depth 0),
  // ignoring anything nested or inside strings
  function countDirectItems(text: string): number {
    if (!text.trim()) return 0;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let count = 1;
    for (const c of text) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (c === '\\') {
        escaped = true;
        continue;
      }
      if (c === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      else if (c === ',' && depth === 0) count++;
    }
    return count;
  }

  // renders " // N items" after the closing bracket of each folded region
  class FoldCountWidget extends WidgetType {
    constructor(readonly count: number) {
      super();
    }
    eq(other: FoldCountWidget) {
      return other.count === this.count;
    }
    toDOM() {
      const el = document.createElement('span');
      el.className = 'cm-fold-count';
      el.textContent = ` // ${this.count} ${this.count === 1 ? 'item' : 'items'}`;
      return el;
    }
  }

  function buildFoldCounts(state: EditorState) {
    const widgets: { pos: number; count: number }[] = [];
    foldedRanges(state).between(0, state.doc.length, (from, to) => {
      const count = countDirectItems(state.sliceDoc(from, to));
      if (count === 0) return;
      // place the note after the closing bracket (and a trailing comma)
      let pos = to;
      const line = state.doc.lineAt(to);
      if (pos < line.to && '}]'.includes(state.sliceDoc(pos, pos + 1))) pos++;
      if (pos < line.to && state.sliceDoc(pos, pos + 1) === ',') pos++;
      widgets.push({ pos, count });
    });
    // widget positions (after closing brackets) are not in fold-start order
    // when folds nest — RangeSetBuilder requires sorted adds
    widgets.sort((a, b) => a.pos - b.pos);
    const builder = new RangeSetBuilder<Decoration>();
    for (const w of widgets) {
      builder.add(w.pos, w.pos, Decoration.widget({ widget: new FoldCountWidget(w.count), side: 1 }));
    }
    return builder.finish();
  }

  // a StateField (not a ViewPlugin): derived purely from state, so it can
  // never go stale when fold ranges elsewhere in the doc change
  const foldCountField = StateField.define({
    create: buildFoldCounts,
    update: (_, tr) => buildFoldCounts(tr.state),
    provide: (f) => EditorView.decorations.from(f),
  });

  // CM panel wrapper around the SearchPanel Svelte component
  function searchPanel(view: EditorView): Panel {
    const dom = document.createElement('div');
    // flushSync: CM calls Panel.mount() synchronously right after this, and
    // the component's bindings must exist by then
    const panel = flushSync(() => mount(SearchPanel, { target: dom, props: { view } }));
    return {
      dom,
      top: true,
      mount: () => panel.focusInput(),
      update: (u) => {
        if (u.docChanged || u.selectionSet) panel.recount();
      },
      destroy: () => unmount(panel),
    };
  }

  // small gray disclosure triangles, DevTools style
  function foldMarker(open: boolean): HTMLElement {
    const el = document.createElement('span');
    el.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;' +
      'width:14px;height:14px;cursor:pointer;color:var(--text-placeholder);';
    el.innerHTML =
      `<svg width="9" height="9" viewBox="0 0 8 8" style="transform:rotate(${open ? 90 : 0}deg)">` +
      '<path d="M1.5 0.5 L6.5 4 L1.5 7.5 Z" fill="currentColor"/></svg>';
    return el;
  }

  function extensions() {
    const ext = [
      lineNumbers(),
      highlightSpecialChars(),
      codeFolding(),
      foldGutter({ markerDOM: foldMarker }),
      foldCountField,
      syntaxHighlighting(jsonHighlightStyle),
      search({ top: true, createPanel: searchPanel }),
      keymap.of(searchKeymap),
      highlightSelectionMatches(),
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
      theme,
    ];
    if (lang === 'json') ext.push(json());
    return ext;
  }

  function createView() {
    view?.destroy();
    view = new EditorView({
      parent: host,
      state: EditorState.create({ doc: value, extensions: extensions() }),
    });
  }

  onMount(createView);
  onDestroy(() => view?.destroy());

  // ⌘F opens the search panel even when the viewer isn't focused, but stays
  // out of the way while the user is typing somewhere else
  function onGlobalKeydown(e: KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey) || e.key !== 'f' || !view) return;
    const t = e.target as HTMLElement;
    const typingElsewhere = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || (t.closest('.cm-editor') !== null && !host.contains(t));
    if (typingElsewhere) return;
    e.preventDefault();
    openSearchPanel(view);
  }

  let lastValue = value;
  let lastLang = lang;
  $: if (view && (value !== lastValue || lang !== lastLang)) {
    lastValue = value;
    lastLang = lang;
    createView();
  }
</script>

<svelte:window on:keydown={onGlobalKeydown} />

<div class="viewer" bind:this={host}></div>

<style>
  .viewer {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  .viewer :global(.cm-editor) {
    height: 100%;
  }
</style>
