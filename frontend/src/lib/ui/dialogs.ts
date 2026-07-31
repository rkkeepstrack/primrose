import { writable } from 'svelte/store';

// window.prompt/confirm are not implemented in macOS WKWebView, so dialogs
// are rendered in-app (see Dialog.svelte).

export interface DialogState {
  kind: 'confirm' | 'prompt' | 'discard';
  message: string;
  initial?: string;
  danger?: boolean;
  resolve: (value: string | boolean | null) => void;
}

export const dialog = writable<DialogState | null>(null);

export function confirmDialog(message: string, danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.set({ kind: 'confirm', message, danger, resolve: (v) => resolve(Boolean(v)) });
  });
}

// unsaved-changes dialogs: a red "Discard" and a yellow "Keep editing";
// resolves true when the user chose to discard
export function discardDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    dialog.set({ kind: 'discard', message, resolve: (v) => resolve(Boolean(v)) });
  });
}

export function promptDialog(message: string, initial = ''): Promise<string | null> {
  return new Promise((resolve) => {
    dialog.set({
      kind: 'prompt',
      message,
      initial,
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    });
  });
}
