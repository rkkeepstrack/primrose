---
name: architecture-review
description: Recurring architecture and code-quality review of the Primrose codebase (plans/bug-fixes.md point H). Focuses on cross-component dependencies and responsibilities — the goal is small components with single responsibilities. Run after a batch of features/fixes has landed, or when the user asks for a review pass.
---

# Architecture review

A recurring review pass over the whole codebase — not a diff review. The
primary lens is **structure**: which module depends on which, and whether
each component/module still has exactly one job. Findings are reported for
discussion first; nothing is refactored without the user's go.

## Scope

- `frontend/src/lib/**` (Svelte components + TS modules) — the main focus
- `frontend/src/App.svelte` and the workspace stores/operations
- Go backend (`*.go`, `collection/`, …) — secondary; only flag clear issues
- Skip `frontend/wailsjs/**` (generated) and `frontend/dist/**` (build)

## How to run: parallel subagents

Fan the dimensions below out to subagents running **in parallel** (one
read-only Explore/general-purpose agent per dimension; launch them in a
single message so they run concurrently). Give each agent its dimension's
instructions verbatim plus the Scope section, and have it return findings
in the report format (files as `path:line`, concrete proposal, severity).

The main conversation only: launches the agents, merges and dedupes their
findings (the same hotspot will surface in several dimensions — merge into
one finding), verifies anything surprising by reading the file itself, and
then conducts the interview (below).

## Review dimensions, in priority order

### 1. Cross-component dependencies (the main lens)

Build the dependency picture before judging anything:

- Map imports between `lib/*` feature folders (sidebar, workspace, request,
  response, environments, ui, shared, …). `grep -rn "from '\.\./"` per folder
  is usually enough; note every import that crosses a folder boundary.
- Flag **cycles** (e.g. workspace/requests ↔ workspace/collections via lazy
  `await import(...)` — existing lazy imports mark known trouble spots, not
  a pattern to copy).
- Flag **wrong-direction dependencies**: `ui/` must stay generic (no imports
  from feature folders); `shared/` must not import from features; feature
  folders should reach each other through stores/operations in `workspace/`,
  not by importing each other's components.
- Flag **cross-cutting state leaks**: component-local concerns living in
  global stores, or one feature writing another feature's stores directly
  instead of calling an operation function.

### 2. Single responsibility / component size

- Components that render **and** orchestrate (fetch/save/confirm) — split
  view from operation. Operations belong in `workspace/*` modules.
- Components > ~150 lines of script or with more than one reason to change:
  propose a concrete split (name the pieces, as with TreeRow/Tree or the
  RenameInput extraction).
- Props that merely tunnel through a component to its children (prop
  drilling) — consider a store or restructuring.
- Modules that accumulate unrelated exports (grab-bag `stores.ts`/`utils`) —
  propose where each export actually belongs.

### 3. SOLID / Clean Code spot checks

- Functions doing more than their name says; boolean flag parameters that
  switch behavior; duplicated logic across Go and TS that must stay in sync
  (variable resolution, path rules) — flag drift risks explicitly.
- Dead code, stale comments, commented-out blocks, TODOs older than the
  current batch.

### 4. Redundancy

- Copy-pasted UI patterns that deserve a shared `ui/` component (buttons,
  hover rows, key/value tables).
- Repeated store-wiring boilerplate (signal stores, edge-triggered `$:`
  blocks) — note candidates for a small helper.

### 5. Test coverage

- `frontend/src/tests/**` mirrors `lib/`: list feature modules with **zero**
  tests and rank them by how much logic (not markup) they contain.
- Pure logic currently trapped inside components (sorting, filtering,
  diffing) that would be testable if extracted — these count for
  dimension 2 as well.
- Do not demand tests for thin markup components.

### 6. Sanity check: proportionality & idiom

The same check the report gets (see "Sanity check on the report itself"),
applied to the existing code as its own parallel dimension:

- **Overengineered code** — abstractions with a single call site, layers or
  generality nothing uses, config/options nobody passes, components split
  finer than their cohesion warrants.
- **Underengineered code** — the same few lines re-written in several
  places where one obvious helper exists, error paths ignored, special
  cases stacked where the general case is simple.
- **Unidiomatic code** — fighting Svelte stores / `$:` reactivity, manual
  DOM work where a binding exists, Go code ignoring stdlib conventions;
  anything solved elsewhere in this codebase in a simpler, established way.

## Output

Produce a report, ordered by severity, with three sections:

1. **Structural findings** — each with: the dependency/responsibility rule
   broken, the files involved (`path:line`), why it will hurt (concretely:
   what change becomes hard), and a proposed cut into smaller
   single-responsibility pieces.
2. **Smaller cleanups** — redundancy, dead code, naming; one line each.
3. **Test gaps** — ranked list, with the extraction needed to make each
   testable.

Rules for findings:

- Every finding names concrete files and a concrete proposal — no generic
  advice ("consider splitting" without saying into what).
- Verify each structural finding by reading the involved files, not just
  the import graph.
- Don't count deliberate, documented decisions as findings (see the DECIDED
  entries in plans/bug-fixes.md; header comments often explain the intent).

## Sanity check on the report itself

Before the interview, run one adversarial pass over the merged report —
not over the codebase, but over the **proposals**. Its only question:
is each proposed solution proportionate and idiomatic? It hunts for:

- **Overengineering** — abstractions for a single call site, layers or
  indirection the ~20-file frontend doesn't need, splitting a component
  that is small and cohesive just to satisfy a line count, introducing
  patterns (factories, event buses, DI) foreign to this codebase.
- **Underengineering** — proposals that only rename the problem, move code
  without breaking the dependency, or fix one instance of a pattern the
  report itself says occurs elsewhere.
- **Unidiomatic or plain stupid** — solutions that fight Svelte stores /
  `$:` reactivity or the existing workspace-operations pattern instead of
  using them; anything the current code already solves elsewhere in a
  simpler way.

Run this as its own subagent with fresh eyes (it gets the report and read
access, not the finding authors' reasoning). Each proposal it challenges is
either rewritten to the simpler/fuller version or carried into the
interview with the objection attached — never silently dropped.

## Interview

The report is not the end — walk the user through it as an **interview**,
finding by finding, instead of dumping the list and waiting:

- Present the report summary first (counts per section, the top structural
  findings in two or three sentences each).
- Then go through the findings in severity order using AskUserQuestion:
  for each structural finding offer at least "fix now", "defer (note in
  plans/bug-fixes.md)", and "not a problem — explain why", and record the
  user's reasoning when they reject one (it becomes a DECIDED-style note
  so future reviews don't re-raise it).
- Batch related small cleanups into one question rather than asking about
  each one-liner individually.
- Close the interview by restating what was agreed: which findings get
  fixed now and in which order, which are deferred, which were dismissed.

Only after the interview are refactorings applied — one finding per
commit, tests green after each, and a final summary of what was fixed
versus what was deferred.
