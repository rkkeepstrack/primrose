// Request-level undo for everything that is not a CodeMirror editor (method,
// key-value rows, toggles, …): every edit() snapshots the whole request, so
// ⌘Z restores the exact state before the last burst of edits.

import { get, writable } from 'svelte/store';
import type { ApiRequest } from '../shared/types';
import { editIdentity } from '../workspace/drafts';
import { dirty, request } from '../workspace/state';

export const COALESCE_MS = 300;
const MAX = 100;

interface Snapshot {
  request: ApiRequest;
  dirty: boolean;
}

let past: Snapshot[] = [];
let future: Snapshot[] = [];
let lastEditAt = -Infinity;
let applying = false;
let now = () => Date.now();

export const canUndo = writable(false);

function sync() {
  canUndo.set(past.length > 0);
}

function current(): Snapshot | null {
  const r = get(request);
  return r ? { request: structuredClone(r), dirty: get(dirty) } : null;
}

// called by edit() before it mutates; typing bursts collapse into one step
export function snapshotBeforeEdit() {
  if (applying) return;
  const t = now();
  const burst = t - lastEditAt < COALESCE_MS;
  lastEditAt = t;
  future = [];
  if (burst && past.length) return;
  const snap = current();
  if (!snap) return;
  past.push(snap);
  if (past.length > MAX) past.shift();
  sync();
}

function apply(snap: Snapshot) {
  applying = true;
  request.set(snap.request);
  dirty.set(snap.dirty);
  applying = false;
}

export function undo() {
  const snap = past.pop();
  if (!snap) return;
  const cur = current();
  if (cur) future.push(cur);
  apply(snap);
  lastEditAt = -Infinity; // the next edit starts a new step
  sync();
}

export function redo() {
  const snap = future.pop();
  if (!snap) return;
  const cur = current();
  if (cur) past.push(cur);
  apply(snap);
  lastEditAt = -Infinity;
  sync();
}

// on request switch: ⌘Z must never resurrect another request's state
export function resetUndo() {
  past = [];
  future = [];
  lastEditAt = -Infinity;
  sync();
}

editIdentity.subscribe(resetUndo);

export function setUndoClock(clock: () => number) {
  now = clock;
}
