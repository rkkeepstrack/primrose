// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount, unmount } from 'svelte';
import KeyValueEditor from '../../lib/ui/KeyValueEditor.svelte';

describe('KeyValueEditor enable toggles', () => {
  it('shows a power button per row, marked off for disabled keys, and reports toggles', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const toggled: [string, boolean][] = [];
    const comp = mount(KeyValueEditor, {
      target: host,
      props: {
        entries: { a: '1', debug: 'true' },
        onChange: () => {},
        disabledKeys: ['debug'],
        onToggleEnabled: (key: string, enabled: boolean) => toggled.push([key, enabled]),
      },
    });
    await Promise.resolve();

    const boxes = [...host.querySelectorAll<HTMLButtonElement>('button.enable-toggle')];
    expect(boxes.map((b) => b.classList.contains('is-off'))).toEqual([false, true]);
    expect(host.querySelectorAll('tr.off')).toHaveLength(1);

    boxes[1].click();
    await Promise.resolve();
    expect(toggled).toEqual([['debug', true]]);

    unmount(comp);
  });

  it('renders no power buttons without onToggleEnabled', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const comp = mount(KeyValueEditor, { target: host, props: { entries: { a: '1' }, onChange: () => {} } });
    await Promise.resolve();
    expect(host.querySelectorAll('button.enable-toggle')).toHaveLength(0);
    unmount(comp);
  });
});

describe('KeyValueEditor disabled rows keep their state by row, not by name', () => {
  it('renaming a disabled row reports the new name as disabled, through an empty name too', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const emitted: [Record<string, string>, string[] | undefined][] = [];
    const comp = mount(KeyValueEditor, {
      target: host,
      props: {
        entries: { a: '1', debug: 'true' },
        onChange: (e: Record<string, string>, off?: string[]) => emitted.push([e, off]),
        disabledKeys: ['debug'],
        onToggleEnabled: () => {},
      },
    });
    await Promise.resolve();
    const name = host.querySelectorAll<HTMLInputElement>('td input[placeholder="name"]')[1];
    for (const v of ['debugg', '', 'x']) {
      name.value = v;
      name.dispatchEvent(new Event('input'));
      await Promise.resolve();
    }
    expect(emitted.map(([, off]) => off)).toEqual([['debugg'], [], ['x']]);
    expect(host.querySelectorAll('tr.off')).toHaveLength(1);
    unmount(comp);
  });
});
