# Primrose — Plan

A fast, git-friendly desktop API client (Bruno-inspired). Collections are plain folders of TOML files on disk.

Mockups: see `01`–`05` PNGs in this directory.

## Stack

- **Backend:** Go (HTTP engine, file I/O, TOML parsing)
- **Shell:** Wails v2 (native webview, Go↔JS bindings)
- **Frontend:** Svelte + TypeScript
- **Editor component:** CodeMirror 6 (body editor, response viewer, URL bar with `{{var}}` highlighting)
- **TOML:** `github.com/BurntSushi/toml`

## Decisions (interview results)

| Topic | Decision |
|---|---|
| Request file format | **TOML**, one file per request (`.toml`) — extensible, no significant indentation |
| Environments | **Per collection**, stored as TOML inside the collection folder, git-versioned |
| Opening collections | **Open any folder** via file dialog; app remembers recent collections |
| V1 scope | **Core only** (no auth helpers, curl import, cookies yet) |
| Timeline tab | **History of past runs** (status, duration; click to view old response) |
| Tree ordering | **Alphabetical** — no order metadata; drag & drop moves files between folders |
| Run history & dynamic variables | **Session only**, in memory, never written to disk |

## On-disk layout of a collection

```
my-collection/
├── primrose.toml            # marks folder as collection; name, meta
├── environments/
│   ├── staging.toml         # [vars] cms_api_url = "...", hb_or_wiwo = "hb"
│   └── production.toml
├── get-teasers.toml         # root-level request
└── teasers/                 # folder = tree folder
    └── create-teaser.toml
```

### Request file format

```toml
method = "GET"
url = "{{cms_api_url}}/api/v1/{{hb_or_wiwo}}/teasers"

[query]
teaserGalleryId = "500070228"

[headers]
Accept = "application/json"

[body]
type = "json"      # "json" | "text"
content = '''
{ "hello": "world" }
'''
```

Request name = filename. Folder hierarchy = sidebar hierarchy, always mirrored 1:1.

## Variables

- `{{env_var}}` — resolved from the collection's selected environment; highlighted green in the URL/CodeMirror.
- `:dynamicVar` in the URL path — session-only values, editable in the request's **Env** tab, never persisted.
- Request Env tab shows exactly the variables used by the current request (env + dynamic).

## Design language

- **System font** everywhere (`system-ui`); monospace only for JSON body content.
- **Low contrast:** 1px light-gray borders (`#e0e0e0`-ish), muted text, no heavy outlines.
- **Primrose palette:** yellow, orange, green, white. White base, pale-yellow active/selection states, green + orange as accents (e.g. method colors, active tab underline).
- **Variable highlighting** (milestone 3): `{{env_var}}` and `:dynamicVar` tokens tinted (green per mockups) in URL bar and body via CodeMirror decorations.

## Recency heatmap (instead of request tabs)

Postman/Bruno open every request in its own tab; Primrose deliberately does not. Instead, the sidebar visualizes which requests were touched recently:

- Background-color highlight on request rows in the tree, as a **gradient over the last 20 clicked requests** — most recently opened is strongest, dimming with each older touch.
- Uses the primrose-yellow tint on white, staying within the low-contrast design.
- Toggleable via a **search filter** (e.g. a `recent` filter/toggle in the sidebar search bar) so the heatmap can be turned on/off or used to show only recently touched requests.
- Session-only state (like run history and dynamic variables) — never persisted.

## UI structure (per mockups)

- **Top bar:** one tab per open collection + an Environment tab (per-collection env editor with search).
- **Sidebar:** `+` (new root request), current-environment button (top right), fuzzy search, folder/request tree. Native drag & drop (moves files). `+` on folder → modal: duplicate / rename / delete / new request. New request initializes directly in detail view (no modal).
- **Request pane:** method chip (click → GET/POST/PUT/DELETE… popup), URL bar with variable highlighting, tabs: **Query | Body | Headers | Env**. Query & Headers are key-value tables; Body has json|text switch with CodeMirror.
- **Response pane:** tabs **Response | Headers | Timeline**. Pretty-printed JSON preview (CodeMirror, folding), response headers, run history for the session.

## Architecture

- **Go side (`internal/`):**
  - `collection`: scan folder → tree; read/write request TOML; fsnotify watcher so external edits (git pull, editor) refresh the UI
  - `env`: load environments, resolve `{{vars}}` and `:dynamicVars` at send time
  - `httpclient`: build & send request (`net/http`), capture status/headers/body/duration
  - `history`: in-memory per-session run log
  - Wails-bound `App` struct exposing: OpenCollection, GetTree, ReadRequest, SaveRequest, SendRequest, ListEnvs, SaveEnv, MoveRequest, Duplicate/Rename/Delete
- **Svelte side (`frontend/`):**
  - Stores: open collections, active tab, selected request (dirty state), selected env, session history, dynamic vars
  - Components: CollectionTabs, Sidebar (tree + search), RequestEditor (url bar, tabs), KeyValueTable, BodyEditor, ResponsePane, EnvEditor, FolderModal
  - Fuzzy search client-side over the loaded tree

## Milestones

1. **Skeleton** — Wails + Svelte scaffold, open a collection folder, render tree from disk, read a request TOML into the detail view.
2. **Send loop** — URL/method/query/headers/body editing, save to TOML, send via Go, show response with JSON pretty-print.
3. **Environments** — env files, env switcher, `{{var}}` resolution + highlighting, Env tab (request-level), Environment editor tab (collection-level).
4. **Tree UX** — fuzzy search, drag & drop moves, folder `+` modal (duplicate/rename/delete/new), new-request flow, multiple collection tabs, recency heatmap (last-20 gradient + search filter toggle).
5. **Polish** — dynamic `:vars`, Timeline run history, response headers tab, fsnotify live reload.
6. **Keyboard shortcuts & actions** — full shortcut pass: save (⌘S) and send (⌘↵) as first-class shortcuts, plus navigation (switch tabs/requests), searchable via a shortcut reference. Rework action placement: move the Save button out of the URL row (final home TBD), keep Send prominent.

## Later (explicitly out of v1)

"Copy as curl" button on a request, curl import, auth helpers (bearer/basic), cookie jar, request phase timings, scripting, GraphQL/WebSocket.
