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

package config

import (
	"bytes"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/pelletier/go-toml/v2"
	"github.com/snapflowio/microvm-go/guest"
	"github.com/snapflowio/microvm-go/internal/atomicfile"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const (
	DefaultConfigPath  = "/etc/snapflow/guest-init.toml"
	DefaultProjectDir  = "/root"
	DefaultOSUser      = "root"
	DefaultLogLevel    = "info"
	DefaultLogFilePath = "/tmp/snapflow-guest-init.log"

	minimumAuthTokenLength = 32
)

type Config struct {
	ProjectDir         string                `json:"projectDir" toml:"project_dir"`
	OSUser             string                `json:"osUser" toml:"os_user"`
	LogLevel           string                `json:"logLevel" toml:"log_level"`
	LogFilePath        string                `json:"logFilePath" toml:"log_file_path"`
	InstanceID         string                `json:"instanceId" toml:"instance_id"`
	GenerationID       string                `json:"generationId" toml:"generation_id"`
	GuestServiceTokens map[string]string     `json:"guestServiceTokens,omitempty" toml:"guest_service_tokens,omitempty"`
	ControlAuthToken   string                `json:"controlAuthToken" toml:"control_auth_token"`
	ComponentHooks     []guest.LifecycleHook `json:"componentHooks,omitempty" toml:"component_hooks,omitempty"`
	DeferredWorkload   bool                  `json:"deferredWorkload,omitempty" toml:"deferred_workload,omitempty"`
}

type Store struct {
	mu   sync.RWMutex
	path string
	cfg  Config
}

func Load(path string) (*Config, error) {
	if strings.TrimSpace(path) == "" {
		path = DefaultConfigPath
	}

	cfg := Defaults()
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read guest init config %s: %w", path, err)
	}
	decoder := toml.NewDecoder(bytes.NewReader(data)).DisallowUnknownFields()
	if err := decoder.Decode(&cfg); err != nil {
		return nil, fmt.Errorf("decode guest init config %s: %w", path, err)
	}
	cfg.applyDefaults()
	if err := cfg.Validate(); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func OpenStore(path string) (*Store, error) {
	cfg, err := Load(path)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(path) == "" {
		path = DefaultConfigPath
	}
	return &Store{path: path, cfg: *cfg}, nil
}

func (s *Store) Snapshot() Config {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := s.cfg
	result.GuestServiceTokens = maps.Clone(s.cfg.GuestServiceTokens)
	result.ComponentHooks = append([]guest.LifecycleHook(nil), s.cfg.ComponentHooks...)
	return result
}

func (s *Store) Update(update func(*Config) error) error {
	if update == nil {
		return fmt.Errorf("guest init config update is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	next := s.cfg
	next.GuestServiceTokens = maps.Clone(s.cfg.GuestServiceTokens)
	next.ComponentHooks = append([]guest.LifecycleHook(nil), s.cfg.ComponentHooks...)
	if err := update(&next); err != nil {
		return err
	}
	next.applyDefaults()
	if err := next.Validate(); err != nil {
		return err
	}
	data, err := toml.Marshal(next)
	if err != nil {
		return fmt.Errorf("encode guest init config: %w", err)
	}
	if err := atomicfile.Replace(s.path, data, filemode.PrivateFile); err != nil {
		return fmt.Errorf("persist guest init config %s: %w", s.path, err)
	}
	if err := atomicfile.Commit(s.path); err != nil {
		return fmt.Errorf("persist guest init config %s: %w", s.path, err)
	}
	s.cfg = next
	return nil
}

func Defaults() Config {
	return Config{
		ProjectDir:  DefaultProjectDir,
		OSUser:      DefaultOSUser,
		LogLevel:    DefaultLogLevel,
		LogFilePath: DefaultLogFilePath,
	}
}

func (c *Config) applyDefaults() {
	defaults := Defaults()
	if strings.TrimSpace(c.ProjectDir) == "" {
		c.ProjectDir = defaults.ProjectDir
	}
	if strings.TrimSpace(c.OSUser) == "" {
		c.OSUser = defaults.OSUser
	}
	if strings.TrimSpace(c.LogLevel) == "" {
		c.LogLevel = defaults.LogLevel
	}
	if strings.TrimSpace(c.LogFilePath) == "" {
		c.LogFilePath = defaults.LogFilePath
	}
	c.ProjectDir = filepath.Clean(c.ProjectDir)
	c.LogFilePath = filepath.Clean(c.LogFilePath)
	c.LogLevel = strings.ToLower(strings.TrimSpace(c.LogLevel))
}

func (c Config) Validate() error {
	var logLevel slog.Level
	if err := logLevel.UnmarshalText([]byte(c.LogLevel)); err != nil {
		return fmt.Errorf("guest init log_level: %w", err)
	}
	if c.ProjectDir == "." || !filepath.IsAbs(c.ProjectDir) {
		return fmt.Errorf("guest init project_dir must be an absolute path, got %q", c.ProjectDir)
	}
	if strings.TrimSpace(c.OSUser) == "" {
		return errors.New("guest init os_user is required")
	}
	if c.LogFilePath == "." || !filepath.IsAbs(c.LogFilePath) {
		return fmt.Errorf("guest init log_file_path must be an absolute path, got %q", c.LogFilePath)
	}
	if err := c.validateIdentity(); err != nil {
		return err
	}
	return c.validateComponentHooks()
}

func (c Config) validateIdentity() error {
	if strings.TrimSpace(c.InstanceID) == "" {
		return errors.New("guest init instance_id is required")
	}
	if uuid.Validate(c.InstanceID) != nil {
		return errors.New("guest init instance_id must be a UUID")
	}
	if strings.TrimSpace(c.GenerationID) == "" {
		return errors.New("guest init generation_id is required")
	}
	if len(c.ControlAuthToken) < minimumAuthTokenLength {
		return errors.New("guest init control authentication token must contain at least 32 characters")
	}
	for name, token := range c.GuestServiceTokens {
		if strings.TrimSpace(name) == "" || len(token) < minimumAuthTokenLength {
			return errors.New("guest init guest service tokens require a name and at least 32 characters")
		}
	}
	return nil
}

func (c Config) validateComponentHooks() error {
	hookNames := make(map[string]struct{}, len(c.ComponentHooks))
	for _, hook := range c.ComponentHooks {
		if strings.TrimSpace(hook.Name) == "" || !filepath.IsAbs(hook.SocketPath) || filepath.Clean(hook.SocketPath) != hook.SocketPath {
			return errors.New("guest init component hooks require a name and clean absolute socket path")
		}
		if _, exists := hookNames[hook.Name]; exists {
			return fmt.Errorf("guest init component hook %q is duplicated", hook.Name)
		}
		hookNames[hook.Name] = struct{}{}
	}
	return nil
}
