package main

import (
	"context"
	"fmt"

	"primrose/internal/collection"
	"primrose/internal/env"
	"primrose/internal/httpclient"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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
	return collection.Open(dir)
}

// OpenCollection opens a collection from a known path (e.g. recents).
func (a *App) OpenCollection(root string) (*collection.Collection, error) {
	return collection.Open(root)
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

// SaveRequest writes a request back to its TOML file.
func (a *App) SaveRequest(path string, r collection.Request) error {
	return collection.WriteRequest(path, &r)
}

// SendRequest resolves {{env}} and /:dynamic variables, then executes the
// request and returns the response.
func (a *App) SendRequest(r collection.Request, envVars, dynamicVars map[string]string) (*httpclient.Response, error) {
	resolved := collection.Resolve(&r, envVars, dynamicVars)
	return httpclient.Send(resolved)
}

// ListEnvironments returns the environments of a collection.
func (a *App) ListEnvironments(root string) ([]env.Environment, error) {
	return env.List(root)
}

// SaveEnvironment writes an environment file back to disk.
func (a *App) SaveEnvironment(root, name string, vars map[string]string) error {
	return env.Save(root, name, vars)
}
