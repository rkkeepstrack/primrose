package appstate

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// State is UI state that survives restarts. Lives in the user config dir,
// never inside a collection.
type State struct {
	OpenRoots  []string `json:"openRoots"`
	ActiveRoot string   `json:"activeRoot"`
}

func statePath() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "primrose", "state.json"), nil
}

// Load returns the saved state, or an empty one if none exists.
func Load() (*State, error) {
	path, err := statePath()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return &State{OpenRoots: []string{}}, nil
	}
	if err != nil {
		return nil, err
	}
	var s State
	if err := json.Unmarshal(data, &s); err != nil {
		return &State{OpenRoots: []string{}}, nil // corrupt state: start fresh
	}
	if s.OpenRoots == nil {
		s.OpenRoots = []string{}
	}
	return &s, nil
}

// Save writes the state, creating the config dir if needed.
func Save(s *State) error {
	path, err := statePath()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
