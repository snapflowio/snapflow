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
	"encoding/binary"
	"errors"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/erofs/go-erofs"
	"github.com/google/go-containerregistry/pkg/compression"
	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/empty"
	"github.com/google/go-containerregistry/pkg/v1/mutate"
	"github.com/google/go-containerregistry/pkg/v1/static"
	"github.com/google/go-containerregistry/pkg/v1/tarball"
	"github.com/google/go-containerregistry/pkg/v1/types"
	"github.com/snapflowio/microvm-go/layout"
)

func testLayerTime() time.Time {
	return time.Unix(1_700_000_000, 0)
}

const unixModeMask = 0o177777

type tarEntry struct {
	name     string
	typeflag byte
	content  string
	mode     int64
	uid, gid int
	linkname string
	xattrs   map[string]string
	devmajor int64
	devminor int64
}

func testFormatter(t *testing.T) *ErofsFormatter {
	t.Helper()
	path, err := exec.LookPath("mkfs.erofs")
	if err != nil {
		t.Fatalf("mkfs.erofs %s or newer is required: %v", MinimumErofsUtilsVersion, err)
	}
	formatter, err := NewErofsFormatter(ErofsFormatterConfig{Path: path})
	if err != nil {
		t.Fatal(err)
	}
	return formatter
}

func newTestStore(t *testing.T) *ImageStore {
	t.Helper()
	store, err := NewImageStore(ImageStoreConfig{Paths: layout.NewPaths(t.TempDir()), Formatter: testFormatter(t)})
	if err != nil {
		t.Fatal(err)
	}
	return store
}

func layerTar(t *testing.T, entries []tarEntry) []byte {
	t.Helper()
	var buffer bytes.Buffer
	writer := tar.NewWriter(&buffer)
	for _, entry := range entries {
		header := &tar.Header{
			Typeflag: entry.typeflag, Name: entry.name, Linkname: entry.linkname,
			Mode: entry.mode, Uid: entry.uid, Gid: entry.gid, ModTime: testLayerTime(),
			Devmajor: entry.devmajor, Devminor: entry.devminor, Format: tar.FormatPAX,
		}
		if entry.typeflag == tar.TypeReg {
			header.Size = int64(len(entry.content))
		}
		for key, value := range entry.xattrs {
			if header.PAXRecords == nil {
				header.PAXRecords = map[string]string{}
			}
			header.PAXRecords[paxXattrPrefix+key] = value
		}
		if err := writer.WriteHeader(header); err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(writer, entry.content); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}

func compressedLayer(t *testing.T, codec compression.Compression, mediaType types.MediaType, entries []tarEntry) gcr.Layer {
	t.Helper()
	content := layerTar(t, entries)
	layer, err := tarball.LayerFromOpener(func() (io.ReadCloser, error) {
		return io.NopCloser(bytes.NewReader(content)), nil
	}, tarball.WithCompression(codec), tarball.WithMediaType(mediaType))
	if err != nil {
		t.Fatal(err)
	}
	return layer
}

func uncompressedLayer(t *testing.T, entries []tarEntry) gcr.Layer {
	t.Helper()
	return static.NewLayer(layerTar(t, entries), types.OCIUncompressedLayer)
}

func testImage(t *testing.T, layers ...gcr.Layer) gcr.Image {
	t.Helper()
	image, err := mutate.AppendLayers(empty.Image, layers...)
	if err != nil {
		t.Fatal(err)
	}
	config, err := image.ConfigFile()
	if err != nil {
		t.Fatal(err)
	}
	config.OS, config.Architecture = "linux", "amd64"
	image, err = mutate.ConfigFile(image, config)
	if err != nil {
		t.Fatal(err)
	}
	return image
}

type observedEntry struct {
	mode    uint32
	uid     uint32
	gid     uint32
	content string
	link    string
	xattrs  map[string]string
	inode   int64
	nlink   int
	rdev    uint32
}

func readErofsTree(t *testing.T, diskPath string) map[string]observedEntry {
	t.Helper()
	uncompressedPath := filepath.Join(t.TempDir(), "uncompressed.erofs")
	output, err := exec.CommandContext(t.Context(), testFormatter(t).Path(), "--quiet", "--clean=data", uncompressedPath, diskPath).CombinedOutput()
	if err != nil {
		t.Fatalf("rebuild %s without compression: %v: %s", diskPath, err, output)
	}
	disk, err := os.Open(uncompressedPath)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if err := disk.Close(); err != nil {
			t.Error(err)
		}
	})
	filesystem, err := erofs.Open(disk)
	if err != nil {
		t.Fatal(err)
	}
	tree := map[string]observedEntry{}
	err = fs.WalkDir(filesystem, ".", func(name string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		stat, ok := info.Sys().(*erofs.Stat)
		if !ok {
			return errors.New("EROFS entry has no inode metadata")
		}
		observed := observedEntry{
			mode: uint32(info.Mode()) & unixModeMask, uid: stat.UID, gid: stat.GID, xattrs: stat.Xattrs,
			inode: stat.Ino, nlink: stat.Nlink, rdev: stat.Rdev,
		}
		switch {
		case info.Mode().IsRegular():
			content, err := fs.ReadFile(filesystem, name)
			if err != nil {
				return err
			}
			observed.content = string(content)
		case info.Mode()&fs.ModeSymlink != 0:
			observed.link, err = fs.ReadLink(filesystem, name)
			if err != nil {
				return err
			}
		}
		tree[name] = observed
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return tree
}

const (
	erofsSuperblockOffset   = 1024
	erofsMagic              = 0xE0F5E1E2
	erofsSuperblockBytes    = 128
	erofsBlockBitsOffset    = 12
	erofsRootNidOffset      = 14
	erofsMetaBlockOffset    = 40
	erofsInodeSlotBytes     = 32
	erofsExtendedInodeBytes = 64
	erofsExtendedFormatBit  = 1
	erofsInodeModeOffset    = 4
	erofsCompactUIDOffset   = 24
	erofsCompactGIDOffset   = 26
	erofsExtendedUIDOffset  = 24
	erofsExtendedGIDOffset  = 28
)

func readRootInode(t *testing.T, diskPath string) observedEntry {
	t.Helper()
	disk, err := os.Open(diskPath)
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := disk.Close(); err != nil {
			t.Error(err)
		}
	}()
	superblock := make([]byte, erofsSuperblockBytes)
	if _, err := disk.ReadAt(superblock, erofsSuperblockOffset); err != nil {
		t.Fatal(err)
	}
	if magic := binary.LittleEndian.Uint32(superblock); magic != erofsMagic {
		t.Fatalf("superblock magic = %#x, want %#x", magic, erofsMagic)
	}
	blockBits := superblock[erofsBlockBitsOffset]
	rootNid := int64(binary.LittleEndian.Uint16(superblock[erofsRootNidOffset:]))
	metaBlock := int64(binary.LittleEndian.Uint32(superblock[erofsMetaBlockOffset:]))
	inode := make([]byte, erofsExtendedInodeBytes)
	if _, err := disk.ReadAt(inode, metaBlock<<blockBits+rootNid*erofsInodeSlotBytes); err != nil {
		t.Fatal(err)
	}
	root := observedEntry{mode: uint32(binary.LittleEndian.Uint16(inode[erofsInodeModeOffset:]))}
	if binary.LittleEndian.Uint16(inode)&erofsExtendedFormatBit != 0 {
		root.uid = binary.LittleEndian.Uint32(inode[erofsExtendedUIDOffset:])
		root.gid = binary.LittleEndian.Uint32(inode[erofsExtendedGIDOffset:])
	} else {
		root.uid = uint32(binary.LittleEndian.Uint16(inode[erofsCompactUIDOffset:]))
		root.gid = uint32(binary.LittleEndian.Uint16(inode[erofsCompactGIDOffset:]))
	}
	return root
}
