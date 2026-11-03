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

package imagecache

import (
	"archive/tar"
	"bytes"
	"context"
	"maps"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/google/go-containerregistry/pkg/compression"
	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/mutate"
	"github.com/google/go-containerregistry/pkg/v1/types"
	"golang.org/x/sys/unix"
)

const (
	testUserID     = 1000
	testCapability = "\x01\x00\x00\x02\x00\x20\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
	testNullDevice = 1<<8 | 3
	rootTreePath   = "."
)

func baseLayer(t *testing.T) gcr.Layer {
	return compressedLayer(t, compression.GZip, types.OCILayer, []tarEntry{
		{name: "etc/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "etc/passwd", typeflag: tar.TypeReg, content: "root", mode: 0o644},
		{name: "home/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "home/user/", typeflag: tar.TypeDir, mode: 0o750, uid: testUserID, gid: testUserID},
		{
			name: "home/user/data", typeflag: tar.TypeReg, content: "data", mode: 0o600, uid: testUserID, gid: testUserID,
			xattrs: map[string]string{"user.origin": "base", "security.selinux": "system_u:object_r:etc_t:s0"},
		},
		{name: "bin/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "bin/tool", typeflag: tar.TypeReg, content: "tool", mode: 0o4755, xattrs: map[string]string{"security.capability": testCapability}},
		{name: "bin/tool-link", typeflag: tar.TypeLink, linkname: "/bin/tool"},
		{name: "bin/sh", typeflag: tar.TypeSymlink, linkname: "tool", mode: 0o777},
		{name: "dev/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "dev/null", typeflag: tar.TypeChar, mode: 0o666, devmajor: 1, devminor: 3},
		{name: "run/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "run/pipe", typeflag: tar.TypeFifo, mode: 0o620},
		{name: "gone/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "gone/file", typeflag: tar.TypeReg, content: "gone", mode: 0o644},
		{name: "opaque/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "opaque/old", typeflag: tar.TypeReg, content: "old", mode: 0o644},
		{name: "opaque/nested/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "opaque/nested/deep", typeflag: tar.TypeReg, content: "deep", mode: 0o644},
		{name: "replaced", typeflag: tar.TypeReg, content: "v1", mode: 0o644},
		{name: "kind", typeflag: tar.TypeReg, content: "file", mode: 0o644},
		{name: "keep/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "keep/a", typeflag: tar.TypeReg, content: "a", mode: 0o644},
	})
}

func whiteoutLayer(t *testing.T) gcr.Layer {
	return compressedLayer(t, compression.ZStd, types.OCILayerZStd, []tarEntry{
		{name: ".wh.gone", typeflag: tar.TypeReg},
		{name: "etc/.wh.passwd", typeflag: tar.TypeReg},
		{name: "opaque/", typeflag: tar.TypeDir, mode: 0o700},
		{name: "opaque/nested/", typeflag: tar.TypeDir, mode: 0o711},
		{name: "opaque/.wh..wh..opq", typeflag: tar.TypeReg},
		{name: "opaque/new", typeflag: tar.TypeReg, content: "new", mode: 0o644},
		{name: "replaced", typeflag: tar.TypeReg, content: "v2", mode: 0o640},
		{name: "kind/", typeflag: tar.TypeDir, mode: 0o755},
		{name: "kind/child", typeflag: tar.TypeReg, content: "child", mode: 0o644},
		{name: "fresh", typeflag: tar.TypeReg, content: "fresh", mode: 0o644},
		{name: ".wh.fresh", typeflag: tar.TypeReg},
		{name: "keep/.wh.missing", typeflag: tar.TypeReg},
	})
}

func rootLayer(t *testing.T) gcr.Layer {
	return uncompressedLayer(t, []tarEntry{
		{name: "./", typeflag: tar.TypeDir, mode: 0o711},
		{name: "etc/passwd", typeflag: tar.TypeReg, content: "recreated", mode: 0o600},
	})
}

type expectedEntry struct {
	mode    uint32
	uid     uint32
	content string
	link    string
	xattrs  map[string]string
}

func expectedFlattenedTree() map[string]expectedEntry {
	return map[string]expectedEntry{
		rootTreePath:     {mode: unix.S_IFDIR | 0o711},
		"etc":            {mode: unix.S_IFDIR | 0o755},
		"etc/passwd":     {mode: unix.S_IFREG | 0o600, content: "recreated"},
		"home":           {mode: unix.S_IFDIR | 0o755},
		"home/user":      {mode: unix.S_IFDIR | 0o750, uid: testUserID},
		"home/user/data": {mode: unix.S_IFREG | 0o600, uid: testUserID, content: "data", xattrs: map[string]string{"user.origin": "base"}},
		"bin":            {mode: unix.S_IFDIR | 0o755},
		"bin/tool":       {mode: unix.S_IFREG | unix.S_ISUID | 0o755, content: "tool", xattrs: map[string]string{"security.capability": testCapability}},
		"bin/tool-link":  {mode: unix.S_IFREG | unix.S_ISUID | 0o755, content: "tool", xattrs: map[string]string{"security.capability": testCapability}},
		"bin/sh":         {mode: unix.S_IFLNK | 0o777, link: "tool"},
		"dev":            {mode: unix.S_IFDIR | 0o755},
		"dev/null":       {mode: unix.S_IFCHR | 0o666},
		"run":            {mode: unix.S_IFDIR | 0o755},
		"run/pipe":       {mode: unix.S_IFIFO | 0o620},
		"opaque":         {mode: unix.S_IFDIR | 0o700},
		"opaque/nested":  {mode: unix.S_IFDIR | 0o711},
		"opaque/new":     {mode: unix.S_IFREG | 0o644, content: "new"},
		"replaced":       {mode: unix.S_IFREG | 0o640, content: "v2"},
		"kind":           {mode: unix.S_IFDIR | 0o755},
		"kind/child":     {mode: unix.S_IFREG | 0o644, content: "child"},
		"fresh":          {mode: unix.S_IFREG | 0o644, content: "fresh"},
		"keep":           {mode: unix.S_IFDIR | 0o755},
		"keep/a":         {mode: unix.S_IFREG | 0o644, content: "a"},
	}
}

func convertTestImage(t *testing.T, formatter *ErofsFormatter, image gcr.Image, diskPath string) ConversionReport {
	t.Helper()
	digest, err := image.Digest()
	if err != nil {
		t.Fatal(err)
	}
	report, err := formatter.Convert(context.Background(), ConvertRequest{
		Image: image, DiskPath: diskPath, WorkDir: t.TempDir(), Identity: digest.String(),
	})
	if err != nil {
		t.Fatal(err)
	}
	return report
}

func TestConvertFlattensLayersWithOCISemantics(t *testing.T) {
	image := testImage(t, baseLayer(t), whiteoutLayer(t), rootLayer(t))
	diskPath := filepath.Join(t.TempDir(), "rootfs.erofs")
	report := convertTestImage(t, testFormatter(t), image, diskPath)

	if len(report.Layers) != 3 || report.Layers[1].MediaType != string(types.OCILayerZStd) {
		t.Fatalf("layer reports = %+v, want gzip, zstd, and uncompressed layers", report.Layers)
	}
	if report.DiskBytes%sectorSize != 0 {
		t.Fatalf("disk size %d is not sector aligned", report.DiskBytes)
	}
	observed := readErofsTree(t, diskPath)
	observed[rootTreePath] = readRootInode(t, diskPath)
	expected := expectedFlattenedTree()
	if got, want := slices.Sorted(maps.Keys(observed)), slices.Sorted(maps.Keys(expected)); !slices.Equal(got, want) {
		t.Fatalf("paths = %v, want %v", got, want)
	}
	for name, want := range expected {
		got := observed[name]
		if got.mode != want.mode || got.uid != want.uid || got.gid != want.uid {
			t.Errorf("%s: mode %#o owner %d:%d, want mode %#o owner %d:%d", name, got.mode, got.uid, got.gid, want.mode, want.uid, want.uid)
		}
		if got.content != want.content || got.link != want.link {
			t.Errorf("%s: content %q link %q, want content %q link %q", name, got.content, got.link, want.content, want.link)
		}
		if !maps.Equal(nonEmpty(got.xattrs), nonEmpty(want.xattrs)) {
			t.Errorf("%s: xattrs %q, want %q", name, got.xattrs, want.xattrs)
		}
	}
	tool, link := observed["bin/tool"], observed["bin/tool-link"]
	if tool.inode != link.inode || tool.nlink != 2 {
		t.Errorf("hard link inodes %d/%d with %d links, want one inode with 2 links", tool.inode, link.inode, tool.nlink)
	}
	if observed["dev/null"].rdev != testNullDevice {
		t.Errorf("dev/null device = %#x, want %#x", observed["dev/null"].rdev, testNullDevice)
	}
}

func nonEmpty(values map[string]string) map[string]string {
	if len(values) == 0 {
		return nil
	}
	return values
}

func TestConvertIsReproducible(t *testing.T) {
	formatter := testFormatter(t)
	image := testImage(t, baseLayer(t), whiteoutLayer(t), rootLayer(t))
	directory := t.TempDir()
	first, second := filepath.Join(directory, "first.erofs"), filepath.Join(directory, "second.erofs")
	convertTestImage(t, formatter, image, first)
	convertTestImage(t, formatter, image, second)
	firstBytes, err := os.ReadFile(first)
	if err != nil {
		t.Fatal(err)
	}
	secondBytes, err := os.ReadFile(second)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(firstBytes, secondBytes) {
		t.Fatal("converting the same image twice produced different filesystems")
	}
}

func TestConvertRejectsLayerWithWrongDiffID(t *testing.T) {
	image := testImage(t, baseLayer(t))
	config, err := image.ConfigFile()
	if err != nil {
		t.Fatal(err)
	}
	config.RootFS.DiffIDs = []gcr.Hash{{Algorithm: sha256Algorithm, Hex: strings.Repeat("0", 64)}}
	image, err = mutate.ConfigFile(image, config)
	if err != nil {
		t.Fatal(err)
	}
	digest, err := image.Digest()
	if err != nil {
		t.Fatal(err)
	}
	_, err = testFormatter(t).Convert(context.Background(), ConvertRequest{
		Image: image, DiskPath: filepath.Join(t.TempDir(), "rootfs.erofs"), WorkDir: t.TempDir(), Identity: digest.String(),
	})
	if err == nil || !strings.Contains(err.Error(), "diff ID") {
		t.Fatalf("error = %v, want a diff ID mismatch", err)
	}
}

func TestVersionAtLeast(t *testing.T) {
	tests := []struct {
		version string
		want    bool
	}{
		{version: "1.9.4", want: true},
		{version: "1.10.0", want: true},
		{version: "2.0.0", want: true},
		{version: "1.9.3", want: false},
		{version: "1.8.10", want: false},
	}
	for _, test := range tests {
		got, err := versionAtLeast(test.version, MinimumErofsUtilsVersion)
		if err != nil {
			t.Fatal(err)
		}
		if got != test.want {
			t.Errorf("versionAtLeast(%s) = %t, want %t", test.version, got, test.want)
		}
	}
}
