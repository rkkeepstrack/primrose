<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { EditorView, lineNumbers, highlightSpecialChars } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { json } from '@codemirror/lang-json';
  import {
    foldGutter,
    codeFolding,
    syntaxHighlighting,
    defaultHighlightStyle,
  } from '@codemirror/language';

  export let value: string;
  export let lang: 'json' | 'text' = 'text';

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  const theme = EditorView.theme({
    '&': { fontSize: '12.5px', height: '100%', backgroundColor: 'transparent' },
    '.cm-content': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#444' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#c4c4c4',
      border: 'none',
      borderRight: '1px solid #f0f0f0',
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-scroller': { overflow: 'auto' },
    '&.cm-focused': { outline: 'none' },
  });

  function extensions() {
    const ext = [
      lineNumbers(),
      highlightSpecialChars(),
      codeFolding(),
      foldGutter(),
      syntaxHighlighting(defaultHighlightStyle),
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
