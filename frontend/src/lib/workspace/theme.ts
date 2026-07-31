// Color theme selection: applied as a data-theme attribute on <html> (the
// CSS variable overrides live in style.css), persisted in the UI state.

import { get, writable } from 'svelte/store';
import { SetTheme } from '../../../wailsjs/go/main/App';

export const THEMES = ['default', 'gruvbox-light', 'pastel'] as const;
export type ThemeId = (typeof THEMES)[number];

export const theme = writable<ThemeId>('default');

function normalize(id: string | undefined): ThemeId {
  return (THEMES as readonly string[]).includes(id ?? '') ? (id as ThemeId) : 'default';
}

// applyTheme sets the store and the DOM attribute; syncMenu also moves the
// checkmark in the native Themes menu (needed when the change didn't
// originate from a menu click, e.g. session restore).
export function applyTheme(id: string | undefined, opts: { syncMenu?: boolean } = {}) {
  const t = normalize(id);
  theme.set(t);
  if (t === 'default') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  if (opts.syncMenu) SetTheme(t);
}

export function currentTheme(): ThemeId {
  return get(theme);
}
