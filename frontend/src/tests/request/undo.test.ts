import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { canUndo, redo, resetUndo, setUndoClock, undo } from '../../lib/request/undo';
import { edit } from '../../lib/request/requestEdit';
import { dirty, request } from '../../lib/workspace/state';
import type { ApiRequest } from '../../lib/shared/types';

function fresh(): ApiRequest {
  return {
    method: 'GET',
    url: 'a',
    query: {},
    disabledQuery: [],
    headers: {},
    body: { type: 'json', content: '' },
    vars: {},
    tests: { script: '' },
  };
}

describe('request undo stack', () => {
  beforeEach(() => {
    resetUndo();
    request.set(fresh());
    dirty.set(false);
  });

  it('undo restores the snapshot taken before the edit, including the dirty flag', () => {
    let now = 0;
    setUndoClock(() => now);
    edit((r) => (r.url = 'b'));
    expect(get(canUndo)).toBe(true);
    undo();
    expect(get(request)?.url).toBe('a');
    expect(get(dirty)).toBe(false);
    expect(get(canUndo)).toBe(false);
  });

  it('redo re-applies an undone edit', () => {
    edit((r) => (r.url = 'b'));
    undo();
    redo();
    expect(get(request)?.url).toBe('b');
    expect(get(dirty)).toBe(true);
  });

  it('coalesces edits within the burst window into one undo step', () => {
    let now = 0;
    setUndoClock(() => now);
    edit((r) => (r.url = 'ab'));
    now = 100;
    edit((r) => (r.url = 'abc'));
    now = 1000;
    edit((r) => (r.url = 'abcd'));
    undo();
    expect(get(request)?.url).toBe('abc');
    undo();
    expect(get(request)?.url).toBe('a');
  });

  it('a new edit drops the redo stack', () => {
    edit((r) => (r.url = 'b'));
    undo();
    edit((r) => (r.url = 'c'));
    redo();
    expect(get(request)?.url).toBe('c');
  });

  it('snapshots are deep copies, later mutation does not leak into them', () => {
    edit((r) => (r.headers = { x: '1' }));
    edit((r) => (r.headers.x = '2'));
    undo();
    undo();
    expect(get(request)?.headers).toEqual({});
  });

  it('reset empties both stacks', () => {
    edit((r) => (r.url = 'b'));
    resetUndo();
    expect(get(canUndo)).toBe(false);
    undo();
    expect(get(request)?.url).toBe('b');
  });
});
