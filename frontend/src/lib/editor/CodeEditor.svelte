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
    lineNumbers,
    placeholder as cmPlaceholder,
  } from '@codemirror/view';
  import { EditorState } from '@codemirror/state';
  import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
  import { json } from '@codemirror/lang-json';
  import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
  import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
  import { syntaxHighlighting, syntaxTree } from '@codemirror/language';
  import { jsonHighlightStyle } from './jsonHighlight';

  export let value: string;
  export let onChange: (value: string) => void;
  export let singleLine = false;
  export let lang: 'json' | 'text' = 'text';
  export let placeholder = '';
  // active environment's variable names, offered as completions inside {{…}}
  export let envVarNames: string[] = [];

  let host: HTMLDivElement;
  let view: EditorView | null = null;

  // {{envVar}} and :dynamicVar tinted green, per the mockups; patterns
  // mirror the Go/TS variable syntax contract (see request/vars.ts).
  // decorate() marks only the variable itself, not the preceding delimiter.
  const varMark = Decoration.mark({ class: 'cm-primrose-var' });
  const varMatcher = new MatchDecorator({
    regexp: /(\{\{[A-Za-z_][A-Za-z0-9_-]*\}\})|(^|[/=&?,\s])(:[A-Za-z_][A-Za-z0-9_]*)/g,
    decorate: (add, from, to, m) => {
      if (m[1]) add(from, to, varMark);
      else add(from + m[2].length, to, varMark);
    },
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

  // Suggest env vars while typing inside {{…}}; typing "{{" pops the list.
  // Accepting a completion also closes the braces if they aren't closed yet.
  function envVarCompletions(ctx: CompletionContext) {
    const m = ctx.matchBefore(/\{\{[A-Za-z0-9_-]*$/);
    if (!m || envVarNames.length === 0) return null;
    return {
      from: m.from + 2,
      options: envVarNames.map((name) => ({
        label: name,
        type: 'variable',
        apply: (view: EditorView, _c: unknown, from: number, to: number) => {
          const alreadyClosed = view.state.sliceDoc(to, to + 2) === '}}';
          const insert = alreadyClosed ? name : `${name}}}`;
          view.dispatch({
            changes: { from, to, insert },
            selection: { anchor: from + name.length + 2 },
          });
        },
      })),
      validFor: /^[A-Za-z0-9_-]*$/,
    };
  }

  const theme = EditorView.theme({
    '&': { fontSize: '13px', backgroundColor: 'transparent' },
    // CM's base theme puts monospace on .cm-scroller, so 'inherit' on the
    // content would resolve to that — override the scroller itself
    '.cm-scroller': {
      fontFamily: singleLine
        ? 'system-ui, -apple-system, sans-serif'
        : 'ui-monospace, SFMono-Regular, Menlo, monospace',
    },
    '.cm-content': {
      color: '#444',
      padding: singleLine ? '5px 4px' : '8px 4px',
    },
    '.cm-line': { padding: '0 2px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-primrose-var': { color: '#3d9469', fontWeight: '600' },
    '.cm-placeholder': { color: '#bbb' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      color: '#b8b8b8',
      border: 'none',
      borderRight: '1px solid #eee',
    },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 6px 0 12px', minWidth: '30px' },
    '.cm-tooltip.cm-tooltip-autocomplete': {
      backgroundColor: '#fff',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
      padding: '3px',
      fontFamily: 'inherit',
    },
    '.cm-tooltip-autocomplete ul li': {
      fontFamily: 'system-ui, -apple-system, sans-serif',
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

  // Editor-style diagnostics: the Lezer JSON parser is error-tolerant and
  // marks every broken node, so each error attaches to its own line instead
  // of only reporting the first JSON.parse failure.
  function jsonSyntaxErrors(view: EditorView): Diagnostic[] {
    if (view.state.doc.toString().trim() === '') return []; // empty body is fine
    const diagnostics: Diagnostic[] = [];
    syntaxTree(view.state).cursor().iterate((node) => {
      if (!node.type.isError) return;
      diagnostics.push({
        from: node.from,
        to: Math.max(node.to, Math.min(node.from + 1, view.state.doc.length)),
        severity: 'error',
        message: 'Invalid JSON syntax',
      });
    });
    return diagnostics;
  }

  function extensions() {
    const ext = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      varHighlighter,
      autocompletion({ override: [envVarCompletions], icons: false }),
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
      ext.push(EditorView.lineWrapping, lineNumbers());
      if (lang === 'json') {
        ext.push(
          json(),
          syntaxHighlighting(jsonHighlightStyle),
          lintGutter(),
          linter(jsonSyntaxErrors)
        );
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
