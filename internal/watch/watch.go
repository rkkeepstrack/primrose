// Package watch notifies about external changes to collection folders
// (git pull, edits in another editor) using native OS file events.
package watch

import (
	"io/fs"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

// DefaultDebounce collapses event bursts (a git pull touches many files)
// into a single notification per collection.
const DefaultDebounce = 200 * time.Millisecond

type Service struct {
	watcher  *fsnotify.Watcher
	onChange func(root string) // called after debounce, from a goroutine
	debounce time.Duration

	mu     sync.Mutex
	roots  []string
	timers map[string]*time.Timer
}

func New(onChange func(root string)) (*Service, error) {
	w, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}
	s := &Service{
		watcher:  w,
		onChange: onChange,
		debounce: DefaultDebounce,
		timers:   map[string]*time.Timer{},
	}
	go s.run()
	return s, nil
}

// AddRoot starts watching a collection folder recursively. Adding the same
// root twice is a no-op.
func (s *Service) AddRoot(root string) error {
	s.mu.Lock()
	if slices.Contains(s.roots, root) {
		s.mu.Unlock()
		return nil
	}
	s.roots = append(s.roots, root)
	s.mu.Unlock()
	return s.addDirTree(root)
}

func (s *Service) Close() error {
	return s.watcher.Close()
}

// addDirTree registers watches for dir and every subdirectory, skipping
// hidden ones (notably .git, whose churn we must not watch).
func (s *Service) addDirTree(dir string) error {
	return filepath.WalkDir(dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || !d.IsDir() {
			return nil //nolint:nilerr // unreadable subdirs are skipped, not fatal
		}
		if name := filepath.Base(path); strings.HasPrefix(name, ".") && path != dir {
			return filepath.SkipDir
		}
		return s.watcher.Add(path)
	})
}

func (s *Service) run() {
	for {
		select {
		case ev, ok := <-s.watcher.Events:
			if !ok {
				return
			}
			if s.hidden(ev.Name) {
				continue
			}
			// new directories must be watched as they appear
			if ev.Op.Has(fsnotify.Create) {
				_ = s.addDirTree(ev.Name) // fails harmlessly for plain files
			}
			if root := s.rootOf(ev.Name); root != "" {
				s.schedule(root)
			}
		case _, ok := <-s.watcher.Errors:
			if !ok {
				return
			}
		}
	}
}

func (s *Service) hidden(path string) bool {
	for _, part := range strings.Split(path, string(filepath.Separator)) {
		if strings.HasPrefix(part, ".") && part != "." && part != ".." {
			return true
		}
	}
	return false
}

// rootOf resolves which watched collection a changed path belongs to
// (longest prefix wins, in case of nested roots).
func (s *Service) rootOf(path string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	best := ""
	for _, r := range s.roots {
		if (path == r || strings.HasPrefix(path, r+string(filepath.Separator))) && len(r) > len(best) {
			best = r
		}
	}
	return best
}

func (s *Service) schedule(root string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if t, ok := s.timers[root]; ok {
		t.Reset(s.debounce)
		return
	}
	s.timers[root] = time.AfterFunc(s.debounce, func() {
		s.mu.Lock()
		delete(s.timers, root)
		s.mu.Unlock()
		s.onChange(root)
	})
}
