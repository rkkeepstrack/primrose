<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    EditorView,
    MatchDecorator,
    Decoration,
    ViewPlugin,
    type DecorationSet,
    type ViewUpdate,
    keymap,
    placeholder as cmPlaceholder,
  } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { json } from '@codemirror/lang-json';
  import { syntaxHighlighting } from '@codemirror/language';
  import { jsonHighlightStyle } from './jsonHighlight';

  export let value: string;
  export let onChange: (value: string) => void;
  export let singleLine = false;
  export let lang: 'json' | 'text' = 'text';
  export let placeholder = '';

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  // {{envVar}} and /:dynamicVar tinted green, per the mockups
  const varMatcher = new MatchDecorator({
    regexp: /(\{\{[A-Za-z_][A-Za-z0-9_]*\}\})|(\/(:[A-Za-z_][A-Za-z0-9_]*))/g,
    decoration: (m) =>
      m[1]
        ? Decoration.mark({ class: 'cm-primrose-var' })
        : Decoration.mark({ class: 'cm-primrose-dynvar' }),
  });

  const varHighlighter = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(v: EditorView) {
        this.decorations = varMatcher.createDeco(v);
      }
      update(u: ViewUpdate) {
        this.decorations = varMatcher.updateDeco(u, this.decorations);
      }
    },
    { decorations: (v) => v.decorations }
  );

  const theme = EditorView.theme({
    '&': { fontSize: '13px', backgroundColor: 'transparent' },
    '.cm-content': {
      fontFamily: singleLine
        ? 'inherit'
        : 'ui-monospace, SFMono-Regular, Menlo, monospace',
      color: '#444',
      padding: singleLine ? '5px 4px' : '8px 4px',
    },
    '.cm-line': { padding: '0 2px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-primrose-var': { color: '#3d9469', fontWeight: '600' },
    '.cm-primrose-dynvar': { color: '#3d9469', fontWeight: '600' },
    '.cm-placeholder': { color: '#bbb' },
  });

  function extensions() {
    const ext = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      varHighlighter,
      theme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged) onChange(u.state.doc.toString());
      }),
    ];
    if (placeholder) ext.push(cmPlaceholder(placeholder));
    if (singleLine) {
      // block newlines entirely (paste included)
      ext.push(
        EditorState.transactionFilter.of((tr) =>
          tr.newDoc.lines > 1 ? [] : tr
        )
      );
    } else {
      ext.push(EditorView.lineWrapping);
      if (lang === 'json') {
        ext.push(json(), syntaxHighlighting(jsonHighlightStyle));
      }
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

  // External value changes (request switch) — rebuild only if it differs from
  // what the editor already holds, so typing isn't disrupted.
  $: if (view && value !== view.state.doc.toString()) {
    createView();
  }

  let lastLang = lang;
  $: if (view && lang !== lastLang) {
    lastLang = lang;
    createView();
  }
</script>

<div class="editor" class:single={singleLine} bind:this={host}></div>

<style>
  .editor {
    min-width: 0;
  }
  .editor.single {
    flex: 1;
  }
  .editor:not(.single) {
    border: 1px solid #ddd;
    border-radius: 8px;
    min-height: 220px;
    overflow: hidden;
  }
  .editor:not(.single) :global(.cm-editor) {
    min-height: 220px;
  }
  .editor:not(.single):focus-within {
    border-color: #ecdfa8;
  }
  .editor :global(.cm-scroller) {
    overflow-x: auto;
  }
</style>
