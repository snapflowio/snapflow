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
	"slices"
)

type repositoryContents struct {
	linked  map[string]bool
	digests []string
}

func (s *ImageStore) ReleaseOrphans(ctx context.Context, protected map[string]bool, kept func(ImageRecord) bool) (int, error) {
	s.releases.Lock()
	defer s.releases.Unlock()
	if err := ctx.Err(); err != nil {
		return 0, fmt.Errorf("release orphaned images: %w", err)
	}
	repositories, err := s.repositoryContents()
	if err != nil {
		return 0, err
	}
	released := 0
	for repository, contents := range repositories {
		for _, digestHexValue := range contents.digests {
			if contents.linked[digestHexValue] {
				continue
			}
			removed, err := s.releaseOrphan(repository, digestHexValue, protected, kept)
			if err != nil {
				return released, err
			}
			if removed {
				released++
			}
		}
	}
	return released, s.removeEmptyRepositories()
}

func (s *ImageStore) removeEmptyRepositories() error {
	directories, err := s.repositoryDirectories()
	if err != nil {
		return err
	}
	for _, directory := range slices.Backward(directories) {
		if err := removeIfEmpty(directory); err != nil {
			return err
		}
	}
	return nil
}

func removeIfEmpty(directory string) error {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return fmt.Errorf("read image repository %s: %w", directory, err)
	}
	if len(entries) > 0 {
		return nil
	}
	if err := os.Remove(directory); err != nil {
		return fmt.Errorf("remove empty image repository %s: %w", directory, err)
	}
	return nil
}

func (s *ImageStore) repositoryDirectories() ([]string, error) {
	root := s.paths.ImagesDir()
	var directories []string
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if !entry.IsDir() || path == root {
			return nil
		}
		if digestDirectoryPattern.MatchString(entry.Name()) {
			return filepath.SkipDir
		}
		directories = append(directories, path)
		return nil
	})
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list image repositories: %w", err)
	}
	return directories, nil
}

func (s *ImageStore) releaseOrphan(repository, digestHexValue string, protected map[string]bool, kept func(ImageRecord) bool) (bool, error) {
	digestDir := s.paths.ImageDigestDir(repository, digestHexValue)
	if protected[digestDir] {
		return false, nil
	}
	record, err := s.Read(repository, digestHexValue)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	ref, err := ParseImageRef(record.Reference)
	if err != nil || ref.IsDigest() || kept(record) {
		return false, err
	}
	if err := os.RemoveAll(digestDir); err != nil {
		return false, fmt.Errorf("remove orphaned image %s: %w", digestDir, err)
	}
	held, err := s.digestHeld(digestHexValue)
	if err != nil || held {
		return true, err
	}
	if err := s.layout.Remove(digestHexValue); err != nil {
		return true, fmt.Errorf("remove cached layers of orphaned image %s: %w", digestDir, err)
	}
	return true, nil
}

func (s *ImageStore) repositoryContents() (map[string]*repositoryContents, error) {
	root := s.paths.ImagesDir()
	repositories := make(map[string]*repositoryContents)
	contentsOf := func(path string) (*repositoryContents, error) {
		repository, err := filepath.Rel(root, filepath.Dir(path))
		if err != nil {
			return nil, fmt.Errorf("locate image repository of %s: %w", path, err)
		}
		repository = filepath.ToSlash(repository)
		if repositories[repository] == nil {
			repositories[repository] = &repositoryContents{linked: make(map[string]bool)}
		}
		return repositories[repository], nil
	}
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		switch {
		case entry.Type()&os.ModeSymlink != 0:
			return recordLink(path, contentsOf)
		case entry.IsDir() && digestDirectoryPattern.MatchString(entry.Name()):
			contents, err := contentsOf(path)
			if err != nil {
				return err
			}
			contents.digests = append(contents.digests, entry.Name())
			return filepath.SkipDir
		}
		return nil
	})
	if errors.Is(err, os.ErrNotExist) {
		return repositories, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list prepared images: %w", err)
	}
	return repositories, nil
}

func recordLink(path string, contentsOf func(string) (*repositoryContents, error)) error {
	target, err := os.Readlink(path)
	if err != nil {
		return fmt.Errorf("read image reference link %s: %w", path, err)
	}
	contents, err := contentsOf(path)
	if err != nil {
		return err
	}
	contents.linked[target] = true
	return nil
}
