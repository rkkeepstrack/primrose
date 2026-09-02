// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import TestResults from '../../lib/response/TestResults.svelte';

describe('TestResults', () => {
  it('lists each assertion with source, status and failure message', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(TestResults, {
      target: host,
      props: {
        report: {
          passed: 1,
          total: 2,
          results: [
            { line: 1, source: 'assert res.status == 200', ok: true, message: '' },
            { line: 2, source: 'assert res.body["ok"]', ok: false, message: 'assertion failed' },
          ],
        },
      },
    });
    const items = host.querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('assert res.status == 200');
    expect(items[0].classList.contains('fail')).toBe(false);
    expect(items[1].classList.contains('fail')).toBe(true);
    expect(items[1].textContent).toContain('assertion failed');
    unmount(comp);
  });

  it('masks secret values in source and message via the mask prop', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const SECRET = 'sk-super-secret';
    const mask = (s: string) => s.replaceAll(SECRET, '***');
    const comp = mount(TestResults, {
      target: host,
      props: {
        mask,
        report: {
          passed: 0,
          total: 1,
          results: [
            {
              line: 1,
              source: `assert res.body.token == "${SECRET}"`,
              ok: false,
              message: `expected "${SECRET}", got ""`,
            },
          ],
        },
      },
    });
    const text = host.textContent ?? '';
    expect(text).not.toContain(SECRET);
    expect(text).toContain('***');
    unmount(comp);
  });
});
