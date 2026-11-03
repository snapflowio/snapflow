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

package forkvm

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestSharedSnapshotFileIsLinkedNotCopied(t *testing.T) {
	if os.Geteuid() != 0 {
		t.Skip("sharing a snapshot file assigns root ownership")
	}
	root := t.TempDir()
	source := filepath.Join(root, "seed", "memory")
	writeSnapshotSeed(t, source)
	if shared, err := IsSharedSnapshotFile(source); err != nil || shared {
		t.Fatalf("private snapshot reported shared = %v, %v", shared, err)
	}
	if err := ShareSnapshotFile(source); err != nil {
		t.Fatalf("ShareSnapshotFile() error = %v", err)
	}
	if shared, err := IsSharedSnapshotFile(source); err != nil || !shared {
		t.Fatalf("shared snapshot reported shared = %v, %v", shared, err)
	}

	target := filepath.Join(root, "jail", "restore", "memory")
	if err := LinkSharedSnapshotFile(source, target); err != nil {
		t.Fatalf("LinkSharedSnapshotFile() error = %v", err)
	}
	if err := LinkSharedSnapshotFile(source, target); err != nil {
		t.Fatalf("re-staging a shared snapshot file error = %v", err)
	}
	assertSharedInode(t, source, target)
}

func writeSnapshotSeed(t *testing.T, source string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(source), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(source, []byte("guest memory"), 0o600); err != nil {
		t.Fatal(err)
	}
}

func assertSharedInode(t *testing.T, source, target string) {
	t.Helper()
	sourceInfo, err := os.Stat(source)
	if err != nil {
		t.Fatal(err)
	}
	targetInfo, err := os.Stat(target)
	if err != nil {
		t.Fatal(err)
	}
	if !os.SameFile(sourceInfo, targetInfo) {
		t.Fatal("staged snapshot memory is a copy, not the shared inode")
	}
	stat, ok := targetInfo.Sys().(*syscall.Stat_t)
	if !ok || stat.Nlink != 2 {
		t.Fatalf("shared inode link count = %v, want 2", targetInfo.Sys())
	}
	if targetInfo.Mode().Perm() != 0o444 {
		t.Fatalf("shared snapshot mode = %v, want read-only", targetInfo.Mode().Perm())
	}
}

func TestIsSharedSnapshotFileRejectsNonRegularFiles(t *testing.T) {
	if _, err := IsSharedSnapshotFile(t.TempDir()); err == nil {
		t.Fatal("a directory was accepted as a snapshot file")
	}
}
