// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

package computeruse

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"golang.org/x/sys/unix"
)

const (
	credentialWatchEvents     = unix.IN_MOVED_TO | unix.IN_CLOSE_WRITE
	credentialWatchFlags      = unix.IN_CLOEXEC | unix.IN_NONBLOCK
	credentialWatchName       = "desktop-credential-watch"
	credentialEventBufferSize = 64 * (unix.SizeofInotifyEvent + unix.NAME_MAX + 1)
)

type kasmPasswordSyncConfig struct {
	Source    desktopCredentialSource
	ConfigDir string
}

type kasmPasswordSync struct {
	source    desktopCredentialSource
	configDir string
	events    *os.File
	done      chan struct{}

	mu           sync.RWMutex
	passwordFile string
	credential   desktopCredential
}

func newKasmPasswordSync(cfg kasmPasswordSyncConfig) (*kasmPasswordSync, error) {
	if strings.TrimSpace(cfg.Source.user) == "" {
		return nil, errors.New("desktop credential user is required")
	}
	if !filepath.IsAbs(cfg.Source.file) {
		return nil, errors.New("desktop credential file must be an absolute path")
	}
	if strings.TrimSpace(cfg.ConfigDir) == "" {
		return nil, errors.New("KasmVNC config directory is required")
	}
	syncer := &kasmPasswordSync{source: cfg.Source, configDir: cfg.ConfigDir, done: make(chan struct{})}
	events, err := watchCredentialDirectory(filepath.Dir(cfg.Source.file))
	if err != nil {
		return nil, err
	}
	syncer.events = events
	if err := syncer.sync(); err != nil {
		return nil, errors.Join(err, events.Close())
	}
	go syncer.watch()
	return syncer, nil
}

func watchCredentialDirectory(directory string) (*os.File, error) {
	descriptor, err := unix.InotifyInit1(credentialWatchFlags)
	if err != nil {
		return nil, fmt.Errorf("create desktop credential watch: %w", err)
	}
	events := os.NewFile(uintptr(descriptor), credentialWatchName)
	if _, err := unix.InotifyAddWatch(descriptor, directory, credentialWatchEvents); err != nil {
		return nil, errors.Join(fmt.Errorf("watch desktop credential directory %s: %w", directory, err), events.Close())
	}
	return events, nil
}

func (s *kasmPasswordSync) PasswordFile() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.passwordFile
}

func (s *kasmPasswordSync) Credential() desktopCredential {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.credential
}

func (s *kasmPasswordSync) Close() error {
	if err := s.events.Close(); err != nil {
		return fmt.Errorf("close desktop credential watch: %w", err)
	}
	<-s.done
	return nil
}

func (s *kasmPasswordSync) watch() {
	defer close(s.done)
	buffer := make([]byte, credentialEventBufferSize)
	for {
		if _, err := s.events.Read(buffer); err != nil {
			if !errors.Is(err, os.ErrClosed) {
				slog.Error("Desktop credential watch stopped", "error", err)
			}
			return
		}
		if err := s.sync(); err != nil {
			slog.Error("Failed to apply rotated desktop credential", "error", err)
		}
	}
}

func (s *kasmPasswordSync) sync() error {
	credential, err := readDesktopCredential(s.source)
	if err != nil {
		return err
	}
	if credential == s.Credential() {
		return nil
	}
	passwordFile, err := writeKasmPasswordFile(s.configDir, credential)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.passwordFile = passwordFile
	s.credential = credential
	return nil
}
