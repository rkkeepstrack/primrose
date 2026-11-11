<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { drawSelection, EditorView, keymap, lineNumbers, placeholder as cmPlaceholder } from '@codemirror/view';
  import { Annotation, EditorState } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { json } from '@codemirror/lang-json';
  import { linter, lintGutter } from '@codemirror/lint';
  import { autocompletion } from '@codemirror/autocomplete';
  import { codeFolding, foldGutter, StreamLanguage, syntaxHighlighting, unfoldAll } from '@codemirror/language';
  import { foldBelowRoot } from './foldBelowRoot';
  import { python } from '@codemirror/legacy-modes/mode/python';
  import { jsonHighlightStyle } from './jsonHighlight';
  import { jsonSyntaxErrors } from './jsonDiagnostics';
  import { stickyPath } from './stickyPath';
  import { createEnvVarCompletions, createVarHover, varHighlighter } from './variableHighlight';

  export let value: string;
  export let onChange: (value: string) => void;
  export let singleLine = false;
  export let lang: 'json' | 'text' | 'python' = 'text';
  export let placeholder = '';
  // active environment's variables: names complete inside {{…}}, values
  // show in a hover tooltip
  export let envVars: Record<string, string> = {};
  // identity of the document being edited: while it stays the same, outside
  // value writes become undoable transactions; when it changes (another
  // request opened) the editor and its history are rebuilt from scratch
  export let docKey: unknown = undefined;

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  // "collapse all" for JSON bodies: folds everything one level below the
  // root so the top-level keys stay in view
  export function collapseAll() {
    if (view) foldBelowRoot(view);
  }
  export function expandAll() {
    if (view) unfoldAll(view);
  }

  // getters keep the extensions reading the current prop value without
  // rebuilding the editor when the environment changes
  const varHover = createVarHover(() => envVars);
  const envVarCompletions = createEnvVarCompletions(() => envVars);

  const theme = EditorView.theme({
    '&': { fontSize: '13px', backgroundColor: 'transparent' },
    // CM's base theme puts monospace on .cm-scroller, so 'inherit' on the
    // content would resolve to that — override the scroller itself
    '.cm-scroller': {
      fontFamily: singleLine ? 'var(--sans)' : 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    '.cm-content': {
      color: 'var(--text-soft)',
      padding: singleLine ? '5px 4px' : '8px 4px',
    },
    '.cm-line': { padding: '0 2px' },
    '.cm-cursor': { borderLeftColor: 'var(--text)' },
    '.cm-selectionBackground': { backgroundColor: 'var(--blue-bg-strong)' },
    '&.cm-focused .cm-selectionBackground': { backgroundColor: 'var(--blue-bg-strong)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-primrose-var': { color: 'var(--green-text)', fontWeight: '600' },
    '.cm-placeholder': { color: 'var(--text-ghost)' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: 'var(--editor-gutter)',
      border: 'none',
      borderRight: '1px solid var(--border-faint)',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 12px', minWidth: '30px' },
    '.cm-foldGutter .cm-gutterElement': { padding: '0 4px 0 2px', cursor: 'pointer' },
    '.cm-foldPlaceholder': {
      background: 'var(--bg-hover)',
      border: '1px solid var(--border-soft)',
      color: 'var(--text-faint)',
      borderRadius: '4px',
      padding: '0 5px',
      margin: '0 2px',
      cursor: 'pointer',
    },
    // the hover tooltip content (VarTooltip) brings its own card look
    '.cm-tooltip.cm-tooltip-hover': {
      backgroundColor: 'transparent',
      border: 'none',
    },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      padding: '3px',
      fontFamily: 'inherit',
    },
    '.cm-tooltip-autocomplete ul li': {
      fontFamily: 'var(--sans)',
      fontSize: '12px',
      color: 'var(--text-soft)',
      padding: '3px 8px',
      borderRadius: '5px',
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--green-bg)',
      color: 'var(--green-text)',
    },
  });

  // marks value writes coming from the store so they don't echo back as edits
  const external = Annotation.define<boolean>();

  function extensions() {
    const ext = [
      // draw the cursor ourselves: WKWebView's native caret leaves stale
      // paint artifacts ("ghost cursors") when the editor scrolls internally
      drawSelection(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      varHighlighter,
      varHover,
      autocompletion({ override: [envVarCompletions], icons: false }),
      theme,
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !u.transactions.some((tr) => tr.annotation(external))) onChange(u.state.doc.toString());
      }),
    ];
    if (placeholder) ext.push(cmPlaceholder(placeholder));
    if (singleLine) {
      // block newlines entirely (paste included)
      ext.push(EditorState.transactionFilter.of((tr) => (tr.newDoc.lines > 1 ? [] : tr)));
    } else {
      ext.push(EditorView.lineWrapping, lineNumbers());
      if (lang === 'json') {
        ext.push(json(), syntaxHighlighting(jsonHighlightStyle), lintGutter(), linter(jsonSyntaxErrors), stickyPath());
        ext.push(codeFolding(), foldGutter({ openText: '▾', closedText: '▸' }));
      } else if (lang === 'python') {
        // Starlark is Python syntax; the legacy stream mode is enough for
        // highlighting and reuses the JSON highlight colors
        ext.push(StreamLanguage.define(python), syntaxHighlighting(jsonHighlightStyle));
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

  let lastKey = docKey;
  $: if (view && docKey !== lastKey) {
    lastKey = docKey;
    createView();
  }

  // Outside value writes of the same document (query tab rewriting the URL,
  // request-level undo) replace the text in place so ⌘Z still works; only
  // when it differs from what the editor holds, so typing isn't disrupted.
  $: if (view && value !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value }, annotations: external.of(true) });
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
    border: 1px solid var(--border-input);
    border-radius: 8px;
    /* fill the pane and let CodeMirror scroll long documents internally,
       so the tab bar and body-type switch stay in view */
    flex: 1;
    min-height: 220px;
    overflow: hidden;
  }
  .editor:not(.single) :global(.cm-editor) {
    height: 100%;
    min-height: 220px;
  }
  .editor:not(.single):focus-within {
    border-color: var(--yellow-border);
  }
  .editor :global(.cm-scroller) {
    overflow: auto;
  }
</style>
