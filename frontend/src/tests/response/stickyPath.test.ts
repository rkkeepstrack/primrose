import { describe, expect, it } from 'vitest';
import { EditorState } from '@codemirror/state';
import { json } from '@codemirror/lang-json';
import { codeFolding, foldEffect } from '@codemirror/language';
import { computeStickyLines } from '../../lib/editor/stickyPath';

// line numbers:            1    2            3               4             5         6      7      8    9   10
const nested = [
  '{',
  '  "user": {',
  '    "profile": {',
  '      "tags": [',
  '        "a",',
  '        "b"',
  '      ]',
  '    }',
  '  }',
  '}',
].join('\n');

function stateOf(doc: string): EditorState {
  return EditorState.create({ doc, extensions: [json(), codeFolding()] });
}

function texts(state: EditorState, lineNumber: number): string[] {
  return computeStickyLines(state, state.doc.line(lineNumber).from).map((l) => l.text);
}

describe('computeStickyLines', () => {
  it('returns the enclosing property lines, outermost first', () => {
    const state = stateOf(nested);
    // top visible line is `"a",` (line 5)
    expect(texts(state, 5)).toEqual(['  "user": {', '    "profile": {', '      "tags": [']);
  });

  it('shortens the chain as the top line moves out of inner containers', () => {
    const state = stateOf(nested);
    // top visible line is `}` closing profile (line 8): only user encloses it
    expect(texts(state, 8)).toEqual(['  "user": {']);
  });

  it('returns nothing at the top of the document', () => {
    const state = stateOf(nested);
    expect(texts(state, 1)).toEqual([]);
  });

  it('returns nothing for a flat document (depth 0 content)', () => {
    const state = stateOf('{\n  "a": 1,\n  "b": 2\n}');
    expect(texts(state, 3)).toEqual([]);
  });

  it('keeps the deepest 5 levels when nested deeper', () => {
    // 7 nested objects: l1 … l7, then a value line
    let doc = '{\n';
    for (let i = 1; i <= 7; i++) doc += `${'  '.repeat(i)}"l${i}": {\n`;
    doc += `${'  '.repeat(8)}"x": 1\n`;
    for (let i = 7; i >= 1; i--) doc += `${'  '.repeat(i)}}\n`;
    doc += '}';
    const state = stateOf(doc);
    // top visible line is `"x": 1` (line 9); l1 and l2 fall off the cap
    expect(texts(state, 9)).toEqual([
      '      "l3": {',
      '        "l4": {',
      '          "l5": {',
      '            "l6": {',
      '              "l7": {',
    ]);
  });

  it('maps an anchor inside a folded region to the fold header line', () => {
    const base = stateOf(nested);
    // fold from end of line 2 through end of line 4: the profile and tags
    // property lines are hidden inside the fold, line 2 is the header
    const state = base.update({
      effects: foldEffect.of({ from: base.doc.line(2).to, to: base.doc.line(4).to }),
    }).state;
    expect(texts(state, 5)).toEqual(['  "user": {']);
  });
});
