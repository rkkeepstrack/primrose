// CodeMirror extensions for {{env}} and :dynamic variables: green tint,
// hover tooltip with the active environment's value, and completion inside
// {{…}}. Patterns mirror the Go/TS variable syntax contract (request/vars.ts).

import { mount, unmount, flushSync } from 'svelte';
import { EditorView, MatchDecorator, Decoration, ViewPlugin, hoverTooltip, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import type { CompletionContext } from '@codemirror/autocomplete';
import VarTooltip from './VarTooltip.svelte';

// decorate() marks only the variable itself, not the preceding delimiter
const varMark = Decoration.mark({ class: 'cm-primrose-var' });
const varMatcher = new MatchDecorator({
  regexp: /(\{\{[A-Za-z_][A-Za-z0-9_-]*\}\})|(^|[/=&?,\s])(:[A-Za-z_][A-Za-z0-9_]*)/g,
  decorate: (add, from, to, m) => {
    if (m[1]) add(from, to, varMark);
    else add(from + m[2].length, to, varMark);
  },
});

export const varHighlighter = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(v: EditorView) {
      this.decorations = varMatcher.createDeco(v);
    }
    update(u: ViewUpdate) {
      this.decorations = varMatcher.updateDeco(u, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

// getEnvVars is a getter so the extensions always see the component's
// current (reactive) environment without being rebuilt on every change
export function createVarHover(getEnvVars: () => Record<string, string>) {
  // hovering a {{var}} shows the active environment's value for it; the
  // card itself is the VarTooltip component, CM only anchors it
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    for (const m of line.text.matchAll(/\{\{([A-Za-z_][A-Za-z0-9_-]*)\}\}/g)) {
      const from = line.from + (m.index ?? 0);
      const to = from + m[0].length;
      if (pos < from || pos > to) continue;
      const name = m[1];
      // below the token — above the url bar sits the titlebar, which clips
      return {
        pos: from,
        end: to,
        create: () => {
          const dom = document.createElement('div');
          // flushSync: CM measures the tooltip right away for positioning
          const comp = flushSync(() => mount(VarTooltip, { target: dom, props: { value: getEnvVars()[name] } }));
          return { dom, destroy: () => unmount(comp) };
        },
      };
    }
    return null;
  });
}

// Suggest env vars while typing inside {{…}}; typing "{{" pops the list.
// Accepting a completion also closes the braces if they aren't closed yet.
export function createEnvVarCompletions(getEnvVars: () => Record<string, string>) {
  return (ctx: CompletionContext) => {
    const names = Object.keys(getEnvVars());
    const m = ctx.matchBefore(/\{\{[A-Za-z0-9_-]*$/);
    if (!m || names.length === 0) return null;
    return {
      from: m.from + 2,
      options: names.map((name) => ({
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
  };
}
