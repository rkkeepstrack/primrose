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

  it('leaves plain inputs outside the request editor to native undo', () => {
    const search = document.createElement('input');
    document.body.appendChild(search);
    const e = key({ target: search });
    expect(handleUndoKeydown(e)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
    expect(get(request)?.url).toBe('b');
  });

  it('handles inputs inside the request editor', () => {
    const scope = document.createElement('div');
    scope.setAttribute('data-request-undo', '');
    const input = document.createElement('input');
    scope.appendChild(input);
    expect(handleUndoKeydown(key({ target: input }))).toBe(true);
    expect(get(request)?.url).toBe('a');
  });

  it('a nested opt-out inside the request editor goes back to native undo', () => {
    const scope = document.createElement('div');
    scope.setAttribute('data-request-undo', '');
    const envTable = document.createElement('table');
    envTable.setAttribute('data-request-undo', 'off');
    const input = document.createElement('input');
    envTable.appendChild(input);
    scope.appendChild(envTable);
    expect(handleUndoKeydown(key({ target: input }))).toBe(false);
    expect(get(request)?.url).toBe('b');
  });

  it('does not swallow the key when there is nothing to undo or redo', () => {
    resetUndo();
    const e = key();
    expect(handleUndoKeydown(e)).toBe(false);
    expect(e.defaultPrevented).toBe(false);
    expect(handleUndoKeydown(key({ shift: true }))).toBe(false);
  });

  it('ignores other keys and special tabs', () => {
    expect(handleUndoKeydown(key({ key: 'y' }))).toBe(false);
    activeTabId.set('env:/c');
    expect(handleUndoKeydown(key())).toBe(false);
    expect(get(request)?.url).toBe('b');
  });
});
