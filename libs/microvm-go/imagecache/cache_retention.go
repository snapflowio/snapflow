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
	"regexp"

	"github.com/snapflowio/microvm-go/layout"
)

var (
	imageCacheFormatPattern = regexp.MustCompile(`^v[0-9]+$`)
	digestDirectoryPattern  = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

func (s *ImageStore) reclaimStaleCache() error {
	if err := removeOtherCacheFormats(s.paths); err != nil {
		return err
	}
	held, err := s.heldDigests()
	if err != nil {
		return err
	}
	return s.layout.Retain(func(layoutTag string) bool {
		_, exists := held[layoutTag]
		return exists
	})
}

func removeOtherCacheFormats(paths layout.Paths) error {
	root := filepath.Dir(paths.ImagesDir())
	entries, err := os.ReadDir(root)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("list image cache formats: %w", err)
	}
	for _, entry := range entries {
		if !entry.IsDir() || entry.Name() == layout.ImageCacheFormat || !imageCacheFormatPattern.MatchString(entry.Name()) {
			continue
		}
		if err := os.RemoveAll(filepath.Join(root, entry.Name())); err != nil {
			return fmt.Errorf("remove stale image cache format %s: %w", entry.Name(), err)
		}
	}
	return nil
}

func (s *ImageStore) heldDigests() (map[string]struct{}, error) {
	held := make(map[string]struct{})
	err := filepath.WalkDir(s.paths.ImagesDir(), func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if entry.IsDir() && digestDirectoryPattern.MatchString(entry.Name()) {
			held[entry.Name()] = struct{}{}
			return filepath.SkipDir
		}
		return nil
	})
	if errors.Is(err, os.ErrNotExist) {
		return held, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find prepared image digests: %w", err)
	}
	return held, nil
}

func (s *ImageStore) ReleaseDiskArtifacts(ctx context.Context, repository string, keep, protected map[string]bool) (int, error) {
	s.releases.Lock()
	defer s.releases.Unlock()
	if err := ctx.Err(); err != nil {
		return 0, fmt.Errorf("release disk artifacts: %w", err)
	}
	repositoryDir := filepath.Join(s.paths.ImagesDir(), repository)
	entries, err := os.ReadDir(repositoryDir)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read image repository %s: %w", repository, err)
	}
	released := 0
	for _, entry := range entries {
		if !entry.IsDir() || !digestDirectoryPattern.MatchString(entry.Name()) {
			continue
		}
		digestDir := filepath.Join(repositoryDir, entry.Name())
		releasable, err := s.releasableDiskArtifact(repository, entry.Name(), keep)
		if err != nil {
			return released, err
		}
		if !releasable || protected[digestDir] {
			continue
		}
		if err := os.RemoveAll(digestDir); err != nil {
			return released, fmt.Errorf("remove disk artifact %s: %w", digestDir, err)
		}
		released++
	}
	return released, nil
}

func (s *ImageStore) releasableDiskArtifact(repository, digestHex string, keep map[string]bool) (bool, error) {
	record, err := s.Read(repository, digestHex)
	if errors.Is(err, os.ErrNotExist) {
		return true, nil
	}
	if err != nil {
		return false, err
	}
	return record.Source == ImageSourceDiskArtifact && !keep[record.Digest], nil
}
