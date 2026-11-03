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
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pelletier/go-toml/v2"
)

func TestStorePersistsAndPublishesCredentialRotation(t *testing.T) {
	path := filepath.Join(t.TempDir(), "guest-init.toml")
	cfg := validTestConfig()
	data, err := toml.Marshal(cfg)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}

	store, err := OpenStore(path)
	if err != nil {
		t.Fatal(err)
	}
	nextToken := strings.Repeat("b", 64)
	if err := store.Update(func(next *Config) error {
		next.GuestServiceTokens["test-service"] = nextToken
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if got := store.Snapshot().GuestServiceTokens["test-service"]; got != nextToken {
		t.Fatalf("guest service token = %q, want rotated token", got)
	}
	reloaded, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.GuestServiceTokens["test-service"] != nextToken {
		t.Fatalf("persisted guest service token = %q, want rotated token", reloaded.GuestServiceTokens["test-service"])
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if permissions := info.Mode().Perm(); permissions != 0o600 {
		t.Fatalf("config permissions = %o, want 600", permissions)
	}
}

func TestLoadRejectsMissingInternalConfiguration(t *testing.T) {
	_, err := Load(filepath.Join(t.TempDir(), "missing.toml"))
	if err == nil {
		t.Fatal("expected missing guest init configuration to fail")
	}
}

func TestLoadRejectsUnknownConfiguration(t *testing.T) {
	path := filepath.Join(t.TempDir(), "guest-init.toml")
	data, err := toml.Marshal(validTestConfig())
	if err != nil {
		t.Fatal(err)
	}
	data = append(data, []byte("unknown_setting = true\n")...)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Fatal("expected unknown guest init configuration to fail closed")
	}
}

func validTestConfig() Config {
	cfg := Defaults()
	cfg.InstanceID = "00000000-0000-4000-8000-000000000002"
	cfg.GenerationID = "generation-1"
	cfg.GuestServiceTokens = map[string]string{"test-service": strings.Repeat("a", 64)}
	cfg.ControlAuthToken = strings.Repeat("c", 64)
	return cfg
}
