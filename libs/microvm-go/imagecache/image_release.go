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
)

func (s *ImageStore) Release(ctx context.Context, record ImageRecord, protected map[string]bool) error {
	s.releases.Lock()
	defer s.releases.Unlock()
	if err := ctx.Err(); err != nil {
		return fmt.Errorf("release prepared image: %w", err)
	}

	digestHexValue := record.DigestHex()
	digestDir := s.paths.ImageDigestDir(record.Repository, digestHexValue)
	if protected[digestDir] {
		return nil
	}
	tagged, err := s.repositoryTagsDigest(record.Repository, digestHexValue)
	if err != nil || tagged {
		return err
	}
	if err := os.RemoveAll(digestDir); err != nil {
		return fmt.Errorf("remove prepared image %s: %w", digestDir, err)
	}
	held, err := s.digestHeld(digestHexValue)
	if err != nil || held {
		return err
	}
	return s.layout.Remove(digestHexValue)
}

func (s *ImageStore) repositoryTagsDigest(repository, digestHexValue string) (bool, error) {
	repositoryDir := filepath.Join(s.paths.ImagesDir(), repository)
	entries, err := os.ReadDir(repositoryDir)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read image repository %s: %w", repository, err)
	}
	for _, entry := range entries {
		if entry.Type()&os.ModeSymlink == 0 {
			continue
		}
		target, err := os.Readlink(filepath.Join(repositoryDir, entry.Name()))
		if err != nil {
			return false, fmt.Errorf("read image tag link %s: %w", entry.Name(), err)
		}
		if target == digestHexValue {
			return true, nil
		}
	}
	return false, nil
}

func (s *ImageStore) digestHeld(digestHexValue string) (bool, error) {
	held, err := s.heldDigests()
	if err != nil {
		return false, err
	}
	_, exists := held[digestHexValue]
	return exists, nil
}
