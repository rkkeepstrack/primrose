// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Popover from '../../lib/ui/Popover.svelte';

describe('Popover manual trigger with auto-dismiss', () => {
  it('opens via the bound prop and dismisses itself', () => {
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);
    const props = $state({ trigger: 'manual' as const, autoDismissMs: 1000, open: false });
    const comp = mount(Popover, { target: host, props });
    flushSync();
    expect(host.querySelector('.popover-card')).toBeNull();

    props.open = true;
    flushSync();
    expect(host.querySelector('.popover-card'), 'card should render when opened').toBeTruthy();

    vi.advanceTimersByTime(1100);
    flushSync();
    vi.advanceTimersByTime(600); // fade-out transition
    flushSync();
    expect(host.querySelector('.popover-card'), 'card should self-dismiss').toBeNull();
    expect(props.open).toBe(false);

    unmount(comp);
    vi.useRealTimers();
  });
});
