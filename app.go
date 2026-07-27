package main

import (
	"context"
	"fmt"
	"sync"

	"primrose/internal/appstate"
	"primrose/internal/collection"
	"primrose/internal/env"
	"primrose/internal/httpclient"
	"primrose/internal/watch"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx     context.Context
	watcher *watch.Service

	sendMu     sync.Mutex
	cancelSend context.CancelFunc
	sendSeq    uint64
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// external edits to open collections (git pull, other editors) are
	// pushed to the frontend as "collection:changed" events
	w, err := watch.New(func(root string) {
		runtime.EventsEmit(a.ctx, "collection:changed", root)
	})
	if err == nil {
		a.watcher = w
	}
}

// appMenu builds the native menu; items emit events the frontend handles,
// so the menu doubles as the visible home of the keyboard shortcuts.
func (a *App) appMenu() *menu.Menu {
	emit := func(event string) func(*menu.CallbackData) {
		return func(*menu.CallbackData) { runtime.EventsEmit(a.ctx, event) }
	}

	root := menu.NewMenu()
	root.Append(menu.AppMenu())

	file := root.AddSubmenu("File")
	file.AddText("New Request", keys.CmdOrCtrl("n"), emit("menu:new-request"))
	file.AddText("New Collection…", nil, emit("menu:new-collection"))
	file.AddText("Open Collection…", keys.CmdOrCtrl("o"), emit("menu:open-collection"))
	file.AddSeparator()
	file.AddText("Save Request", keys.CmdOrCtrl("s"), emit("menu:save"))
	file.AddSeparator()
	file.AddText("Close Tab", keys.CmdOrCtrl("w"), emit("menu:close-tab"))

	root.Append(menu.EditMenu()) // native clipboard handling

	view := root.AddSubmenu("View")
	view.AddText("Quick Open Search", keys.CmdOrCtrl("p"), emit("menu:quick-open"))
	view.AddText("Keyboard Shortcuts", keys.CmdOrCtrl("k"), emit("menu:shortcuts"))

	return root
}

// ChooseDirectory shows a folder picker (empty string on cancel).
func (a *App) ChooseDirectory(title string) (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{Title: title})
}

// CreateCollection creates a new collection folder inside parent and opens it.
func (a *App) CreateCollection(parent, name string) (*collection.Collection, error) {
	dir, err := collection.CreateFolder(parent, name)
	if err != nil {
		return nil, err
	}
	col, err := collection.Open(dir)
	if err == nil {
		a.watchCollection(dir)
	}
	return col, err
}

func (a *App) shutdown(_ context.Context) {
	if a.watcher != nil {
		a.watcher.Close()
	}
}

func (a *App) watchCollection(root string) {
	if a.watcher != nil {
		_ = a.watcher.AddRoot(root)
	}
}

// OpenCollectionDialog shows a folder picker and opens the chosen collection.
// Returns nil if the user cancels.
func (a *App) OpenCollectionDialog() (*collection.Collection, error) {
	dir, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Open Collection Folder",
	})
	if err != nil {
		return nil, err
	}
	if dir == "" {
		return nil, nil
	}
	col, err := collection.Open(dir)
	if err == nil {
		a.watchCollection(dir)
	}
	return col, err
}

// OpenCollection opens a collection from a known path (e.g. recents).
func (a *App) OpenCollection(root string) (*collection.Collection, error) {
	col, err := collection.Open(root)
	if err == nil {
		a.watchCollection(root)
	}
	return col, err
}

// GetTree rescans a collection folder and returns the fresh tree.
func (a *App) GetTree(root string) (*collection.Collection, error) {
	return collection.Open(root)
}

// ReadRequest loads a single request file.
func (a *App) ReadRequest(path string) (*collection.Request, error) {
	r, err := collection.ReadRequest(path)
	if err != nil {
		return nil, fmt.Errorf("reading request: %w", err)
	}
	return r, nil
}

// CreateRequest writes a brand-new request file into dir and returns its path.
// Fails if a request with that name already exists.
func (a *App) CreateRequest(dir, name string, r collection.Request) (string, error) {
	return collection.CreateRequest(dir, name, &r)
}

// CreateFolder creates a subfolder inside dir.
func (a *App) CreateFolder(dir, name string) (string, error) {
	return collection.CreateFolder(dir, name)
}

// MoveItem moves a request file or folder into destDir.
func (a *App) MoveItem(src, destDir string) (string, error) {
	return collection.MoveItem(src, destDir)
}

// RenameItem renames a request file or folder.
func (a *App) RenameItem(path, newName string) (string, error) {
	return collection.RenameItem(path, newName)
}

// DeleteItem deletes a request file or folder (recursively).
func (a *App) DeleteItem(path string) error {
	return collection.DeleteItem(path)
}

// DuplicateItem copies a request file or folder with a -copy suffix.
func (a *App) DuplicateItem(path string) (string, error) {
	return collection.DuplicateItem(path)
}

// SaveRequest writes a request back to its TOML file.
func (a *App) SaveRequest(path string, r collection.Request) error {
	return collection.WriteRequest(path, &r)
}

// SendRequest merges inherited collection headers, resolves {{env}} and
// :dynamic variables, then executes the request. Cancellable via
// CancelRequest.
func (a *App) SendRequest(r collection.Request, envVars, dynamicVars, inheritedHeaders map[string]string) (*httpclient.Response, error) {
	r.Headers = collection.MergeHeaders(inheritedHeaders, r.Headers)
	ctx, cancel := context.WithCancel(context.Background())
	a.sendMu.Lock()
	a.sendSeq++
	seq := a.sendSeq
	a.cancelSend = cancel
	a.sendMu.Unlock()
	defer func() {
		a.sendMu.Lock()
		// only clear the slot if it still belongs to this send — a newer
		// send may have replaced it in the meantime
		if a.sendSeq == seq {
			a.cancelSend = nil
		}
		a.sendMu.Unlock()
		cancel()
	}()

	resolved := collection.Resolve(&r, envVars, dynamicVars)
	resp, err := httpclient.SendCtx(ctx, resolved)
	if ctx.Err() == context.Canceled {
		return nil, fmt.Errorf("canceled")
	}
	return resp, err
}

// LoadUIState returns the persisted UI state (open collections etc).
func (a *App) LoadUIState() (*appstate.State, error) {
	return appstate.Load()
}

// SaveUIState persists the UI state.
func (a *App) SaveUIState(s appstate.State) error {
	return appstate.Save(&s)
}

// CancelRequest aborts the in-flight request, if any.
func (a *App) CancelRequest() {
	a.sendMu.Lock()
	defer a.sendMu.Unlock()
	if a.cancelSend != nil {
		a.cancelSend()
	}
}

// ListEnvironments returns the environments of a collection.
func (a *App) ListEnvironments(root string) ([]env.Environment, error) {
	return env.List(root)
}

// SaveEnvironment writes an environment file back to disk.
func (a *App) SaveEnvironment(root, name string, vars, headers map[string]string) error {
	return env.Save(root, name, vars, headers)
}

// DeleteEnvironment removes an environment file.
func (a *App) DeleteEnvironment(root, name string) error {
	return env.Delete(root, name)
}

// RenameEnvironment renames an environment.
func (a *App) RenameEnvironment(root, oldName, newName string) error {
	return env.Rename(root, oldName, newName)
}

// DuplicateEnvironment copies an environment, returns the new name.
func (a *App) DuplicateEnvironment(root, name string) (string, error) {
	return env.Duplicate(root, name)
}
