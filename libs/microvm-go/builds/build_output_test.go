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

package builds

import (
	"archive/tar"
	"os"
	"path/filepath"
	"testing"
)

func writeOCITar(t *testing.T, entries ...archiveEntry) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "image.tar")
	file, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	writer := tar.NewWriter(file)
	for _, entry := range entries {
		mode := int64(0o644)
		if entry.typeflag == tar.TypeDir {
			mode = ociDirectoryMode
		}
		header := &tar.Header{Name: entry.name, Typeflag: entry.typeflag, Mode: mode, Size: int64(len(entry.content))}
		if err := writer.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if _, err := writer.Write([]byte(entry.content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestExtractTarWritesEntriesInsideTheOutputDirectory(t *testing.T) {
	target := t.TempDir()
	archive := writeOCITar(t,
		archiveEntry{name: "blobs/sha256/", typeflag: tar.TypeDir},
		archiveEntry{name: "blobs/sha256/layer", typeflag: tar.TypeReg, content: "layer"},
		archiveEntry{name: "index.json", typeflag: tar.TypeReg, content: "{}"},
	)
	if err := extractTar(archive, target); err != nil {
		t.Fatal(err)
	}
	content, err := os.ReadFile(filepath.Join(target, "blobs", "sha256", "layer"))
	if err != nil || string(content) != "layer" {
		t.Fatalf("extracted layer = %q, %v", content, err)
	}
}

func TestExtractTarRejectsEntriesOutsideTheOutputDirectory(t *testing.T) {
	for name, entryName := range map[string]string{
		"parent traversal": "../escape",
		"nested traversal": "blobs/../../escape",
		"absolute path":    "/escape",
	} {
		parent := t.TempDir()
		target := filepath.Join(parent, "output")
		if err := os.Mkdir(target, ociDirectoryMode); err != nil {
			t.Fatal(err)
		}
		archive := writeOCITar(t, archiveEntry{name: entryName, typeflag: tar.TypeReg, content: "owned"})
		if err := extractTar(archive, target); err == nil {
			t.Errorf("%s: extractTar accepted %q", name, entryName)
		}
		if _, err := os.Stat(filepath.Join(parent, "escape")); !os.IsNotExist(err) {
			t.Errorf("%s: archive wrote outside the output directory: %v", name, err)
		}
	}
}

func TestExtractTarDoesNotFollowSymlinksOutOfTheOutputDirectory(t *testing.T) {
	target := t.TempDir()
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(target, "blobs")); err != nil {
		t.Fatal(err)
	}
	archive := writeOCITar(t, archiveEntry{name: "blobs/owned", typeflag: tar.TypeReg, content: "owned"})
	if err := extractTar(archive, target); err == nil {
		t.Fatal("extractTar wrote through a symlink that leaves the output directory")
	}
	if _, err := os.Stat(filepath.Join(outside, "owned")); !os.IsNotExist(err) {
		t.Fatalf("archive wrote outside the output directory: %v", err)
	}
}
