// Copyright (c) 2026 Snapflow. All rights reserved.
//
// Snapflow is licensed under the GNU Affero General Public License v3.0.
// You may obtain a copy of the license at https://www.gnu.org/licenses/agpl-3.0.html
//
// SPDX-License-Identifier: AGPL-3.0

package statefile

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadOrCreateSecretPersistsStableRestrictedState(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	first, err := LoadOrCreateSecret(directory, "quic-server-secret", 32)
	if err != nil {
		t.Fatalf("create state secret: %v", err)
	}
	second, err := LoadOrCreateSecret(directory, "quic-server-secret", 32)
	if err != nil {
		t.Fatalf("reload state secret: %v", err)
	}
	if !bytes.Equal(first, second) {
		t.Fatal("state secret changed across reload")
	}
	info, err := os.Stat(filepath.Join(directory, "quic-server-secret"))
	if err != nil {
		t.Fatalf("inspect state secret: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("state secret mode = %o, want 600", info.Mode().Perm())
	}
}

func TestLoadOrCreateSecretRejectsCorruptState(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	path := filepath.Join(directory, "quic-server-secret")
	if err := os.WriteFile(path, []byte("short"), 0o600); err != nil {
		t.Fatalf("write corrupt state secret: %v", err)
	}
	if _, err := LoadOrCreateSecret(directory, "quic-server-secret", 32); err == nil {
		t.Fatal("corrupt state secret was replaced instead of rejected")
	}
}

func TestLoadOrCreateSecretRejectsSymbolicLink(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	target := filepath.Join(directory, "target")
	if err := os.WriteFile(target, make([]byte, 32), 0o600); err != nil {
		t.Fatalf("write symbolic-link target: %v", err)
	}
	if err := os.Symlink(target, filepath.Join(directory, "quic-server-secret")); err != nil {
		t.Fatalf("create state secret symbolic link: %v", err)
	}
	if _, err := LoadOrCreateSecret(directory, "quic-server-secret", 32); err == nil {
		t.Fatal("symbolic-link state secret was accepted")
	}
}
