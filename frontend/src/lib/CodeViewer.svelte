<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, lineNumbers, highlightSpecialChars } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { json } from '@codemirror/lang-json';
  import { foldGutter, codeFolding, syntaxHighlighting } from '@codemirror/language';
  import { indentationMarkers } from '@replit/codemirror-indentation-markers';
  import { jsonHighlightStyle } from './jsonHighlight';

  export let value: string;
  export let lang: 'json' | 'text' = 'text';

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  const theme = EditorView.theme({
    '&': { fontSize: '11px', height: '100%', backgroundColor: 'transparent' },
    '.cm-content': {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      color: '#444',
      lineHeight: '1.65',
      padding: '8px 12px',
    },
    // no per-line padding: it breaks indentation-marker alignment
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#b8b8b8',
      border: 'none',
      borderRight: '1px solid #eee',
      lineHeight: '1.65',
      paddingTop: '8px',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 14px', minWidth: '32px' },
    '.cm-foldGutter .cm-gutterElement': { padding: '0 6px 0 2px' },
    '.cm-foldPlaceholder': {
      background: 'transparent',
      border: 'none',
      color: '#999',
      fontStyle: 'italic',
      padding: '0 2px',
      cursor: 'pointer',
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-scroller': { overflow: 'auto' },
    '&.cm-focused': { outline: 'none' },
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
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === '{' || c === '[') depth++;
      else if (c === '}' || c === ']') depth--;
      else if (c === ',' && depth === 0) count++;
    }
    return count;
  }

  // small gray disclosure triangles, DevTools style
  function foldMarker(open: boolean): HTMLElement {
    const el = document.createElement('span');
    el.style.cssText =
      'display:inline-flex;align-items:center;justify-content:center;' +
      'width:12px;height:12px;cursor:pointer;color:#9a9a9a;';
    el.innerHTML =
      `<svg width="8" height="8" viewBox="0 0 8 8" style="transform:rotate(${open ? 90 : 0}deg)">` +
      '<path d="M1.5 0.5 L6.5 4 L1.5 7.5 Z" fill="currentColor"/></svg>';
    return el;
  }

  function extensions() {
    const ext = [
      lineNumbers(),
      highlightSpecialChars(),
      codeFolding({
        preparePlaceholder: (state, range) =>
          countDirectItems(state.sliceDoc(range.from, range.to)),
        placeholderDOM: (view, onclick, prepared) => {
          const el = document.createElement('span');
          el.className = 'cm-foldPlaceholder';
          el.textContent =
            prepared > 0 ? `… // ${prepared} ${prepared === 1 ? 'item' : 'items'}` : '…';
          el.onclick = onclick;
          return el;
        },
      }),
      foldGutter({ markerDOM: foldMarker }),
      syntaxHighlighting(jsonHighlightStyle),
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
      theme,
    ];
    if (lang === 'json') {
      ext.push(
        json(),
        // vertical guides connecting matching brackets across nesting levels
        indentationMarkers({
          hideFirstIndent: true,
          colors: { light: '#e4e4e4', activeLight: '#c8c8c8' },
        })
      );
    }
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

  let lastValue = value;
  let lastLang = lang;
  $: if (view && (value !== lastValue || lang !== lastLang)) {
    lastValue = value;
    lastLang = lang;
    createView();
  }
</script>

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
