package main

import (
	"context"
	"fmt"

	"primrose/internal/collection"

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
