<script lang="ts">
  // Orchestrates the environment editor: draft/stash lifecycle, dirty state
  // and confirmation flows. Rendering lives in EnvList / EnvDetail.
  import type { Environment } from '../shared/types';
  import SplitPane from '../ui/SplitPane.svelte';
  import { promptDialog } from '../ui/dialogs';
  import { confirmDiscardEnvEdits, deleteEnvironment, duplicateEnvironment, renameEnvironment } from '../workspace/environments';
  import { envDrafts, envSaveSignal } from '../workspace/state';
  import EnvList from './EnvList.svelte';
  import EnvDetail from './EnvDetail.svelte';

  export let root: string;
  export let environments: Environment[];
  export let activeName: string | null;
  export let onSelect: (name: string) => void;
  export let onSave: (
    name: string,
    vars: Record<string, string>,
    headers: Record<string, string>,
    secrets: Record<string, string>,
  ) => Promise<void> | void;
  export let onCreate: (name: string) => void;

  let search = '';
  let draft: Record<string, string> | null = null;
  let headersDraft: Record<string, string> | null = null;
  let secretsDraft: string[] | null = null;
  let draftFor: string | null = null;
  function menuAction(action: (root: string, name: string) => void, name: string) {
    draftFor = null; // the list may change under us — rebuild the draft
    action(root, name);
  }

  $: active = environments.find((e) => e.name === activeName) ?? null;

  // reset draft when switching environments; a stashed draft from a previous
  // tab switch takes precedence so unsaved edits survive leaving the tab
  $: if (active && draftFor !== active.name) {
    draftFor = active.name;
    const stash = $envDrafts[root];
    if (stash && stash.name === active.name) {
      draft = { ...stash.vars };
      headersDraft = { ...stash.headers };
      secretsDraft = [...(stash.secrets ?? active.secrets)];
    } else {
      draft = { ...active.vars };
      headersDraft = { ...active.headers };
      secretsDraft = [...active.secrets];
    }
    search = '';
  }

  $: filtered = draft
    ? Object.fromEntries(
        Object.entries(draft).filter(
          ([k, v]) => !search || k.toLowerCase().includes(search.toLowerCase()) || v.toLowerCase().includes(search.toLowerCase()),
        ),
      )
    : {};

  // key-order-insensitive comparison — the draft is rebuilt in row order,
  // which JSON.stringify would flag as a change even when values match
  function sameVars(a: Record<string, string>, b: Record<string, string>): boolean {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return ka.length === kb.length && ka.every((k, i) => k === kb[i] && a[k] === b[k]);
  }

  function sameList(a: string[], b: string[]): boolean {
    const sa = [...a].sort();
    const sb = [...b].sort();
    return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
  }

  $: dirty =
    active && draft && headersDraft && secretsDraft
      ? !sameVars(draft, active.vars) || !sameVars(headersDraft, active.headers) || !sameList(secretsDraft, active.secrets)
      : false;

  // keep the shared stash in sync: dirty drafts survive unmounting (tab
  // switches), clean state drops the stash again
  $: if (dirty && draftFor && draft && headersDraft && secretsDraft) stashEnvDraft(draftFor, draft, headersDraft, secretsDraft);
  else if (!dirty) clearEnvDraft();

  function stashEnvDraft(name: string, vars: Record<string, string>, headers: Record<string, string>, secrets: string[]) {
    envDrafts.update((m) => ({ ...m, [root]: { name, vars, headers, secrets } }));
  }

  function clearEnvDraft() {
    envDrafts.update((m) => {
      if (!m[root]) return m;
      const { [root]: _, ...rest } = m;
      return rest;
    });
  }

  async function createEnv() {
    if (!(await confirmDiscardEnvEdits(root))) return;
    const name = await promptDialog('Environment name:');
    if (!name?.trim()) return;
    draftFor = null;
    onCreate(name.trim());
  }

  async function pick(name: string) {
    if (name === activeName) return;
    if (!(await confirmDiscardEnvEdits(root))) return;
    draftFor = null; // force a fresh draft for the newly picked environment
    onSelect(name);
  }

  function handleChange(entries: Record<string, string>) {
    if (!draft) return;
    if (search) {
      // editing a filtered view: merge changes back over the unfiltered draft
      const hidden = Object.fromEntries(Object.entries(draft).filter(([k]) => !(k in filtered)));
      draft = { ...hidden, ...entries };
    } else {
      draft = entries;
    }
  }

  function toggleSecret(key: string) {
    if (!secretsDraft) return;
    secretsDraft = secretsDraft.includes(key) ? secretsDraft.filter((k) => k !== key) : [...secretsDraft, key];
  }

  async function save() {
    if (!active || !draft || !headersDraft || !secretsDraft) return;
    const isSecret = new Set(secretsDraft);
    const plain = Object.fromEntries(Object.entries(draft).filter(([k]) => !isSecret.has(k)));
    const secrets = Object.fromEntries(Object.entries(draft).filter(([k]) => isSecret.has(k)));
    await onSave(active.name, plain, headersDraft, secrets);
    // resync from the saved file so the rows show the alphabetical order
    // the file was written in
    draftFor = null;
  }

  // ⌘S while this tab is active (routed via the native menu handler)
  let lastSaveSignal: number | null = null;
  $: if ($envSaveSignal !== lastSaveSignal) {
    const first = lastSaveSignal === null;
    lastSaveSignal = $envSaveSignal;
    if (!first && dirty) save();
  }
</script>

<div class="env-editor">
  <SplitPane storageKey="env-editor" initialPct={18} minPct={12} maxPct={40}>
    <EnvList
      slot="left"
      {environments}
      {activeName}
      onPick={pick}
      onCreate={createEnv}
      onRename={(name) => menuAction(renameEnvironment, name)}
      onDuplicate={(name) => menuAction(duplicateEnvironment, name)}
      onDelete={(name) => menuAction(deleteEnvironment, name)} />
    <EnvDetail
      slot="right"
      active={!!(active && draft)}
      bind:search
      {filtered}
      {dirty}
      {headersDraft}
      secretKeys={secretsDraft ?? []}
      onToggleSecret={toggleSecret}
      onChange={handleChange}
      onHeadersChange={(h) => (headersDraft = h)}
      onSave={save} />
  </SplitPane>
</div>

<style>
  .env-editor {
    display: flex;
    height: 100%;
    min-height: 0;
  }
</style>
