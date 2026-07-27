# Bug fixes & improvements

Sorted into batches that touch the same code and should be fixed together.
Suggested order: A → B → C, then G + F, then D + E, Bruno migration (E2) as
its own project, and the review pass (H) after A–C have landed.

## A. Broken today — quick bug batch

- [x] environment save button always appears dirty and seemingly does nothing
      (draft vs. saved vars compared via key-order-sensitive JSON.stringify;
      draft not resynced after save)
- [x] when opening a request and then trying to close it without saving or
      opening another request, nothing happens. it should be possible to
      cancel the step of creating a new request
- [x] delete search button is missing (something like an x)
- [x] VERIFY: no way to delete requests or folders — confirmed stale, delete
      and draft-discard already work — the ⋮ menu has Delete
      now; entry probably predates it (or means keyboard delete?)

## B. Variable semantics — single batch (same regexes/resolver in Go
## resolve.go, TS vars.ts, CodeMirror highlighting, plus tests)

- [x] dynamic variables should not start with /:, just with :
      (care: must not eat ports like https://x.io:8080 — require : to follow
      /, =, & or start-of-segment)
- [x] env variable names should be allowed in either form: camelCase,
      kebab-case, snake_case, SCREAMING_SNAKE_CASE
- [x] continuity: a variable defined with {{}} or : should be usable
      anywhere — key or value of query params and headers, body params
      (dynamic vars are currently URL-only)
- [x] creating new environments: "+ new environment" in the environment
      editor's list (name prompt → writes empty environments/<name>.toml,
      selects it)
- [x] quick environment switching inside a collection: clicking the env
      label in the sidebar offers a dropdown to pick the active environment
      directly (with an "Edit environments…" entry opening the editor),
      instead of always jumping to the editor
- [x] DECIDED: environments/ must never show in the sidebar tree (stays
      excluded). Guards instead: creating/renaming a folder to
      "environments" at the collection root is rejected, and moves
      into/out of environments/ are rejected (no identity crossings)

## C. Env tab rework (follow-up to B)

- [x] request env tab: switch positioning of env and dynamic variables
      (dynamic first), rename the tab to 'Variables'
- [x] environment variables in this call should be editable and saveable
      from the request's Variables tab
- [x] environment view should open in a tab next to the collections instead
      of on the right side; background color should be purplish

## D. Native / window integration — one Wails batch

- [x] full screen / zoom on double click on the header, same as native
      windows on macOS/Windows/Linux
- [x] app menus: replace/extend the standard system menus (Edit, Window…)
      so functionality and shortcuts are visible there as well
- [x] allow closing collections and the environment/shortcuts tabs with ⌘W;
      tabs should behave like native macOS tabs
      (implies: closable collections, which don't exist yet)
- [x] darwin signing warning when building — DECIDED: accepted. It comes
      from TitleBarHiddenInset (our custom title bar); it only matters for
      Mac App Store distribution, which is not planned. Direct distribution
      (dmg/zip, even notarized) is unaffected.

## I. Cookie handling (session-only)

  - [ ] cookie jar: responses with Set-Cookie are stored in an in-memory jar
        (Go net/http/cookiejar attached to the http client) and re-sent on
        subsequent matching requests; session-only, never persisted to files
  - [ ] cookie UI: view stored cookies (domain, name, value, expiry), delete
        individual cookies or all, and manually set new ones
  - [ ] decide: one jar per collection (recommended — matches "one collection
        = one system") vs one global jar
  - [ ] note: Set-Cookie is already visible in the response Headers tab since
        the Go client sees raw headers — the jar adds automatic re-sending
## E. Collection management

- [x] there's no button to create a new collection, just to open one
- [ ] migration for bruno collections (big — own project, needs a .bru
      parser)

## F. Viewer / response enhancements — one CodeMirror batch

- [x] body parsing: JSON linting in the body editor for direct user
      feedback (@codemirror/lint + jsonParseLinter)
- [x] ResponseViewer: search inside the json response (⌘F when the viewer
      is focused, via @codemirror/search)
- [ ] ResponseViewer: VS-Code-style sticky scroll — the enclosing top-level
      element stays pinned while scrolling (genuinely hard in CM6; deferred)
- [x] on hovering in the response timeline tab, the preview should switch to
      the hovered item so the run can be inspected without opening it

## G. Sidebar

- [x] can't resize request browser (sidebar width is fixed — reuse SplitPane)

## H. Process (not a fix)

- [ ] recurring code review check (SOLID, Clean Code, test coverage,
      redundancy check, sanity check) — run after batches A–C have landed
