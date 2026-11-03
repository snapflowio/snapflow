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
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

const testMode = os.FileMode(0o640)

func TestWriteFileReplacesContentWithMode(t *testing.T) {
	directory := t.TempDir()
	path := filepath.Join(directory, "state.json")
	if err := os.WriteFile(path, []byte("old"), os.FileMode(0o600)); err != nil {
		t.Fatal(err)
	}
	if err := WriteFile(path, []byte("new"), testMode); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(content, []byte("new")) {
		t.Fatalf("content = %q, want %q", content, "new")
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != testMode {
		t.Fatalf("mode = %v, want %v", info.Mode().Perm(), testMode)
	}
	entries, err := os.ReadDir(directory)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		t.Fatalf("directory has %d entries, want only the target file", len(entries))
	}
}

func TestWriteFileFailsWithoutDirectory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "missing", "state.json")
	if err := WriteFile(path, []byte("data"), testMode); err == nil {
		t.Fatal("WriteFile() succeeded without a parent directory")
	}
}
