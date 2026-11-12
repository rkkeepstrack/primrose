# README

#### Primrose is an API Client without Request-Tabs.

This way, Changes and Tabs can't clutter your UI and you don't have to ask yourself everytime when closing tabs if you REALLY want to discard your changes - you might need them again in a few years.

The way it works:

- The last 10 opened requests are colored in a gradient from red to blue in the sidebar, like a heatmap
- If a request is older than that and has changes, the changes are silently discarded
- There's an additional filter next to the request browser search bar that ONLY shows the last 10 requests without their respective folder hierarchy

<img width="2081" height="1067" alt="image" src="https://github.com/user-attachments/assets/8306b349-c648-4d4b-9c61-f38b59eaa395" />

#### ...and almost without annoying popups dialogs that disturb the working flow.

Other API Clients tend to ask way too much stuff. This one only asks if you want to close a collection or discard changes on the environment.

#### No Proprietary Formats

The File Format for collections relies on .toml, which is not as bad as .yaml and way more human readable. Also, it does not break instantly because you missed a - or some indentation.
Hierarchy in the Files automatically represent how it will look in-application in the request browser.

#### Git-Friendly

All Requests and folders are just sorted alphabetically, so no information about structure has to be stored anywhere - which makes it a charm to work with in git.

Just store your Primrose collection with your application and push new requests directly with the corresponding PR.

#### There's shortcuts!

With super+k you can see all available shortcuts.

## Quickstart

### Run

Grab the latest build for your OS from the [Releases](https://github.com/rkkeepstrack/primrose/releases) page, unzip it, and launch it. On macOS the app is unsigned, so on first launch you may need to right-click → Open.

### Development

Requires Go 1.25+, Node 22+, and the [Wails CLI](https://wails.io/docs/gettingstarted/installation) (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`).

```sh
wails dev          # run the app with hot reload
go test ./...      # backend tests
cd frontend && npm test   # frontend tests
make snapshots            # screenshot tests, in the Playwright container (needs Docker)
make snapshots-update     # accept new baselines (frontend/e2e/__snapshots__)
```

The screenshots run against a fake backend fed by `frontend/e2e/fixture.json`, which `make fixture` regenerates from the demo collection in `frontend/e2e/pet-store`.

### Deployment

GitHub Actions builds macOS, Windows, and Linux binaries and publishes them as a GitHub Release. Either run the "Release" workflow from the Actions tab (it tags for you), or push a tag manually:

```sh
gh workflow run release.yml -f version=v0.1.0
# or: git tag v0.1.0 && git push origin v0.1.0
```

### License

Primrose is free for personal and other noncommercial use under the [PolyForm Noncommercial License 1.0.0](LICENSE.md) — use it, modify it, share it, just not commercially.
