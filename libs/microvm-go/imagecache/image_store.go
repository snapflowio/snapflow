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
	"strings"
	"sync"

	"github.com/snapflowio/microvm-go/layout"
	"github.com/snapflowio/microvm-go/types"
	"golang.org/x/sync/singleflight"
)

const imagePreparationConcurrency = 2

type ImageStoreConfig struct {
	Paths     layout.Paths
	Formatter *ErofsFormatter
}

type ImageStore struct {
	paths     layout.Paths
	formatter *ErofsFormatter
	layout    *OCILayoutCache
	slots     chan struct{}
	flights   singleflight.Group
	releases  sync.RWMutex
}

func NewImageStore(cfg ImageStoreConfig) (*ImageStore, error) {
	if strings.TrimSpace(cfg.Paths.DataDir()) == "" {
		return nil, errors.New("image store data directory is required")
	}
	if cfg.Formatter == nil {
		return nil, errors.New("image store EROFS formatter is required")
	}
	layoutCache, err := NewOCILayoutCache(cfg.Paths.SystemOCICache())
	if err != nil {
		return nil, err
	}
	store := &ImageStore{
		paths:     cfg.Paths,
		formatter: cfg.Formatter,
		layout:    layoutCache,
		slots:     make(chan struct{}, imagePreparationConcurrency),
	}
	if err := store.reclaimStaleCache(); err != nil {
		return nil, fmt.Errorf("reclaim stale image cache: %w", err)
	}
	return store, nil
}

func (s *ImageStore) Ensure(ctx context.Context, imageRef string, registry *types.Registry, platform string, policy types.ImagePullPolicy) (ImageRecord, error) {
	return s.ensure(imageRef, platform, policy, func() (ImageRecord, error) {
		return s.Materialize(ctx, imageRef, registry, platform)
	})
}

func (s *ImageStore) ensure(imageRef, platform string, policy types.ImagePullPolicy, materialize func() (ImageRecord, error)) (ImageRecord, error) {
	policy, err := normalizePullPolicy(imageRef, policy)
	if err != nil {
		return ImageRecord{}, err
	}
	if policy != types.ImagePullAlways {
		record, cacheErr := s.cachedReady(imageRef, platform)
		if cacheErr == nil {
			return record, nil
		}
		if policy == types.ImagePullNever {
			return ImageRecord{}, fmt.Errorf("image %s for %s is not present in the prepared image cache: %w", imageRef, resolvedPlatformString(platform), cacheErr)
		}
	}
	return materialize()
}

func (s *ImageStore) Materialize(ctx context.Context, imageRef string, registry *types.Registry, platform string) (ImageRecord, error) {
	metadata, image, err := FetchImage(ctx, imageRef, registry, platform)
	if err != nil {
		return ImageRecord{}, err
	}
	return s.materializeResolved(ctx, metadata, image)
}

func (s *ImageStore) Resolve(ctx context.Context, imageRef string, registry *types.Registry, platform string) (ImageRecord, error) {
	metadata, err := InspectImage(ctx, imageRef, registry, platform)
	if err != nil {
		return ImageRecord{}, err
	}
	record := recordFromMetadata(metadata, ImageStatusResolved, metadata.SizeBytes)
	if err := s.Write(record); err != nil {
		return ImageRecord{}, err
	}
	if err := s.linkReference(metadata.Reference, record); err != nil {
		return ImageRecord{}, err
	}
	return record, nil
}

func (s *ImageStore) ImportImage(ctx context.Context, imageRef string, image Image) (ImageRecord, error) {
	ref, err := ParseImageRef(imageRef)
	if err != nil {
		return ImageRecord{}, err
	}
	metadata, err := MetadataFromImage(ref.String(), ref.Repository(), image)
	if err != nil {
		return ImageRecord{}, err
	}
	return s.materializeResolved(ctx, metadata, image)
}
