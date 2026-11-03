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

package atomicfile

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReplaceInstallsContentAndModeWithoutTemporaryFiles(t *testing.T) {
	directory := t.TempDir()
	target := filepath.Join(directory, "nested", "record.json")
	for _, content := range []string{"first", "second"} {
		if err := Replace(target, []byte(content), 0o640); err != nil {
			t.Fatal(err)
		}
		data, err := os.ReadFile(target)
		if err != nil || string(data) != content {
			t.Fatalf("content = %q, %v; want %q", data, err, content)
		}
	}
	info, err := os.Stat(target)
	if err != nil || info.Mode().Perm() != 0o640 {
		t.Fatalf("mode = %v, %v; want 0640", info.Mode().Perm(), err)
	}
	entries, err := os.ReadDir(filepath.Dir(target))
	if err != nil || len(entries) != 1 {
		t.Fatalf("directory has %d entries, %v; want only the record", len(entries), err)
	}
}

func TestReplaceLeavesNoTemporaryFileOnFailure(t *testing.T) {
	directory := t.TempDir()
	occupied := filepath.Join(directory, "occupied")
	if err := os.MkdirAll(filepath.Join(occupied, "child"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := Replace(occupied, []byte("data"), 0o600); err == nil {
		t.Fatal("replacing a non-empty directory succeeded")
	}
	entries, err := os.ReadDir(directory)
	if err != nil || len(entries) != 1 {
		t.Fatalf("directory has %d entries, %v; want only the original directory", len(entries), err)
	}
}

func TestCommitSyncsFilesAndDirectories(t *testing.T) {
	directory := t.TempDir()
	first := filepath.Join(directory, "first")
	second := filepath.Join(directory, "second")
	for _, path := range []string{first, second} {
		if err := Replace(path, []byte("data"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := Commit(first, second); err != nil {
		t.Fatal(err)
	}
	if err := Commit(filepath.Join(directory, "missing")); err == nil {
		t.Fatal("committing a missing file succeeded")
	}
}

func TestCommitOfSeveralFilesInstallsEveryReplacement(t *testing.T) {
	root := t.TempDir()
	files := map[string]string{
		filepath.Join(root, "etc", "hostname"):                  "new-host",
		filepath.Join(root, "etc", "machine-id"):                "machine-id",
		filepath.Join(root, "var", "lib", "dbus", "machine-id"): "machine-id",
	}
	paths := make([]string, 0, len(files))
	for path, content := range files {
		if err := Replace(path, []byte(content), 0o444); err != nil {
			t.Fatalf("Replace(%s) error = %v", path, err)
		}
		paths = append(paths, path)
	}
	if err := Commit(paths...); err != nil {
		t.Fatalf("Commit() error = %v", err)
	}
	for path, want := range files {
		data, err := os.ReadFile(path)
		if err != nil || string(data) != want {
			t.Fatalf("%s = %q, %v; want %q", path, data, err, want)
		}
	}
	groups, err := groupByFilesystem(paths)
	if err != nil || len(groups) != 1 || len(groups[0]) != len(paths) {
		t.Fatalf("groupByFilesystem() = %v, %v; want one group with every path", groups, err)
	}
}
