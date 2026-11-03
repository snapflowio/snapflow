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
	"testing"
)

func TestCopyDirCopiesFilesAndSkipsRuntimeArtifacts(t *testing.T) {
	src := t.TempDir()
	dst := t.TempDir()

	if err := os.WriteFile(filepath.Join(src, "data.txt"), []byte("ok"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(src, "logs"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(src, "logs", "app.log"), []byte("skip"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(src, "vmm.pid"), []byte("123"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink("data.txt", filepath.Join(src, "link")); err != nil {
		t.Fatal(err)
	}

	if err := CopyDir(src, dst); err != nil {
		t.Fatal(err)
	}

	data, err := os.ReadFile(filepath.Join(dst, "data.txt"))
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "ok" {
		t.Fatalf("copied data = %q", string(data))
	}
	target, err := os.Readlink(filepath.Join(dst, "link"))
	if err != nil {
		t.Fatal(err)
	}
	if target != "data.txt" {
		t.Fatalf("symlink target = %q", target)
	}
	if _, err := os.Stat(filepath.Join(dst, "logs")); !os.IsNotExist(err) {
		t.Fatalf("logs directory should be skipped, err=%v", err)
	}
	if _, err := os.Stat(filepath.Join(dst, "vmm.pid")); !os.IsNotExist(err) {
		t.Fatalf("vmm.pid should be skipped, err=%v", err)
	}
}
