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
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"

	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/snapflowio/microvm-go/internal/filemode"
	"golang.org/x/sync/errgroup"
)

const blobDirectory = "blobs"

func (c *OCILayoutCache) writeImageBlobs(ctx context.Context, image gcr.Image) error {
	layers, err := image.Layers()
	if err != nil {
		return fmt.Errorf("read image layers: %w", err)
	}
	group, groupContext := errgroup.WithContext(ctx)
	for _, layer := range layers {
		group.Go(func() error {
			return c.writeLayerBlob(groupContext, layer)
		})
	}
	if err := group.Wait(); err != nil {
		return err
	}
	manifest, err := image.Manifest()
	if err != nil {
		return fmt.Errorf("read image manifest: %w", err)
	}
	config, err := image.RawConfigFile()
	if err != nil {
		return fmt.Errorf("read image config: %w", err)
	}
	if err := c.writeBlob(manifest.Config.Digest, io.NopCloser(bytes.NewReader(config))); err != nil {
		return fmt.Errorf("store image config: %w", err)
	}
	rawManifest, err := image.RawManifest()
	if err != nil {
		return fmt.Errorf("read raw image manifest: %w", err)
	}
	digest, err := image.Digest()
	if err != nil {
		return fmt.Errorf("read image digest: %w", err)
	}
	if err := c.writeBlob(digest, io.NopCloser(bytes.NewReader(rawManifest))); err != nil {
		return fmt.Errorf("store image manifest: %w", err)
	}
	return nil
}

func (c *OCILayoutCache) writeLayerBlob(ctx context.Context, layer gcr.Layer) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	digest, err := layer.Digest()
	if err != nil {
		return fmt.Errorf("read layer digest: %w", err)
	}
	if c.hasBlob(digest) {
		return nil
	}
	compressed, err := layer.Compressed()
	if err != nil {
		return fmt.Errorf("fetch layer %s: %w", digest, err)
	}
	if err := c.writeBlob(digest, compressed); err != nil {
		return fmt.Errorf("store layer %s: %w", digest, err)
	}
	return nil
}

func (c *OCILayoutCache) blobPath(digest gcr.Hash) string {
	return filepath.Join(string(c.path), blobDirectory, digest.Algorithm, digest.Hex)
}

func (c *OCILayoutCache) hasBlob(digest gcr.Hash) bool {
	info, err := os.Stat(c.blobPath(digest))
	return err == nil && info.Mode().IsRegular()
}

func (c *OCILayoutCache) writeBlob(digest gcr.Hash, content io.ReadCloser) (resultErr error) {
	defer func() {
		if err := content.Close(); err != nil {
			resultErr = errors.Join(resultErr, fmt.Errorf("close blob source: %w", err))
		}
	}()
	if digest.Algorithm != sha256Algorithm {
		return fmt.Errorf("unsupported blob digest algorithm %q", digest.Algorithm)
	}
	target := c.blobPath(digest)
	if err := os.MkdirAll(filepath.Dir(target), filemode.SharedDirectory); err != nil {
		return fmt.Errorf("create blob directory: %w", err)
	}
	temporary, err := os.CreateTemp(filepath.Dir(target), "."+digest.Hex+"-*")
	if err != nil {
		return fmt.Errorf("create temporary blob: %w", err)
	}
	temporaryPath := temporary.Name()
	defer func() {
		if err := os.Remove(temporaryPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			resultErr = errors.Join(resultErr, fmt.Errorf("remove temporary blob: %w", err))
		}
	}()
	hash := sha256.New()
	if _, err := io.Copy(io.MultiWriter(temporary, hash), content); err != nil {
		return errors.Join(fmt.Errorf("write blob: %w", err), wrapCloseError("close temporary blob", temporary.Close()))
	}
	if err := temporary.Close(); err != nil {
		return fmt.Errorf("close temporary blob: %w", err)
	}
	if actual := hex.EncodeToString(hash.Sum(nil)); actual != digest.Hex {
		return fmt.Errorf("blob digest is %s:%s, expected %s", sha256Algorithm, actual, digest)
	}
	if err := os.Rename(temporaryPath, target); err != nil {
		return fmt.Errorf("install blob: %w", err)
	}
	return nil
}
