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
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	gcrlayout "github.com/google/go-containerregistry/pkg/v1/layout"
	"github.com/snapflowio/microvm-go/imagecache"
)

const ociDirectoryMode = 0o755

func imageFromOCITar(tarPath, targetDir string) (imagecache.Image, error) {
	if err := os.RemoveAll(targetDir); err != nil {
		return nil, fmt.Errorf("remove previous OCI output directory: %w", err)
	}
	if err := os.MkdirAll(targetDir, ociDirectoryMode); err != nil {
		return nil, fmt.Errorf("create OCI output directory: %w", err)
	}
	if err := extractTar(tarPath, targetDir); err != nil {
		return nil, err
	}
	path, err := gcrlayout.FromPath(targetDir)
	if err != nil {
		return nil, fmt.Errorf("open OCI output layout: %w", err)
	}
	index, err := path.ImageIndex()
	if err != nil {
		return nil, fmt.Errorf("read OCI output index: %w", err)
	}
	manifest, err := index.IndexManifest()
	if err != nil {
		return nil, fmt.Errorf("read OCI output manifest: %w", err)
	}
	if len(manifest.Manifests) == 0 {
		return nil, fmt.Errorf("buildkit OCI output did not contain an image manifest")
	}
	image, err := path.Image(manifest.Manifests[0].Digest)
	if err != nil {
		return nil, fmt.Errorf("load OCI output image: %w", err)
	}
	return image, nil
}

func extractTar(tarPath, targetDir string) (resultErr error) {
	file, err := os.Open(tarPath)
	if err != nil {
		return fmt.Errorf("open OCI tar: %w", err)
	}
	defer file.Close()
	// Entries are written through an os.Root, so no entry name, ".." component
	// or symlink can place a file outside the output directory.
	root, err := os.OpenRoot(targetDir)
	if err != nil {
		return fmt.Errorf("open OCI output directory: %w", err)
	}
	defer func() {
		resultErr = errors.Join(resultErr, root.Close())
	}()
	reader := tar.NewReader(file)
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read OCI tar entry: %w", err)
		}
		if err := extractTarEntry(reader, header, root); err != nil {
			return err
		}
	}
}

func extractTarEntry(reader io.Reader, header *tar.Header, root *os.Root) error {
	target := filepath.Clean(filepath.FromSlash(header.Name))
	if !filepath.IsLocal(target) {
		return fmt.Errorf("unsafe OCI tar entry %q", header.Name)
	}
	mode := os.FileMode(header.Mode)
	switch header.Typeflag {
	case tar.TypeDir:
		if err := root.MkdirAll(target, mode.Perm()); err != nil {
			return fmt.Errorf("create OCI directory %s: %w", target, err)
		}
		return nil
	case tar.TypeReg:
		return writeTarFile(reader, root, target, mode.Perm(), header.Size)
	default:
		return fmt.Errorf("unsupported OCI tar entry %s type %d", header.Name, header.Typeflag)
	}
}

func writeTarFile(reader io.Reader, root *os.Root, target string, mode os.FileMode, size int64) error {
	if err := root.MkdirAll(filepath.Dir(target), ociDirectoryMode); err != nil {
		return fmt.Errorf("create OCI file parent %s: %w", target, err)
	}
	out, err := root.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, mode)
	if err != nil {
		return fmt.Errorf("create OCI file %s: %w", target, err)
	}
	if _, err := io.CopyN(out, reader, size); err != nil {
		return errors.Join(
			fmt.Errorf("write OCI file %s: %w", target, err),
			out.Close(),
		)
	}
	if err := out.Close(); err != nil {
		return fmt.Errorf("close OCI file %s: %w", target, err)
	}
	return nil
}
