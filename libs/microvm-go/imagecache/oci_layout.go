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
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	gcr "github.com/google/go-containerregistry/pkg/v1"
	"github.com/google/go-containerregistry/pkg/v1/empty"
	"github.com/google/go-containerregistry/pkg/v1/layout"
	"github.com/google/go-containerregistry/pkg/v1/match"
	"github.com/google/go-containerregistry/pkg/v1/partial"
	"github.com/snapflowio/microvm-go/internal/filemode"
)

const layoutReferenceAnnotation = "org.opencontainers.image.ref.name"

type OCILayoutCache struct {
	path  layout.Path
	index sync.RWMutex
}

func NewOCILayoutCache(dir string) (*OCILayoutCache, error) {
	if err := os.MkdirAll(filepath.Join(dir, blobDirectory, sha256Algorithm), filemode.SharedDirectory); err != nil {
		return nil, fmt.Errorf("create OCI cache directory: %w", err)
	}
	path, err := layout.FromPath(dir)
	if err != nil {
		path, err = layout.Write(dir, empty.Index)
		if err != nil {
			return nil, fmt.Errorf("create OCI layout: %w", err)
		}
	}
	return &OCILayoutCache{path: path}, nil
}

func (c *OCILayoutCache) PullImage(ctx context.Context, image gcr.Image, layoutTag string) error {
	if _, err := c.Image(layoutTag); err == nil {
		return nil
	}
	if err := c.writeImageBlobs(ctx, image); err != nil {
		return err
	}
	descriptor, err := partial.Descriptor(image)
	if err != nil {
		return fmt.Errorf("describe image for OCI layout: %w", err)
	}
	descriptor.Annotations = map[string]string{layoutReferenceAnnotation: layoutTag}

	c.index.Lock()
	defer c.index.Unlock()
	if _, err := c.imageByTag(layoutTag); err == nil {
		return nil
	}
	if err := c.path.AppendDescriptor(*descriptor); err != nil {
		return fmt.Errorf("append image to OCI layout: %w", err)
	}
	return nil
}

func (c *OCILayoutCache) Remove(layoutTag string) error {
	return c.removeEntries(match.Annotation(layoutReferenceAnnotation, layoutTag))
}

func (c *OCILayoutCache) Retain(keep func(layoutTag string) bool) error {
	return c.removeEntries(func(descriptor gcr.Descriptor) bool {
		return !keep(descriptor.Annotations[layoutReferenceAnnotation])
	})
}

func (c *OCILayoutCache) removeEntries(matcher match.Matcher) error {
	c.index.Lock()
	defer c.index.Unlock()
	if err := c.path.RemoveDescriptors(matcher); err != nil {
		return fmt.Errorf("remove OCI layout entries: %w", err)
	}
	unreferenced, err := c.path.GarbageCollect()
	if err != nil {
		return fmt.Errorf("find unreferenced OCI layout blobs: %w", err)
	}
	for _, blob := range unreferenced {
		if err := c.path.RemoveBlob(blob); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("remove OCI layout blob %s: %w", blob, err)
		}
	}
	return nil
}

func (c *OCILayoutCache) Image(layoutTag string) (gcr.Image, error) {
	c.index.RLock()
	defer c.index.RUnlock()
	return c.imageByTag(layoutTag)
}

func (c *OCILayoutCache) imageByTag(layoutTag string) (gcr.Image, error) {
	index, err := c.path.ImageIndex()
	if err != nil {
		return nil, fmt.Errorf("read OCI index: %w", err)
	}
	manifest, err := index.IndexManifest()
	if err != nil {
		return nil, fmt.Errorf("read OCI index manifest: %w", err)
	}
	for _, descriptor := range manifest.Manifests {
		if descriptor.Annotations[layoutReferenceAnnotation] == layoutTag {
			return c.path.Image(descriptor.Digest)
		}
	}
	return nil, fmt.Errorf("image %s is not present in OCI layout: %w", layoutTag, os.ErrNotExist)
}
