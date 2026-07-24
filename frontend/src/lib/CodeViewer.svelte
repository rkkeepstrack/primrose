<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, lineNumbers, highlightSpecialChars } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { json } from '@codemirror/lang-json';
  import {
    foldGutter,
    codeFolding,
    syntaxHighlighting,
    foldedRanges,
  } from '@codemirror/language';
  import { Decoration, WidgetType, ViewPlugin, type ViewUpdate } from '@codemirror/view';
  import { RangeSetBuilder } from '@codemirror/state';
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
      background: '#f5f5f5',
      border: '1px solid #e5e5e5',
      color: '#888',
      borderRadius: '4px',
      padding: '0 5px',
      margin: '0 2px',
      cursor: 'pointer',
    },
    '.cm-fold-count': {
      color: '#999',
      fontStyle: 'italic',
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

  const foldCountPlugin = ViewPlugin.fromClass(
    class {
      decorations = Decoration.none;
      constructor(v: EditorView) {
        this.decorations = this.build(v);
      }
      update(u: ViewUpdate) {
        this.decorations = this.build(u.view);
      }
      build(v: EditorView) {
        const builder = new RangeSetBuilder<Decoration>();
        foldedRanges(v.state).between(0, v.state.doc.length, (from, to) => {
          const count = countDirectItems(v.state.sliceDoc(from, to));
          if (count === 0) return;
          // place the note after the closing bracket (and a trailing comma)
          let pos = to;
          const line = v.state.doc.lineAt(to);
          if (pos < line.to && '}]'.includes(v.state.sliceDoc(pos, pos + 1))) pos++;
          if (pos < line.to && v.state.sliceDoc(pos, pos + 1) === ',') pos++;
          builder.add(pos, pos, Decoration.widget({ widget: new FoldCountWidget(count), side: 1 }));
        });
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations }
  );

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
      codeFolding(),
      foldGutter({ markerDOM: foldMarker }),
      foldCountPlugin,
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
