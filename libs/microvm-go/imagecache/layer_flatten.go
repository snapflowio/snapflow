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
	"errors"
	"fmt"
	"io"
	"path"
	"strings"
	"time"
)

const (
	whiteoutPrefix        = ".wh."
	opaqueWhiteout        = whiteoutPrefix + whiteoutPrefix + ".opq"
	rootEntryName         = "./"
	rootDirectoryMode     = 0o755
	paxXattrPrefix        = "SCHILY.xattr."
	libarchiveXattrPrefix = "LIBARCHIVE.xattr."
)

func ignoredXattr(name string) bool {
	return name == "security.selinux" || name == "system.nfs4_acl"
}

type layerFlattener struct {
	output *tar.Writer
	tree   *flattenedTree
	layer  int
}

func newLayerFlattener(output io.Writer) *layerFlattener {
	return &layerFlattener{output: tar.NewWriter(output), tree: newFlattenedTree()}
}

func (f *layerFlattener) writeRoot() error {
	return f.output.WriteHeader(&tar.Header{
		Typeflag: tar.TypeDir, Name: rootEntryName, Mode: rootDirectoryMode,
		ModTime: time.Unix(0, 0), Format: tar.FormatPAX,
	})
}

func (f *layerFlattener) apply(layer io.Reader) error {
	f.layer++
	reader := tar.NewReader(layer)
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read layer entry: %w", err)
		}
		if err := f.applyEntry(header, reader); err != nil {
			return fmt.Errorf("apply layer entry %q: %w", header.Name, err)
		}
	}
}

func (f *layerFlattener) applyEntry(header *tar.Header, content io.Reader) error {
	if header.Typeflag == tar.TypeXGlobalHeader {
		return nil
	}
	name := cleanEntryPath(header.Name)
	parent, base := path.Split(name)
	parent = strings.TrimSuffix(parent, "/")
	switch {
	case base == opaqueWhiteout:
		return f.hideLowerChildren(parent)
	case strings.HasPrefix(base, whiteoutPrefix):
		return f.whiteout(path.Join(parent, strings.TrimPrefix(base, whiteoutPrefix)))
	default:
		return f.copyEntry(header, name, content)
	}
}

func (f *layerFlattener) whiteout(target string) error {
	node, exists := f.tree.nodes[target]
	if !exists || node.created == f.layer {
		return nil
	}
	return f.writeWhiteout(target)
}

func (f *layerFlattener) hideLowerChildren(dir string) error {
	for _, child := range f.tree.sortedChildren(dir) {
		childPath := path.Join(dir, child)
		node := f.tree.nodes[childPath]
		switch {
		case node.touched < f.layer:
			if err := f.writeWhiteout(childPath); err != nil {
				return err
			}
		case node.directory:
			if err := f.hideLowerChildren(childPath); err != nil {
				return err
			}
		}
	}
	return nil
}

func (f *layerFlattener) writeWhiteout(target string) error {
	parent, base := path.Split(target)
	f.tree.remove(target)
	return f.output.WriteHeader(&tar.Header{
		Typeflag: tar.TypeReg, Name: parent + whiteoutPrefix + base,
		ModTime: time.Unix(0, 0), Format: tar.FormatPAX,
	})
}

func (f *layerFlattener) copyEntry(header *tar.Header, name string, content io.Reader) error {
	if !supportedEntryType(header.Typeflag) {
		return fmt.Errorf("unsupported tar entry type %q", header.Typeflag)
	}
	directory := header.Typeflag == tar.TypeDir
	if name == rootPath && !directory {
		return errors.New("the image root must be a directory")
	}
	if existing, exists := f.tree.nodes[name]; exists && name != rootPath && existing.directory != directory {
		if err := f.writeWhiteout(name); err != nil {
			return err
		}
	}
	entry := flattenedHeader(header, name)
	f.tree.add(name, directory, f.layer)
	if err := f.output.WriteHeader(entry); err != nil {
		return err
	}
	if header.Typeflag != tar.TypeReg {
		return nil
	}
	if _, err := io.Copy(f.output, content); err != nil {
		return fmt.Errorf("copy file content: %w", err)
	}
	return nil
}

func (f *layerFlattener) close() error {
	return f.output.Close()
}

func flattenedHeader(header *tar.Header, name string) *tar.Header {
	entry := &tar.Header{
		Typeflag: header.Typeflag, Name: name, Linkname: header.Linkname,
		Size: header.Size, Mode: header.Mode, Uid: header.Uid, Gid: header.Gid,
		Uname: header.Uname, Gname: header.Gname, ModTime: header.ModTime,
		Devmajor: header.Devmajor, Devminor: header.Devminor,
		PAXRecords: xattrRecords(header.PAXRecords), Format: tar.FormatPAX,
	}
	switch header.Typeflag {
	case tar.TypeDir:
		if name == "" {
			entry.Name = rootEntryName
		}
	case tar.TypeLink:
		entry.Linkname = cleanEntryPath(header.Linkname)
	}
	if header.Typeflag != tar.TypeReg {
		entry.Size = 0
	}
	return entry
}

func xattrRecords(records map[string]string) map[string]string {
	var kept map[string]string
	for key, value := range records {
		name, isXattr := strings.CutPrefix(key, paxXattrPrefix)
		if !isXattr && !strings.HasPrefix(key, libarchiveXattrPrefix) {
			continue
		}
		if ignoredXattr(name) {
			continue
		}
		if kept == nil {
			kept = make(map[string]string)
		}
		kept[key] = value
	}
	return kept
}

func supportedEntryType(typeflag byte) bool {
	switch typeflag {
	case tar.TypeReg, tar.TypeDir, tar.TypeSymlink, tar.TypeLink, tar.TypeChar, tar.TypeBlock, tar.TypeFifo:
		return true
	default:
		return false
	}
}

func cleanEntryPath(name string) string {
	return strings.TrimPrefix(path.Clean("/"+name), "/")
}
