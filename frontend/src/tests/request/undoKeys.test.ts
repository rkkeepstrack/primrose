// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { handleUndoKeydown } from '../../lib/request/undoKeys';
import { resetUndo } from '../../lib/request/undo';
import { edit } from '../../lib/request/requestEdit';
import { request } from '../../lib/workspace/state';
import { activeTabId } from '../../lib/workspace/tabs';

function key(opts: { shift?: boolean; target?: Element; ctrl?: boolean; key?: string } = {}) {
  const e = new KeyboardEvent('keydown', {
    key: opts.key ?? 'z',
    metaKey: !opts.ctrl,
    ctrlKey: !!opts.ctrl,
    shiftKey: !!opts.shift,
    cancelable: true,
  });
  Object.defineProperty(e, 'target', { value: opts.target ?? document.body });
  return e;
}

describe('⌘Z routing', () => {
  beforeEach(() => {
    resetUndo();
    activeTabId.set('/c');
    request.set({
      method: 'GET',
      url: 'a',
      query: {},
      disabledQuery: [],
      headers: {},
      body: { type: 'json', content: '' },
      vars: {},
      tests: { script: '' },
    });
    edit((r) => (r.url = 'b'));
  });

  it('⌘Z undoes and ⌘⇧Z redoes the request-level stack', () => {
    const e = key();
    expect(handleUndoKeydown(e)).toBe(true);
    expect(e.defaultPrevented).toBe(true);
    expect(get(request)?.url).toBe('a');
    handleUndoKeydown(key({ shift: true }));
    expect(get(request)?.url).toBe('b');
  });

  it('ctrl+z works too', () => {
    handleUndoKeydown(key({ ctrl: true }));
    expect(get(request)?.url).toBe('a');
  });

  it('leaves CodeMirror editors and dialogs to their own undo', () => {
    const cm = document.createElement('div');
    cm.className = 'cm-editor';
    const inner = document.createElement('div');
    cm.appendChild(inner);
    expect(handleUndoKeydown(key({ target: inner }))).toBe(false);
    const dlg = document.createElement('div');
    dlg.className = 'dialog';
    const input = document.createElement('input');
    dlg.appendChild(input);
    expect(handleUndoKeydown(key({ target: input }))).toBe(false);
    expect(get(request)?.url).toBe('b');
  });

  it('ignores other keys and special tabs', () => {
    expect(handleUndoKeydown(key({ key: 'y' }))).toBe(false);
    activeTabId.set('env:/c');
    expect(handleUndoKeydown(key())).toBe(false);
    expect(get(request)?.url).toBe('b');
  });
});
