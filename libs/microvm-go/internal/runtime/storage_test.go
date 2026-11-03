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

package runtime

import (
	"bytes"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/snapflowio/microvm-go/ext4"
	"github.com/snapflowio/microvm-go/layout"
)

const (
	ext4MagicOffset = 1024 + 0x38
	ext4Magic       = "\x53\xef"
)

func TestOverlayDisksCloneOnePreformattedTemplatePerSize(t *testing.T) {
	if _, err := ext4.MkfsPath(); err != nil {
		t.Skip(err.Error())
	}
	backend := &Backend{paths: layout.NewPaths(t.TempDir())}
	const sizeGiB = 1
	targets := make([]string, 4)
	var group sync.WaitGroup
	errs := make([]error, len(targets))
	for index := range targets {
		targets[index] = filepath.Join(backend.paths.InstanceDir("instance-"+string(rune('a'+index))), "overlay.raw")
		group.Go(func() {
			errs[index] = backend.createOverlayDisk(t.Context(), targets[index], sizeGiB)
		})
	}
	group.Wait()
	for _, err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	template := backend.paths.SystemOverlayTemplate(gibibytes(sizeGiB))
	templateInfo, err := os.Stat(template)
	if err != nil {
		t.Fatalf("overlay template was not kept: %v", err)
	}
	for _, target := range targets {
		info, err := os.Stat(target)
		if err != nil || info.Size() != gibibytes(sizeGiB) {
			t.Fatalf("overlay %s = %v, %v", target, info, err)
		}
		if !hasExt4Superblock(t, target) {
			t.Fatalf("overlay %s is not an ext4 filesystem", target)
		}
	}
	if err := backend.createOverlayDisk(t.Context(), filepath.Join(t.TempDir(), "again.raw"), sizeGiB); err != nil {
		t.Fatal(err)
	}
	reused, err := os.Stat(template)
	if err != nil || !reused.ModTime().Equal(templateInfo.ModTime()) {
		t.Fatalf("overlay template was reformatted: %v", err)
	}
	entries, err := os.ReadDir(filepath.Dir(template))
	if err != nil || len(entries) != 1 {
		t.Fatalf("overlay template directory has %d entries, %v; want only the template", len(entries), err)
	}
}

func hasExt4Superblock(t *testing.T, path string) bool {
	t.Helper()
	file, err := os.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := file.Close(); err != nil {
			t.Error(err)
		}
	}()
	magic := make([]byte, len(ext4Magic))
	if _, err := file.ReadAt(magic, ext4MagicOffset); err != nil {
		t.Fatal(err)
	}
	return bytes.Equal(magic, []byte(ext4Magic))
}
